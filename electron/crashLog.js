const fs = require('fs');
const path = require('path');

// Log persistant du launcher : jusqu'ici, une erreur au tout début du démarrage (avant qu'une
// fenêtre existe) faisait disparaître l'app en silence, sans aucun message ni trace exploitable.
// Ce module doit être initialisé EN TOUT PREMIER dans main.js, avant tout autre require
// susceptible d'échouer (fs.mkdirSync, dotenv, lib/*) : ainsi process.on('uncaughtException')
// intercepte même les erreurs qui surviennent pendant le chargement des modules suivants.
const MAX_LOG_BYTES = 5 * 1024 * 1024;

let logFile = null;
let dialogRef = null;

function init(homeDir, electronDialog) {
  logFile = path.join(homeDir, 'launcher.log');
  dialogRef = electronDialog;

  process.on('uncaughtException', err => reportFatal('Erreur fatale', err));
  process.on('unhandledRejection', err => reportFatal('Erreur asynchrone non gérée', err));

  writeLine('=== Démarrage du launcher ===');
}

// Écriture best-effort : si le disque est plein ou inaccessible, on ne peut rien faire de plus,
// mais ça ne doit jamais lever d'exception à son tour (utilisé depuis un handler de crash).
function writeLine(line) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_BYTES) {
      fs.renameSync(logFile, `${logFile}.old`);
    }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
  } catch (_) { /* rien de plus possible */ }
}

function reportFatal(title, err) {
  const message = (err && err.stack) || String(err);
  writeLine(`FATAL — ${title}\n${message}`);
  try {
    dialogRef.showErrorBox(
      `${title} — Pal Launcher Server Manager`,
      `Une erreur inattendue est survenue :\n\n${message}\n\nDétails complets enregistrés dans :\n${logFile}`
    );
  } catch (_) {
    // dialog peut ne pas être utilisable si Electron n'est pas encore prêt : le log suffit alors.
  }
}

module.exports = { init, writeLine, reportFatal, getLogFile: () => logFile };
