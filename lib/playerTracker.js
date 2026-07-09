const path = require('path');
const { getPalworldApi } = require('./palworldClient');
const discord = require('./discord');
const activityLog = require('./activityLog');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

const HISTORY_FILE = path.join(DATA_DIR, 'player-history.json');
const MAX_SESSIONS = 300;

const emptyHistory = () => ({ sessions: [], totals: {} });

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
    players = res.data.players || [];
  } catch {
    return; // API injoignable (blip réseau ou serveur arrêté) : on n'invente pas de déconnexions
  }

  const now = Date.now();
  const notifications = [];

  try {
    await updateJson(HISTORY_FILE, emptyHistory(), history => {
      const currentIds = new Set(players.map(p => p.userId));

      players.forEach(p => {
        if (!onlineSince[p.userId]) {
          onlineSince[p.userId] = now;
          history.sessions.unshift({
            userId: p.userId,
            name: p.name,
            joined: new Date(now).toISOString(),
            left: null,
            lastSeen: new Date(now).toISOString()
          });
          notifications.push({ discord: `🟢 **${p.name}** a rejoint le serveur`, username: p.name, action: 'player-join' });
        } else {
          const session = history.sessions.find(s => s.userId === p.userId && !s.left);
          if (session) session.lastSeen = new Date(now).toISOString();
        }
      });

      Object.keys(onlineSince).forEach(userId => {
        if (currentIds.has(userId)) return;
        const session = history.sessions.find(s => s.userId === userId && !s.left);
        const name = session ? session.name : userId;
        let durationMin;
        if (session) {
          durationMin = closeSession(history, session, now);
        } else {
          durationMin = Math.max(1, Math.round((now - onlineSince[userId]) / 60000));
          history.totals[userId] = (history.totals[userId] || 0) + durationMin;
        }
        delete onlineSince[userId];
        notifications.push({ discord: `🔴 **${name}** a quitté le serveur (${durationMin} min de jeu)`, username: name, action: 'player-leave', details: `${durationMin} min` });
      });

      history.sessions = history.sessions.slice(0, MAX_SESSIONS);
    });
  } catch (err) {
    console.error("Écriture de l'historique des joueurs échouée:", err.message || err);
    return;
  }

  notifications.forEach(n => {
    discord.notify(n.discord, 'players');
    activityLog.log(n.username, n.action, n.details || '');
  });
}

function recentSessions(limit = 30) {
  return readJson(HISTORY_FILE, emptyHistory()).sessions.slice(0, limit);
}

function totals() {
  return readJson(HISTORY_FILE, emptyHistory()).totals;
}

function start(intervalMs = 60000) {
  recoverOpenSessions(intervalMs)
    .catch(err => console.error('Reprise des sessions joueurs échouée:', err.message || err))
    .then(() => poll());
  setInterval(poll, intervalMs);
}

module.exports = { start, poll, recoverOpenSessions, recentSessions, totals };
