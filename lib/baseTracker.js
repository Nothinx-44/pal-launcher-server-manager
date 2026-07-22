const path = require('path');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');
const playerTracker = require('./playerTracker');
const paldefenderApi = require('./paldefenderApi');

// Guildes + bases (camps) via l'API PalDefender, PAS via /v1/api/game-data (absent — 404 — sur
// certaines versions de Palworld). PalDefender expose :
//   GET /v1/pdapi/players -> { Players: [{ Name, IP, UserId, GuildName, GuildUUID, Status, ... }] }
//   GET /v1/pdapi/guilds  -> { Guilds: { <uuid>: { name, camps: [{ id, world_pos, map_pos }], members, ... } } }
// On en tire : la guilde de chaque joueur (fusionnée dans le registre de playerTracker) et la liste
// des bases (un camp = une base, identifié par son id stable). Sondé peu souvent (5 min par défaut).
const BASES_FILE = path.join(DATA_DIR, 'bases.json');
const ABANDONED_AFTER_DAYS = parseInt(process.env.BASE_ABANDONED_DAYS || '14', 10);

// bases : { <campId>: {...} }. guilds : { <guildUUID>: { name, memberUserIds:[], lastOnlineAt } }
// (mémorise quels joueurs composent la guilde et la dernière fois qu'un membre était en ligne, pour
// juger l'abandon sans avoir à re-sonder à chaque affichage).
const emptyStore = () => ({ bases: {}, guilds: {} });

async function poll() {
  let players;
  try {
    const data = await paldefenderApi.call('get', '/v1/pdapi/players');
    players = (data && data.Players) || [];
  } catch {
    return; // PalDefender non configuré/injoignable : rien à faire (dégradation silencieuse)
  }
  let guildsData = {};
  let guildsFetchOk = false; // ne purger bases/guildes disparues QUE sur une réponse complète
  try {
    const data = await paldefenderApi.call('get', '/v1/pdapi/guilds');
    guildsData = (data && data.Guilds) || {};
    guildsFetchOk = true;
  } catch { /* pas de guildes accessibles : on garde au moins l'enrichissement joueurs ci-dessous */ }

  const now = new Date().toISOString();

  // Guilde par userId (pour enrichir la liste des joueurs) + agrégat d'activité par guilde.
  const guildByUserId = {};
  const guildAgg = {}; // guildUUID -> { name, memberUserIds:Set, online:bool }
  players.forEach(p => {
    const gid = p.GuildUUID;
    if (!gid) return;
    if (!guildAgg[gid]) guildAgg[gid] = { name: p.GuildName || null, memberUserIds: new Set(), online: false };
    if (p.UserId) {
      guildByUserId[p.UserId] = { guildId: gid, guildName: p.GuildName || null };
      guildAgg[gid].memberUserIds.add(p.UserId);
    }
    if (p.Status === 'Online') guildAgg[gid].online = true;
  });
  if (Object.keys(guildByUserId).length) await playerTracker.updateGuildInfo(guildByUserId);

  await updateJson(BASES_FILE, emptyStore(), store => {
    if (!store.bases) store.bases = {};
    if (!store.guilds) store.guilds = {};

    // Activité des guildes (membres connus + dernière fois qu'un membre était en ligne).
    Object.entries(guildAgg).forEach(([gid, agg]) => {
      const g = store.guilds[gid] || {};
      g.name = agg.name || g.name || null;
      g.memberUserIds = [...agg.memberUserIds];
      if (agg.online) g.lastOnlineAt = now;
      store.guilds[gid] = g;
    });

    // Purge : une base démolie en jeu (ou une guilde dissoute) disparaît de la réponse /guilds —
    // sans ce nettoyage elle resterait en stock pour toujours et finirait faussement marquée
    // « abandonnée ». Uniquement sur une réponse complète : un échec de fetch ne détruit rien.
    if (guildsFetchOk) {
      const liveCampIds = new Set();
      Object.values(guildsData).forEach(g => (g.camps || []).forEach(c => { if (c.id) liveCampIds.add(String(c.id)); }));
      Object.keys(store.bases).forEach(id => { if (!liveCampIds.has(String(id))) delete store.bases[id]; });
      Object.keys(store.guilds).forEach(gid => { if (!guildsData[gid] && !guildAgg[gid]) delete store.guilds[gid]; });
    }

    // Bases (camps). id de camp = clé stable fournie par PalDefender (mieux qu'un hash de position).
    Object.entries(guildsData).forEach(([gid, g]) => {
      const guild = store.guilds[gid] || {};
      if (g.name) { guild.name = g.name; store.guilds[gid] = guild; }
      (g.camps || []).forEach(camp => {
        if (!camp.id) return;
        const existing = store.bases[camp.id] || { firstSeen: now };
        store.bases[camp.id] = {
          ...existing,
          campId: camp.id,
          guildId: gid,
          guildName: g.name || null,
          x: camp.map_pos ? camp.map_pos.x : null,
          y: camp.map_pos ? camp.map_pos.y : null,
          worldX: camp.world_pos ? camp.world_pos.x : null,
          worldY: camp.world_pos ? camp.world_pos.y : null,
          lastSeen: now
        };
      });
    });
  });
}

// Dernière activité connue d'une guilde : le plus récent entre "un membre était en ligne" (relevé
// lors du poll) et la dernière connexion enregistrée de n'importe quel membre (registre joueurs).
function guildLastActiveMs(guild, lastSeenByUser) {
  if (!guild) return null;
  let last = guild.lastOnlineAt ? Date.parse(guild.lastOnlineAt) : 0;
  (guild.memberUserIds || []).forEach(uid => {
    const t = lastSeenByUser[uid] || 0;
    if (t > last) last = t;
  });
  return last || null;
}

// Liste des bases, enrichie du statut "abandonnée" : une base est abandonnée si sa guilde n'a plus
// eu aucun membre actif depuis le seuil. Pas de "propriétaire unique" chez Palworld — une base
// appartient à une guilde — donc l'abandon se juge à l'échelle de la guilde.
function listBases() {
  const store = readJson(BASES_FILE, emptyStore());
  const lastSeenByUser = {};
  playerTracker.allPlayers().forEach(p => { lastSeenByUser[p.userId] = Date.parse(p.lastSeen || 0) || 0; });

  return Object.values(store.bases || {}).map(b => {
    const lastMs = guildLastActiveMs((store.guilds || {})[b.guildId], lastSeenByUser);
    const days = lastMs ? Math.floor((Date.now() - lastMs) / 86400000) : null;
    return {
      ...b,
      lastOwnerSeen: lastMs ? new Date(lastMs).toISOString() : null,
      daysSinceOwnerSeen: days,
      abandoned: days != null && days >= ABANDONED_AFTER_DAYS
    };
  }).sort((a, b) => (b.daysSinceOwnerSeen ?? -1) - (a.daysSinceOwnerSeen ?? -1));
}

function start(intervalMs = 5 * 60 * 1000) {
  poll();
  setInterval(poll, intervalMs);
}

module.exports = { start, poll, listBases, guildLastActiveMs, ABANDONED_AFTER_DAYS, BASES_FILE };
