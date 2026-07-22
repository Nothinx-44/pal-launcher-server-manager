const path = require('path');
const { getPalworldApi } = require('./palworldClient');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

// Historique de fréquentation : échantillonne le nombre de joueurs en ligne à intervalle régulier
// (5 min par défaut) pour tracer la courbe « Fréquentation » du dashboard (24 h / 7 j).
// Un point = { t: epoch ms, c: nombre de joueurs, ou null si le serveur était injoignable }.
// null ≠ 0 : la courbe affiche un trou (serveur éteint) plutôt qu'un faux « 0 joueur ».
const COUNTS_FILE = path.join(DATA_DIR, 'player-counts.json');
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours ≈ 2016 points à 5 min : négligeable

const emptyStore = () => ({ points: [] });

async function sample() {
  let count = null;
  try {
    const res = await getPalworldApi().get('/v1/api/players');
    if (res.status === 200) count = (res.data.players || []).length;
  } catch { /* serveur injoignable : on enregistre null (trou dans la courbe) */ }

  const now = Date.now();
  await updateJson(COUNTS_FILE, emptyStore(), store => {
    if (!store.points) store.points = [];
    store.points.push({ t: now, c: count });
    const cutoff = now - RETENTION_MS;
    // Les points arrivent en ordre chronologique : on coupe simplement la tête expirée.
    const firstKept = store.points.findIndex(p => p.t >= cutoff);
    if (firstKept > 0) store.points = store.points.slice(firstKept);
  }).catch(err => console.error("Écriture de l'historique de fréquentation échouée:", err.message || err));
}

// Points sur la fenêtre demandée (ms). Lecture simple : le fichier est petit et l'endpoint
// n'est appelé qu'à l'ouverture de l'onglet + toutes les 5 min.
function points(windowMs = RETENTION_MS) {
  const cutoff = Date.now() - Math.min(windowMs, RETENTION_MS);
  return (readJson(COUNTS_FILE, emptyStore()).points || []).filter(p => p.t >= cutoff);
}

function start(intervalMs = 5 * 60 * 1000) {
  sample();
  setInterval(sample, intervalMs);
}

module.exports = { start, sample, points, COUNTS_FILE, RETENTION_MS };
