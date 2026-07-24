const fs = require('fs');
const path = require('path');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');
const { parseChatLines } = require('./chatParser');
const serverSetup = require('./serverSetup');
const plugins = require('./plugins');

// Historique du chat en jeu. Un « suiveur » de console.log : à chaque tick, on lit uniquement les
// octets ajoutés depuis la dernière position lue (offset), on en extrait les lignes [Chat::*] et on
// les archive. L'offset garantit qu'aucun message n'est lu deux fois ni manqué (contrairement à un
// simple tail qui ne voit qu'une fenêtre glissante et ne persiste rien).
//
// Un message = { ts, time, channel, name, userId, message, from }.
//   ts   = epoch ms d'ingestion (le log ne donne que HH:MM:SS : on lui adjoint une vraie date)
//   from = 'dashboard' pour un message envoyé depuis le dashboard (broadcast), sinon absent.
const CHAT_FILE = path.join(DATA_DIR, 'chat-history.json');
const MAX_MESSAGES = 2000;                       // plafond dur (fichier borné)
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;   // 30 jours
const ECHO_WINDOW_MS = 20000;                    // fenêtre d'annulation d'écho broadcast

const emptyStore = () => ({ file: '', offset: 0, messages: [] });

// Fichier de log à suivre. Les messages [Chat::*] sont écrits par PalDefender (option logChat) dans
// SON propre log : .../Pal/Binaries/Win64/PalDefender/Logs/<daté>.log — PAS dans le console.log
// (stdout NSSM du serveur). On prend donc le .log le plus récent de ce dossier. À défaut de
// PalDefender, on retombe sur le console.log (au cas où le chat y figurerait).
function logFilePath() {
  try {
    const binaries = plugins.getBinariesDir();
    const logsDir = binaries && path.join(binaries, 'PalDefender', 'Logs');
    if (logsDir && fs.existsSync(logsDir)) {
      const logs = fs.readdirSync(logsDir)
        .filter(f => f.toLowerCase().endsWith('.log'))
        .map(f => ({ f, m: fs.statSync(path.join(logsDir, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
      if (logs.length) return path.join(logsDir, logs[0].f);
    }
  } catch { /* dossier inaccessible : on tente le fallback */ }
  const console = serverSetup.getCurrentConsoleLogPath();
  return console && fs.existsSync(console) ? console : '';
}

function trim(store) {
  const cutoff = Date.now() - RETENTION_MS;
  let msgs = store.messages.filter(m => m.ts >= cutoff);
  if (msgs.length > MAX_MESSAGES) msgs = msgs.slice(msgs.length - MAX_MESSAGES);
  store.messages = msgs;
}

// Lit le segment [offset, taille] du fichier. Renvoie { text, consumed } où `text` ne contient que
// des lignes complètes (on s'arrête au dernier \n) et `consumed` = octets réellement traités, pour
// n'avancer l'offset que sur ce qui est complet. Gère la rotation (fichier plus court qu'attendu).
function readNewBytes(file, offset) {
  const size = fs.statSync(file).size;
  let start = offset;
  if (size < offset) start = 0; // rotation/troncature : on repart du début du nouveau fichier
  if (size <= start) return { text: '', consumed: start === offset ? 0 : -start, newBase: start };
  const length = size - start;
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    const lastNl = buffer.lastIndexOf(0x0a);
    if (lastNl === -1) return { text: '', consumed: 0, newBase: start }; // ligne encore incomplète
    return { text: buffer.toString('utf-8', 0, lastNl + 1), consumed: lastNl + 1, newBase: start };
  } finally {
    fs.closeSync(fd);
  }
}

let sampling = false;

async function sample() {
  if (sampling) return; // évite le chevauchement si un tick déborde sur le suivant
  sampling = true;
  try {
    const file = logFilePath();
    if (!file) return;

    const prev = readJson(CHAT_FILE, emptyStore());
    // Nouveau fichier de log (rotation quotidienne / nouvelle session) : on repart de son début.
    const base = prev.file === file ? (prev.offset || 0) : 0;
    const { text, consumed, newBase } = readNewBytes(file, base);
    if (!text && consumed === 0 && prev.file === file) return;

    const parsed = parseChatLines(text ? text.split(/\r?\n/).filter(Boolean) : []);
    const now = Date.now();

    await updateJson(CHAT_FILE, emptyStore(), store => {
      store.file = file;
      store.offset = newBase + Math.max(0, consumed);
      for (const c of parsed) {
        // Annulation d'écho : un broadcast envoyé depuis le dashboard réapparaît dans le log sous
        // l'auteur "system" au format "<pseudo>: <texte>". On l'ignore s'il correspond à un message
        // dashboard tout juste enregistré (par texte, avec ou sans le préfixe pseudo).
        const echo = [...store.messages].reverse().find(m =>
          m.from === 'dashboard' && m.echoPending && now - m.ts <= ECHO_WINDOW_MS &&
          (c.message === m.message || c.message === `${m.name}: ${m.message}`));
        if (echo) { delete echo.echoPending; continue; }
        store.messages.push({ ts: now, ...c });
      }
      trim(store);
    });
  } catch (err) {
    console.error('Collecte du chat en jeu échouée:', err.message || err);
  } finally {
    sampling = false;
  }
}

// Enregistre un message envoyé depuis le dashboard (broadcast PalDefender). Marqué echoPending pour
// que le suiveur ne le ré-ajoute pas s'il réapparaît dans console.log.
async function record(name, message) {
  await updateJson(CHAT_FILE, emptyStore(), store => {
    store.messages.push({ ts: Date.now(), time: '', channel: 'Global', name, userId: '', message, from: 'dashboard', echoPending: true });
    trim(store);
  });
}

// Derniers messages, du plus récent au plus ancien. Champs internes (echoPending) retirés.
function messages(limit = 300) {
  const all = readJson(CHAT_FILE, emptyStore()).messages || [];
  return all.slice(-limit).reverse().map(({ echoPending, ...m }) => m);
}

function start(intervalMs = 5000) {
  sample();
  setInterval(sample, intervalMs);
}

module.exports = { start, sample, record, messages, CHAT_FILE, MAX_MESSAGES, RETENTION_MS };
