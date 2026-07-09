const { getPalworldApi, runNssm, isServiceRunning, getServiceName } = require('./palworldClient');
const discord = require('./discord');
const activityLog = require('./activityLog');

const FAIL_THRESHOLD = parseInt(process.env.WATCHDOG_FAIL_THRESHOLD || '3', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.WATCHDOG_INTERVAL_MS || '60000', 10);
// Délai de grâce après un redémarrage automatique : un gros monde peut mettre plus de
// FAIL_THRESHOLD minutes à charger (API injoignable pendant ce temps) — sans ce délai, le
// watchdog redémarrerait le serveur en plein chargement, en boucle infinie.
const POST_RESTART_GRACE_MS = parseInt(process.env.WATCHDOG_GRACE_MS || String(10 * 60 * 1000), 10);

let consecutiveFailures = 0;
let restarting = false;
let lastAutoRestartAt = 0;

async function check() {
  if (restarting) return;
  if (Date.now() - lastAutoRestartAt < POST_RESTART_GRACE_MS) return;

  const serviceRunning = await isServiceRunning();
  if (!serviceRunning) {
    // Service arrêté (via le dashboard ou manuellement) : rien d'anormal, pas d'action
    consecutiveFailures = 0;
    return;
  }

  try {
    const res = await getPalworldApi().get('/v1/api/info');
    consecutiveFailures = res.status === 200 ? 0 : consecutiveFailures + 1;
  } catch {
    consecutiveFailures++;
  }

  if (consecutiveFailures >= FAIL_THRESHOLD) {
    restarting = true;
    consecutiveFailures = 0;
    lastAutoRestartAt = Date.now();
    activityLog.log('watchdog', 'auto-restart', 'API injoignable alors que le service Windows est actif');
    await discord.notify('⚠️ Le serveur Palworld ne répond plus alors que le process tourne toujours — redémarrage automatique en cours…', 'server');
    try {
      await runNssm(['restart', getServiceName()]);
      await discord.notify('✅ Redémarrage automatique effectué.', 'server');
    } catch (err) {
      await discord.notify(`❌ Échec du redémarrage automatique : ${err}`, 'server');
    } finally {
      restarting = false;
    }
  }
}

function start() {
  setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { start };
