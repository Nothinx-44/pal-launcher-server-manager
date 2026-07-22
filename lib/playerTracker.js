const path = require('path');
const { getPalworldApi, normalizePlayers } = require('./palworldClient');
const discord = require('./discord');
const activityLog = require('./activityLog');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

const HISTORY_FILE = path.join(DATA_DIR, 'player-history.json');
const MAX_SESSIONS = 300;

// sessions : historique détaillé récent (plafonné). totals : minutes cumulées par userId.
// players : registre PERSISTANT de tous les joueurs déjà vus (name/ip/level… dernières valeurs
// connues) — survit à l'élagage des sessions, sert à l'annuaire "tous les joueurs".
const emptyHistory = () => ({ sessions: [], totals: {}, players: {} });

// Suivi en mémoire des joueurs actuellement connectés (userId -> timestamp d'arrivée)
let onlineSince = {};

function closeSession(history, session, leftAtMs) {
  session.left = new Date(leftAtMs).toISOString();
  const durationMin = Math.max(1, Math.round((leftAtMs - Date.parse(session.joined)) / 60000));
  history.totals[session.userId] = (history.totals[session.userId] || 0) + durationMin;
  return durationMin;
}

// Au démarrage du dashboard : reprend les sessions restées ouvertes (left: null) d'une
// exécution précédente. Si le joueur a été vu il y a moins de deux intervalles de polling
// (simple redémarrage du dashboard), la session continue sans notification en double ;
// sinon (dashboard resté éteint un moment) la session est clôturée à la dernière
// observation, pour ne pas compter du temps de jeu fictif ni la laisser ouverte à jamais.
function recoverOpenSessions(intervalMs) {
  return updateJson(HISTORY_FILE, emptyHistory(), history => {
    const staleAfterMs = intervalMs * 2;
    const now = Date.now();
    history.sessions.forEach(session => {
      if (session.left) return;
      const lastSeenMs = Date.parse(session.lastSeen || session.joined);
      if (now - lastSeenMs > staleAfterMs) {
        closeSession(history, session, lastSeenMs);
      } else if (!onlineSince[session.userId]) {
        onlineSince[session.userId] = Date.parse(session.joined);
      }
    });
  });
}

async function poll() {
  let players;
  try {
    const res = await getPalworldApi().get('/v1/api/players');
    if (res.status !== 200) return; // serveur probablement arrêté, on ne touche pas à l'historique
    players = normalizePlayers(res.data.players || []);
  } catch {
    return; // API injoignable (blip réseau ou serveur arrêté) : on n'invente pas de déconnexions
  }

  const now = Date.now();
  const notifications = [];

  try {
    await updateJson(HISTORY_FILE, emptyHistory(), history => {
      const currentIds = new Set(players.map(p => p.userId));

      if (!history.players) history.players = {}; // fichier d'historique d'une version antérieure

      // Index des sessions ouvertes par userId : évite un .find() sur le tableau des sessions
      // pour chaque joueur en ligne puis chaque déconnecté (O(n²) sinon).
      const openSessions = {};
      history.sessions.forEach(s => { if (!s.left && !openSessions[s.userId]) openSessions[s.userId] = s; });

      players.forEach(p => {
        // Registre persistant : dernières valeurs connues (name/ip/level), première/dernière fois
        // vu. Mis à jour pour tout joueur en ligne, nouveau ou non.
        const reg = history.players[p.userId] || { firstSeen: new Date(now).toISOString(), sessionCount: 0 };
        reg.name = p.name;
        if (p.ip) reg.ip = p.ip;
        if (p.level != null) reg.level = p.level;
        reg.lastSeen = new Date(now).toISOString();
        history.players[p.userId] = reg;

        if (!onlineSince[p.userId]) {
          onlineSince[p.userId] = now;
          reg.sessionCount = (reg.sessionCount || 0) + 1; // nouvelle session
          const session = {
            userId: p.userId,
            name: p.name,
            ip: p.ip || null, // IP vue à la connexion (utile pour la modération / ban IP)
            joined: new Date(now).toISOString(),
            left: null,
            lastSeen: new Date(now).toISOString()
          };
          history.sessions.unshift(session);
          openSessions[p.userId] = session;
          notifications.push({ discordKey: 'playerJoin', discordParams: { name: p.name }, username: p.name, action: 'player-join' });
        } else {
          const session = openSessions[p.userId];
          if (session) session.lastSeen = new Date(now).toISOString();
        }
      });

      Object.keys(onlineSince).forEach(userId => {
        if (currentIds.has(userId)) return;
        const session = openSessions[userId];
        const name = session ? session.name : userId;
        let durationMin;
        if (session) {
          durationMin = closeSession(history, session, now);
        } else {
          durationMin = Math.max(1, Math.round((now - onlineSince[userId]) / 60000));
          history.totals[userId] = (history.totals[userId] || 0) + durationMin;
        }
        delete onlineSince[userId];
        notifications.push({ discordKey: 'playerLeave', discordParams: { name, minutes: durationMin }, username: name, action: 'player-leave', details: `${durationMin} min` });
      });

      history.sessions = history.sessions.slice(0, MAX_SESSIONS);
    });
  } catch (err) {
    console.error("Écriture de l'historique des joueurs échouée:", err.message || err);
    return;
  }

  notifications.forEach(n => {
    discord.notify(n.discordKey, n.discordParams, 'players');
    activityLog.log(n.username, n.action, n.details || '');
  });
}

function recentSessions(limit = 30) {
  return readJson(HISTORY_FILE, emptyHistory()).sessions.slice(0, limit);
}

function totals() {
  return readJson(HISTORY_FILE, emptyHistory()).totals;
}

// Fusionne les infos de guilde (issues de l'API PalDefender, sondée par lib/baseTracker.js —
// /v1/api/players ne fournit pas la guilde) dans le registre persistant. N'enrichit que les
// joueurs déjà connus (vus au moins une fois via /v1/api/players) : sans fiche existante, il n'y
// a rien à compléter.
function updateGuildInfo(guildByUserIdMap) {
  return updateJson(HISTORY_FILE, emptyHistory(), history => {
    if (!history.players) return;
    Object.entries(guildByUserIdMap).forEach(([userId, g]) => {
      const reg = history.players[userId];
      if (!reg) return;
      if (g.guildId) reg.guildId = g.guildId;
      if (g.guildName) reg.guildName = g.guildName;
    });
  }).then(result => {
    guildCache = null; // les guildes viennent de changer : le prochain guildByUserId() relira
    return result;
  }).catch(err => console.error('Mise à jour des guildes échouée:', err.message || err));
}

// Guilde connue par userId, pour enrichir la liste des joueurs EN LIGNE (/api/status) sans avoir
// à interroger PalDefender à chaque rafraîchissement (sondé séparément et bien moins souvent par
// baseTracker). Mise en cache mémoire : /api/status est appelé toutes les 15 s par chaque client,
// relire/parser player-history.json à chaque fois serait du gaspillage — le cache n'est invalidé
// que par updateGuildInfo(), seul écrivain des guildes.
let guildCache = null;
function guildByUserId() {
  if (guildCache) return guildCache;
  const registry = readJson(HISTORY_FILE, emptyHistory()).players || {};
  const map = {};
  Object.entries(registry).forEach(([userId, p]) => {
    if (p.guildId) map[userId] = { guildId: p.guildId, guildName: p.guildName || null };
  });
  guildCache = map;
  return map;
}

// Annuaire de TOUS les joueurs déjà connectés au moins une fois : dernières infos connues
// (niveau, IP), temps de jeu cumulé, nombre de sessions, première/dernière connexion, et s'ils
// sont en ligne maintenant. Trié du plus récemment vu au plus ancien.
function allPlayers() {
  const history = readJson(HISTORY_FILE, emptyHistory());
  const registry = history.players || {};
  const totalsByUser = history.totals || {};
  return Object.entries(registry).map(([userId, p]) => ({
    userId,
    name: p.name || userId,
    ip: p.ip || null,
    level: p.level ?? null,
    guildId: p.guildId || null,
    guildName: p.guildName || null,
    firstSeen: p.firstSeen || null,
    lastSeen: p.lastSeen || null,
    lastSeenMs: Date.parse(p.lastSeen || '') || 0, // pré-calculé pour le tri (évite 2 new Date par comparaison)
    sessionCount: p.sessionCount || 0,
    totalMinutes: totalsByUser[userId] || 0,
    online: Object.prototype.hasOwnProperty.call(onlineSince, userId)
  })).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
}

function start(intervalMs = 60000) {
  recoverOpenSessions(intervalMs)
    .catch(err => console.error('Reprise des sessions joueurs échouée:', err.message || err))
    .then(() => poll());
  setInterval(poll, intervalMs);
}

module.exports = { start, poll, recoverOpenSessions, recentSessions, totals, allPlayers, updateGuildInfo, guildByUserId, HISTORY_FILE };
