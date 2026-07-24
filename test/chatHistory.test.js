const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Sandbox DATA_DIR + faux console.log AVANT de charger le module.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-hist-'));
process.env.DATA_DIR = dataDir;
const logFile = path.join(dataDir, 'console.log');

const serverSetup = require('../lib/serverSetup');
serverSetup.getCurrentConsoleLogPath = () => logFile; // le suiveur lit ce fichier

const chatHistory = require('../lib/chatHistory');

const CHAT = (t, name, msg) => `[${t}][info] [Chat::Global]['${name}' (UserId=steam_1, IP=1.1.1.1)]: ${msg}\n`;

test('archive les messages et n\'avance que sur les lignes complètes', async () => {
  fs.writeFileSync(logFile, CHAT('10:00:00', 'Alice', 'bonjour') + CHAT('10:00:05', 'Bob', 'salut'));
  await chatHistory.sample();
  let msgs = chatHistory.messages();
  assert.deepStrictEqual(msgs.map(m => m.message), ['salut', 'bonjour']); // plus récent d'abord

  // Ligne incomplète (sans \n) : ne doit pas encore être ingérée
  fs.appendFileSync(logFile, "[10:00:09][info] [Chat::Global]['Alice' (UserId=steam_1, IP=1.1.1.1)]: incomplet");
  await chatHistory.sample();
  assert.strictEqual(chatHistory.messages().length, 2);

  // Complétée : ingérée au tick suivant, sans dupliquer les précédentes (offset)
  fs.appendFileSync(logFile, '\n');
  await chatHistory.sample();
  msgs = chatHistory.messages();
  assert.strictEqual(msgs.length, 3);
  assert.strictEqual(msgs[0].message, 'incomplet');
});

test('gère la rotation du log (fichier tronqué)', async () => {
  fs.writeFileSync(logFile, CHAT('11:00:00', 'Carol', 'apres rotation'));
  await chatHistory.sample();
  const msgs = chatHistory.messages();
  assert.strictEqual(msgs[0].message, 'apres rotation');
});

test('record() ajoute un message dashboard et l\'écho console.log est annulé', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-echo-'));
  // Nouveau sandbox isolé pour ce test : on recharge le module proprement
  delete require.cache[require.resolve('../lib/chatHistory')];
  delete require.cache[require.resolve('../lib/paths')];
  process.env.DATA_DIR = dir;
  const log2 = path.join(dir, 'console.log');
  fs.writeFileSync(log2, '');
  const ss = require('../lib/serverSetup');
  ss.getCurrentConsoleLogPath = () => log2;
  const ch = require('../lib/chatHistory');

  await ch.record('Vincent', 'coucou tout le monde');
  assert.strictEqual(ch.messages().length, 1);
  assert.strictEqual(ch.messages()[0].from, 'dashboard');

  // PalDefender réémet le broadcast dans le log sous "system" au format "<pseudo>: <texte>" :
  // ne doit PAS créer de doublon (annulation d'écho avec préfixe pseudo).
  fs.appendFileSync(log2, CHAT('12:00:00', 'system', 'Vincent: coucou tout le monde'));
  await ch.sample();
  const msgs = ch.messages().filter(m => m.message.includes('coucou tout le monde'));
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].from, 'dashboard'); // c'est bien l'entrée dashboard conservée
});

test('bascule sur un nouveau fichier de log (rotation quotidienne) sans perdre ni dupliquer', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-rot-'));
  delete require.cache[require.resolve('../lib/chatHistory')];
  delete require.cache[require.resolve('../lib/paths')];
  process.env.DATA_DIR = dir;
  const day1 = path.join(dir, 'day1.log');
  const day2 = path.join(dir, 'day2.log');
  fs.writeFileSync(day1, CHAT('23:59:00', 'Alice', 'hier'));
  const ss = require('../lib/serverSetup');
  let active = day1;
  ss.getCurrentConsoleLogPath = () => active; // getBinariesDir vide -> fallback sur ce chemin
  const ch = require('../lib/chatHistory');

  await ch.sample();
  assert.deepStrictEqual(ch.messages().map(m => m.message), ['hier']);

  // Nouveau fichier (nouvelle journée) : offset doit repartir de 0 sur day2
  fs.writeFileSync(day2, CHAT('00:00:30', 'Bob', 'aujourd_hui'));
  active = day2;
  await ch.sample();
  const msgs = ch.messages().map(m => m.message);
  assert.ok(msgs.includes('aujourd_hui'));
  assert.ok(msgs.includes('hier')); // l'historique déjà archivé est conservé
  assert.strictEqual(msgs.filter(m => m === 'aujourd_hui').length, 1); // pas de doublon
});
