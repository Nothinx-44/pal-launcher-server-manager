// .env chargé depuis le dossier de base (paths.ENV_FILE) : quand le dashboard tourne comme service
// lancé par l'appli desktop, PALWORLD_DASHBOARD_HOME pointe hors du dossier de resources.
require('dotenv').config({ path: require('./lib/paths').ENV_FILE });
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
const cron = require('node-cron');

const { getPalworldApi, runNssm, gracefulStop, getServiceName, isServiceRunning } = require('./lib/palworldClient');
const { JsonSessionStore } = require('./lib/sessionStore');
const discord = require('./lib/discord');
const activityLog = require('./lib/activityLog');
const playerTracker = require('./lib/playerTracker');
const watchdog = require('./lib/watchdog');
const users = require('./lib/users');
const steamUpdate = require('./lib/steamUpdate');
const serverSetup = require('./lib/serverSetup');
const bans = require('./lib/bans');
const backupSchedule = require('./lib/backupSchedule');
const restartScheduleCfg = require('./lib/restartSchedule');
const diskSpace = require('./lib/diskSpace');
const backupRestore = require('./lib/backupRestore');
const networkInfo = require('./lib/networkInfo');
const plugins = require('./lib/plugins');
const { updateEnvFile } = require('./lib/envFile');
const paldefenderApi = require('./lib/paldefenderApi');
const logTail = require('./lib/logTail');

// ---------- Config ----------
const PORT = process.env.PORT || 3000;
// SAVE_PATH / BACKUP_DIR sont lus dynamiquement (process.env) là où ils sont utilisés,
// et non figés ici, pour que l'assistant d'installation puisse les définir à chaud.

// Variables nécessaires au fonctionnement normal : on prévient au démarrage plutôt que
// de laisser échouer silencieusement la première fois qu'une route en a besoin.
const REQUIRED_ENV_VARS = ['PALWORLD_API_PASSWORD', 'SAVE_PATH', 'BACKUP_DIR', 'NSSM_PATH'];
const missingEnvVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingEnvVars.length) {
  console.warn(`⚠️  Variables .env manquantes : ${missingEnvVars.join(', ')} — les fonctionnalités concernées échoueront tant qu'elles ne sont pas renseignées.`);
}

// Si SESSION_SECRET n'est pas défini, on génère un secret aléatoire pour cette exécution
// plutôt qu'une valeur fixe connue à l'avance. Les sessions sont déjà en mémoire (perdues
// au redémarrage), donc ça ne casse rien de plus que ce qui est déjà documenté.
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET non défini dans .env : un secret aléatoire a été généré pour cette exécution (tout le monde sera déconnecté à chaque redémarrage du dashboard).');
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  store: new JsonSessionStore(), // sessions persistées : les connexions survivent aux redémarrages
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // pas de HTTPS ici : accès en HTTP direct via IP publique fixe
    sameSite: 'lax', // explicite (et pas seulement le défaut navigateur) : bloque les POST cross-site avec cookie
    maxAge: 1000 * 60 * 60 * 12 // 12h
  }
}));
// La page du dashboard ne doit être servie qu'aux utilisateurs connectés (les JS/CSS restent
// publics, ils ne contiennent rien de sensible). Placé avant express.static, qui servirait
// sinon /index.html à n'importe qui.
app.use((req, res, next) => {
  if (req.path === '/index.html' && !(req.session && req.session.user)) {
    return res.redirect('/login.html');
  }
  next();
});
// index:false — sinon express.static servirait public/index.html pour la racine "/" AVANT
// d'atteindre le garde-fou d'auth ci-dessus et le handler app.get('/') plus bas. Avec index:false,
// GET "/" tombe sur app.get('/') qui redirige vers /login.html si non connecté.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'not_authenticated' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).json({ error: 'forbidden' });
}

// admin OU user : toutes les actions serveur. Le rôle "user" n'est refusé que sur l'installation
// du serveur et la gestion des comptes admin (vérifiées séparément).
function requireManager(req, res, next) {
  const role = req.session && req.session.user && req.session.user.role;
  if (role === 'admin' || role === 'user') return next();
  return res.status(403).json({ error: 'forbidden' });
}

function isAdminReq(req) {
  return req.session && req.session.user && req.session.user.role === 'admin';
}

// ---------- Auth ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'too_many_attempts' }
});

app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!users.verifyPassword(username, password)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const user = users.findUser(username);
  req.session.user = { username: user.username, role: user.role || 'admin' };
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// Changer son propre mot de passe (tout utilisateur connecté, admin ou viewer)
app.post('/api/me/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'password_too_short' });
  if (!users.verifyPassword(req.session.user.username, currentPassword)) {
    return res.status(401).json({ error: 'invalid_current_password' });
  }
  users.upsertUser(req.session.user.username, newPassword);
  activityLog.log(req.session.user.username, 'password-change');
  res.json({ ok: true });
});

// ---------- Gestion des comptes (admin + user, mais un "user" ne touche pas aux admins) ----------
// Un compte "user" peut gérer les comptes user/viewer mais ni créer/modifier/supprimer un admin,
// ni promouvoir quelqu'un admin. Ces garde-fous sont vérifiés côté serveur, pas juste dans l'UI.
app.get('/api/users', requireAuth, requireManager, (req, res) => {
  res.json({ users: users.listUsers(), canManageAdmins: isAdminReq(req) });
});

app.post('/api/users', requireAuth, requireManager, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username_password_required' });
  if (password.length < 6) return res.status(400).json({ error: 'password_too_short' });
  if (role === 'admin' && !isAdminReq(req)) return res.status(403).json({ error: 'admin_required' });
  if (users.findUser(username)) return res.status(409).json({ error: 'already_exists' });
  users.upsertUser(username, password, role);
  activityLog.log(req.session.user.username, 'user-create', username);
  res.json({ ok: true });
});

app.put('/api/users/:username', requireAuth, requireManager, (req, res) => {
  const { username } = req.params;
  const { password, role } = req.body || {};
  if (password && password.length < 6) return res.status(400).json({ error: 'password_too_short' });
  const target = users.findUser(username);
  if (!target) return res.status(404).json({ error: 'not_found' });
  // Un "user" ne peut ni toucher un compte admin, ni promouvoir quelqu'un admin.
  if (!isAdminReq(req) && ((target.role || 'admin') === 'admin' || role === 'admin')) {
    return res.status(403).json({ error: 'admin_required' });
  }
  try {
    if (role && role !== (target.role || 'admin')) users.setRole(username, role);
    if (password) users.upsertUser(username, password);
    activityLog.log(req.session.user.username, 'user-update', username);
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'last_admin') return res.status(400).json({ error: 'last_admin' });
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.delete('/api/users/:username', requireAuth, requireManager, (req, res) => {
  const { username } = req.params;
  if (username === req.session.user.username) return res.status(400).json({ error: 'cannot_delete_self' });
  const target = users.findUser(username);
  if (!target) return res.status(404).json({ error: 'not_found' });
  if (!isAdminReq(req) && (target.role || 'admin') === 'admin') {
    return res.status(403).json({ error: 'admin_required' });
  }
  try {
    users.deleteUser(username);
    activityLog.log(req.session.user.username, 'user-delete', username);
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (err.message === 'last_admin') return res.status(400).json({ error: 'last_admin' });
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- Installation du serveur Palworld (admin uniquement) ----------
const MAX_SETUP_LOG_LINES = 500;
const setupState = { running: false, logs: [], sseClients: [] };

function setupLog(line) {
  const entry = { ts: new Date().toISOString(), line };
  setupState.logs.push(entry);
  if (setupState.logs.length > MAX_SETUP_LOG_LINES) setupState.logs.shift();
  setupState.sseClients.forEach(res => res.write(`data: ${JSON.stringify(entry)}\n\n`));
}

function setupDone(payload) {
  setupState.running = false;
  setupState.sseClients.forEach(res => {
    res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
    res.end();
  });
  setupState.sseClients = [];
}

app.get('/api/setup/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = await serverSetup.getStatus();
    res.json({ ...status, installing: setupState.running });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/api/setup/install', requireAuth, requireAdmin, (req, res) => {
  if (setupState.running) return res.status(409).json({ error: 'install_in_progress' });
  const body = req.body || {};
  if (!body.adminPassword || body.adminPassword.length < 6) {
    return res.status(400).json({ error: 'admin_password_required' });
  }

  const config = serverSetup.normalizeConfig(body);
  setupState.running = true;
  setupState.logs = [];
  activityLog.log(req.session.user.username, 'server-setup-start');
  discord.notify(`🛠️ Installation du serveur Palworld lancée par **${req.session.user.username}**…`);

  serverSetup.runInstall(config, setupLog)
    .then(() => {
      activityLog.log(req.session.user.username, 'server-setup-done');
      discord.notify('✅ Installation du serveur Palworld terminée, le dashboard est prêt à le gérer.');
      setupDone({ ok: true });
    })
    .catch(err => {
      const message = String(err.message || err);
      setupLog(`ERREUR : ${message}`);
      activityLog.log(req.session.user.username, 'server-setup-error', message);
      discord.notify(`❌ Échec de l'installation du serveur Palworld : ${message.slice(0, 200)}`);
      setupDone({ ok: false, error: message });
    });

  res.json({ ok: true, started: true });
});

app.get('/api/setup/stream', requireAuth, requireAdmin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(':ok\n\n');
  setupState.logs.forEach(entry => res.write(`data: ${JSON.stringify(entry)}\n\n`));
  if (!setupState.running) {
    res.write('event: done\ndata: {}\n\n');
    return res.end();
  }
  setupState.sseClients.push(res);
  req.on('close', () => {
    setupState.sseClients = setupState.sseClients.filter(c => c !== res);
  });
});

// ---------- Statut / joueurs ----------
app.get('/api/status', requireAuth, async (req, res) => {
  try {
    const palworldApi = getPalworldApi();
    const [infoRes, playersRes, metricsRes] = await Promise.all([
      palworldApi.get('/v1/api/info'),
      palworldApi.get('/v1/api/players'),
      palworldApi.get('/v1/api/metrics')
    ]);
    if (infoRes.status !== 200) {
      return res.json({ online: false, scheduledRestartAt: scheduledRestart ? scheduledRestart.at : null });
    }
    res.json({
      online: true,
      info: infoRes.data,
      players: playersRes.status === 200 ? playersRes.data.players || [] : [],
      metrics: metricsRes.status === 200 ? metricsRes.data : null,
      scheduledRestartAt: scheduledRestart ? scheduledRestart.at : null
    });
  } catch {
    res.json({ online: false, scheduledRestartAt: scheduledRestart ? scheduledRestart.at : null });
  }
});

// Réglages du monde (lecture seule via l'API de jeu, tout utilisateur connecté)
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const r = await getPalworldApi().get('/v1/api/settings');
    if (r.status !== 200) return res.status(502).json({ error: 'unreachable' });
    res.json({ settings: r.data });
  } catch {
    res.status(502).json({ error: 'unreachable' });
  }
});

// isServiceRunning() (lib/palworldClient.js) échoue "fermé côté watchdog" : en cas d'erreur NSSM
// (chemin incorrect, nom de service différent, aléa...) elle répond `false`, ce qui est le bon
// choix pour le watchdog (ne pas redémarrer sur une erreur d'introspection) mais serait dangereux
// ici — ça laisserait passer une édition alors que le serveur tourne peut-être réellement. On
// combine donc ce signal avec la joignabilité de l'API REST Palworld (même vérification que le
// badge "En ligne" du tableau de bord) et on bloque dès que L'UN des deux indique une activité.
async function isGameServerActive() {
  const [serviceRunning, apiReachable] = await Promise.all([
    isServiceRunning(),
    getPalworldApi().get('/v1/api/info').then(r => r.status === 200).catch(() => false)
  ]);
  return serviceRunning || apiReachable;
}

// ---------- Édition des réglages du monde (PalWorldSettings.ini, admin uniquement) ----------
// Indépendant de l'API de jeu : lit/écrit directement le fichier. L'écriture n'est autorisée
// que serveur éteint — Palworld ne relit le fichier qu'au démarrage, modifier à chaud serait
// trompeur (et risquerait d'être écrasé).
app.get('/api/settings/file', requireAuth, requireManager, async (req, res) => {
  const file = serverSetup.getSettingsFilePath();
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'settings_file_not_found' });
  const settings = serverSetup.parseIniOptions(fs.readFileSync(file, 'utf-8'));
  if (!settings) return res.status(500).json({ error: 'settings_unreadable' });
  res.json({ settings, running: await isGameServerActive() });
});

app.post('/api/settings/file', requireAuth, requireManager, async (req, res) => {
  const changes = (req.body && req.body.changes) || {};
  const keys = Object.keys(changes);
  if (!keys.length) return res.status(400).json({ error: 'no_changes' });
  if (await isGameServerActive()) return res.status(409).json({ error: 'server_running' });

  const file = serverSetup.getSettingsFilePath();
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'settings_file_not_found' });
  let content = fs.readFileSync(file, 'utf-8');
  const existing = serverSetup.parseIniOptions(content) || [];
  const byKey = Object.fromEntries(existing.map(o => [o.key, o]));

  // Uniquement des clés déjà présentes (pas d'injection de clés arbitraires), et pour les
  // valeurs non-quotées, aucun caractère qui casserait le format OptionSettings=(...).
  for (const key of keys) {
    const target = byKey[key];
    if (!target) return res.status(400).json({ error: 'unknown_key', key });
    if (!target.quoted && /[,()"\r\n]/.test(String(changes[key]))) {
      return res.status(400).json({ error: 'invalid_value', key });
    }
  }

  keys.forEach(key => {
    content = serverSetup.setIniOption(content, key, String(changes[key]), { quoted: byKey[key].quoted });
  });

  // Garde-fou anti-corruption : si l'écriture avait cassé la ligne OptionSettings (clé perdue,
  // format invalide), Palworld régénérerait tout aux valeurs par défaut au démarrage. On relit
  // donc le résultat AVANT d'écrire et on refuse si le compte de clés a changé ou si une valeur
  // modifiée n'est pas exactement celle attendue.
  const reparsed = serverSetup.parseIniOptions(content);
  const reByKey = reparsed ? Object.fromEntries(reparsed.map(o => [o.key, o])) : null;
  const intact = reparsed && reparsed.length === existing.length
    && keys.every(k => reByKey[k] && reByKey[k].value === String(changes[k]));
  if (!intact) return res.status(500).json({ error: 'integrity_check_failed' });

  fs.writeFileSync(file, content);
  activityLog.log(req.session.user.username, 'settings-change', keys.join(', '));
  discord.notify(`⚙️ Réglages du monde modifiés par **${req.session.user.username}** : ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '…' : ''}`);
  res.json({ ok: true, changed: keys.length });
});

// ---------- Démarrage / arrêt (admin uniquement) ----------
// Verrou : un seul cycle de redémarrage à la fois (manuel ou planifié). Sans lui, un
// redémarrage manuel déclenché pendant la fenêtre d'avertissement du redémarrage planifié
// ferait se chevaucher deux séquences stop/update/start sur le même service.
let restartInProgress = false;
// Redémarrage programmé en attente (avec avertissements) : { at, by, minutes, cancel }
let scheduledRestart = null;

// Vrai si un redémarrage est en cours OU programmé : bloque les autres actions serveur.
function restartLocked() {
  return restartInProgress || !!scheduledRestart;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Le service NSSM du serveur est configuré avec AppExit=Restart : NSSM relance automatiquement le
// process s'il sort (protection anti-crash). Problème : un arrêt volontaire via l'API Palworld fait
// sortir le process de lui-même, ce que NSSM interprète comme un crash → il le relance ~5 s plus
// tard. Plutôt que de courir après avec un `nssm stop` différé (dépendant du timing, peu fiable),
// on DÉSARME la relance auto le temps de l'arrêt/redémarrage volontaire, et on la RÉARME au
// démarrage. `nssm set` échoue silencieusement en no-op si le service n'existe pas (mode dev/mock).
function setAutoRestart(enabled) {
  return runNssm(['set', getServiceName(), 'AppExit', 'Default', enabled ? 'Restart' : 'Exit'])
    .catch(() => {});
}

// Démarre le service en réarmant d'abord la relance anti-crash (désarmée par le dernier arrêt).
async function startService() {
  await setAutoRestart(true);
  return runNssm(['start', getServiceName()]);
}

// Programme un redémarrage dans `minutes` minutes, avec des annonces d'avertissement décroissantes
// aux joueurs. Annulable via /api/cancel-restart. Chaque annonce et le redémarrage final sont
// posés en setTimeout indépendants pour pouvoir tous les annuler d'un coup.
function scheduleRestart(minutes, by) {
  const api = getPalworldApi();
  const announce = msg => api.post('/v1/api/announce', { message: msg }).catch(() => {});
  const timers = [];
  const marks = [...new Set([minutes, ...[30, 15, 10, 5, 3, 1].filter(m => m < minutes)])];

  marks.forEach(mark => {
    timers.push(setTimeout(
      () => announce(`Redémarrage du serveur dans ${mark} minute${mark > 1 ? 's' : ''}.`),
      (minutes - mark) * 60000
    ));
  });

  timers.push(setTimeout(async () => {
    scheduledRestart = null;
    restartInProgress = true;
    activityLog.log('scheduler', 'restart');
    await announce('Redémarrage du serveur maintenant.');
    try {
      await runRestartSequence('Redémarrage programmé depuis le dashboard.', 10);
    } finally {
      restartInProgress = false;
    }
  }, minutes * 60000));

  scheduledRestart = {
    at: Date.now() + minutes * 60000,
    by,
    minutes,
    cancel: () => timers.forEach(clearTimeout)
  };
}

// Séquence commune aux redémarrages manuel et planifié : arrêt propre (avec arrêt forcé en
// secours), vérification de mise à jour SteamCMD, puis relance du service.
async function runRestartSequence(stopMessage, waittime = 10) {
  await setAutoRestart(false); // désarme la relance auto le temps de la manip (réarmée par startService)
  try {
    await gracefulStop(stopMessage, waittime);
  } catch {
    try { await runNssm(['stop', getServiceName()]); } catch (_) {}
  }
  await sleep((waittime + 5) * 1000);
  // S'assure que le process est bien sorti avant que SteamCMD ne touche aux fichiers.
  try { await runNssm(['stop', getServiceName()]); } catch (_) {}
  try {
    const result = await steamUpdate.runUpdate();
    activityLog.log('scheduler', 'steam-update-check', result.updated ? 'mise à jour appliquée' : 'déjà à jour');
    if (result.updated) discord.notify('⬆️ Le serveur a été mis à jour vers la dernière version.');
  } catch (err) {
    console.error('Vérification SteamCMD échouée:', err.message || err);
    discord.notify(`⚠️ Vérification de mise à jour échouée, redémarrage sans update (${String(err.message || err).slice(0, 150)})`);
  }
  try { await startService(); } catch (_) {}
}

app.post('/api/start', requireAuth, requireManager, async (req, res) => {
  if (restartLocked()) return res.status(409).json({ error: 'restart_in_progress' });
  try {
    await startService();
    activityLog.log(req.session.user.username, 'start');
    discord.notify(`▶️ Serveur démarré par **${req.session.user.username}**`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/stop', requireAuth, requireManager, async (req, res) => {
  if (restartLocked()) return res.status(409).json({ error: 'restart_in_progress' });
  const waittime = 10;
  await setAutoRestart(false); // arrêt volontaire : NSSM ne doit pas relancer quand le process sort
  try {
    await gracefulStop('Arrêt du serveur demandé depuis le dashboard.', waittime);
    activityLog.log(req.session.user.username, 'stop');
    discord.notify(`⏹️ Arrêt du serveur demandé par **${req.session.user.username}**`);
    res.json({ ok: true, waittime });
  } catch (err) {
    try {
      await runNssm(['stop', getServiceName()]);
      activityLog.log(req.session.user.username, 'stop-forced');
      discord.notify(`⏹️ Arrêt forcé du serveur par **${req.session.user.username}** (API injoignable)`);
      res.json({ ok: true, forced: true });
    } catch (nssmErr) {
      await setAutoRestart(true); // échec de l'arrêt : ne pas laisser l'anti-crash désarmé
      res.status(500).json({ error: String(nssmErr) });
    }
  }
});

app.post('/api/restart', requireAuth, requireManager, async (req, res) => {
  if (restartLocked()) return res.status(409).json({ error: 'restart_in_progress' });
  restartInProgress = true;
  const waittime = 10;
  activityLog.log(req.session.user.username, 'restart');
  discord.notify(`🔄 Redémarrage demandé par **${req.session.user.username}** (vérification de mise à jour incluse)…`);
  res.json({ ok: true, waittime });
  try {
    await runRestartSequence('Redémarrage du serveur demandé depuis le dashboard.', waittime);
  } finally {
    restartInProgress = false;
  }
});

// ---------- Annonces / kick (admin uniquement) ----------
app.post('/api/announce', requireAuth, requireManager, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message_required' });
  try {
    await getPalworldApi().post('/v1/api/announce', { message });
    activityLog.log(req.session.user.username, 'announce', message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/kick', requireAuth, requireManager, async (req, res) => {
  const { userid, message } = req.body || {};
  if (!userid) return res.status(400).json({ error: 'userid_required' });
  try {
    await getPalworldApi().post('/v1/api/kick', { userid, message: message || 'Kick depuis le dashboard' });
    activityLog.log(req.session.user.username, 'kick', userid);
    discord.notify(`👢 Joueur exclu par **${req.session.user.username}**`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------- Ban / unban (admin uniquement) ----------
app.get('/api/bans', requireAuth, requireManager, (req, res) => {
  res.json({ bans: bans.list() });
});

app.post('/api/ban', requireAuth, requireManager, async (req, res) => {
  const { userid, name } = req.body || {};
  if (!userid) return res.status(400).json({ error: 'userid_required' });
  try {
    await getPalworldApi().post('/v1/api/ban', { userid });
    await bans.add(userid, name, req.session.user.username);
    activityLog.log(req.session.user.username, 'ban', name || userid);
    discord.notify(`🔨 **${name || userid}** banni par **${req.session.user.username}**`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/unban', requireAuth, requireManager, async (req, res) => {
  const { userid } = req.body || {};
  if (!userid) return res.status(400).json({ error: 'userid_required' });
  try {
    await getPalworldApi().post('/v1/api/unban', { userid });
    await bans.remove(userid);
    activityLog.log(req.session.user.username, 'unban', userid);
    discord.notify(`♻️ Joueur débanni par **${req.session.user.username}**`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------- Sauvegarde du monde immédiate (sans zip) & arrêt forcé (admin uniquement) ----------
app.post('/api/save', requireAuth, requireManager, async (req, res) => {
  try {
    await getPalworldApi().post('/v1/api/save', {});
    activityLog.log(req.session.user.username, 'save');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/force-stop', requireAuth, requireManager, async (req, res) => {
  if (restartLocked()) return res.status(409).json({ error: 'restart_in_progress' });
  try {
    // Arrêt immédiat via NSSM directement (intentionnel → pas de relance auto), plus fiable que
    // l'API de jeu quand on force l'arrêt justement parce que le serveur ne répond plus.
    await setAutoRestart(false);
    await runNssm(['stop', getServiceName()]);
    activityLog.log(req.session.user.username, 'force-stop');
    discord.notify(`🛑 Arrêt forcé (immédiat) du serveur par **${req.session.user.username}**`);
    res.json({ ok: true });
  } catch (err) {
    await setAutoRestart(true); // échec : ne pas laisser l'anti-crash désarmé
    res.status(500).json({ error: String(err) });
  }
});

// ---------- Mise à jour du serveur (admin uniquement) ----------
let updateCheckInProgress = false;

app.get('/api/update/check', requireAuth, requireManager, async (req, res) => {
  if (updateCheckInProgress) return res.status(409).json({ error: 'check_in_progress' });
  updateCheckInProgress = true;
  try {
    const result = await steamUpdate.checkForUpdate();
    activityLog.log(req.session.user.username, 'update-check',
      result.updateAvailable ? `disponible (${result.installedBuild} → ${result.latestBuild})` : 'à jour');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    updateCheckInProgress = false;
  }
});

app.post('/api/update/apply', requireAuth, requireManager, async (req, res) => {
  if (restartLocked()) return res.status(409).json({ error: 'restart_in_progress' });
  restartInProgress = true;
  activityLog.log(req.session.user.username, 'update-apply');
  discord.notify(`⬆️ Mise à jour du serveur lancée par **${req.session.user.username}**…`);
  const wasRunning = await isServiceRunning();
  res.json({ ok: true, wasRunning });
  try {
    if (wasRunning) {
      // Serveur en route : cycle complet arrêt propre → update → relance
      await runRestartSequence('Mise à jour du serveur : redémarrage.', 10);
    } else {
      // Serveur arrêté : on met juste à jour, sans le démarrer (il a été arrêté exprès)
      try {
        const result = await steamUpdate.runUpdate();
        activityLog.log('scheduler', 'steam-update-check', result.updated ? 'mise à jour appliquée' : 'déjà à jour');
        discord.notify('⬆️ Mise à jour terminée (serveur laissé arrêté).');
      } catch (err) {
        discord.notify(`❌ Échec de la mise à jour : ${String(err.message || err).slice(0, 150)}`);
      }
    }
  } finally {
    restartInProgress = false;
  }
});

// ---------- Redémarrage programmé avec avertissements (admin uniquement) ----------
app.post('/api/schedule-restart', requireAuth, requireManager, (req, res) => {
  if (restartLocked()) return res.status(409).json({ error: 'restart_in_progress' });
  const minutes = Math.max(1, Math.min(120, parseInt(req.body && req.body.minutes, 10) || 5));
  scheduleRestart(minutes, req.session.user.username);
  activityLog.log(req.session.user.username, 'restart-scheduled', `${minutes} min`);
  discord.notify(`🕒 Redémarrage programmé dans ${minutes} min par **${req.session.user.username}**`);
  res.json({ ok: true, minutes, at: scheduledRestart.at });
});

app.post('/api/cancel-restart', requireAuth, requireManager, async (req, res) => {
  if (!scheduledRestart) return res.status(400).json({ error: 'no_scheduled_restart' });
  scheduledRestart.cancel();
  scheduledRestart = null;
  activityLog.log(req.session.user.username, 'restart-cancelled');
  await getPalworldApi().post('/v1/api/announce', { message: 'Redémarrage programmé annulé.' }).catch(() => {});
  discord.notify(`✅ Redémarrage programmé annulé par **${req.session.user.username}**`);
  res.json({ ok: true });
});

// Planning du redémarrage récurrent (lecture pour tous, modification pour admin/user)
app.get('/api/restart/schedule', requireAuth, (req, res) => {
  res.json({ schedule: restartScheduleCfg.load(), crons: restartScheduleCfg.toCronExpressions() });
});

app.post('/api/restart/schedule', requireAuth, requireManager, (req, res) => {
  const saved = restartScheduleCfg.save(req.body || {});
  rescheduleRestarts();
  activityLog.log(req.session.user.username, 'restart-schedule-change',
    saved.enabled ? `${saved.times.join(', ')} — ${saved.days.length}j/sem` : 'désactivé');
  res.json({ ok: true, schedule: saved, crons: restartScheduleCfg.toCronExpressions(saved) });
});

// ---------- Sauvegardes (admin déclenche, tout le monde peut consulter/télécharger) ----------
function makeBackup() {
  return new Promise((resolve, reject) => {
    const savePath = process.env.SAVE_PATH;
    const backupDir = process.env.BACKUP_DIR;
    if (!savePath || !fs.existsSync(savePath)) {
      return reject(new Error('SAVE_PATH introuvable, vérifie ta config .env'));
    }
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${stamp}.zip`;
    const outPath = path.join(backupDir, filename);
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(filename));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(savePath, false);
    archive.finalize();
  });
}

function pruneBackups() {
  const backupDir = process.env.BACKUP_DIR;
  if (!fs.existsSync(backupDir)) return;
  const keepCount = backupSchedule.load().keepCount;
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  files.slice(keepCount).forEach(({ f }) => fs.unlinkSync(path.join(backupDir, f)));
}

app.post('/api/backup', requireAuth, requireManager, async (req, res) => {
  try {
    await getPalworldApi().post('/v1/api/save', {}).catch(() => {});
    const filename = await makeBackup();
    pruneBackups();
    activityLog.log(req.session.user.username, 'backup', filename);
    discord.notify(`💾 Sauvegarde manuelle effectuée par **${req.session.user.username}**`);
    res.json({ ok: true, filename });
  } catch (err) {
    discord.notify(`❌ Échec de la sauvegarde manuelle : ${err.message || err}`);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get('/api/backups', requireAuth, (req, res) => {
  const backupDir = process.env.BACKUP_DIR;
  if (!fs.existsSync(backupDir)) return res.json({ backups: [] });
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.zip'))
    .map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return { filename: f, size: stat.size, date: stat.mtime };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ backups });
});

app.get('/api/backups/:filename', requireAuth, (req, res) => {
  if (!process.env.BACKUP_DIR) return res.status(404).json({ error: 'not_found' });
  const filename = path.basename(req.params.filename); // anti path traversal
  const filePath = path.join(process.env.BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not_found' });
  res.download(filePath);
});

// Restauration d'une sauvegarde (admin/user, serveur éteint uniquement). Écrase SAVE_PATH avec
// le contenu du zip choisi ; une sauvegarde de sécurité du monde actuel est prise avant, pour
// pouvoir revenir en arrière en cas d'erreur.
app.post('/api/backups/:filename/restore', requireAuth, requireManager, async (req, res) => {
  if (await isGameServerActive()) return res.status(409).json({ error: 'server_running' });
  const savePath = process.env.SAVE_PATH;
  const backupDir = process.env.BACKUP_DIR;
  if (!savePath || !backupDir) return res.status(400).json({ error: 'not_configured' });
  const filename = path.basename(req.params.filename); // anti path traversal
  const backupZipPath = path.join(backupDir, filename);
  if (!fs.existsSync(backupZipPath)) return res.status(404).json({ error: 'not_found' });

  try {
    const { safetyFilename } = await backupRestore.restoreBackup({ backupZipPath, savePath, backupDir });
    activityLog.log(req.session.user.username, 'backup-restore', filename);
    discord.notify(`♻️ Sauvegarde **${filename}** restaurée par **${req.session.user.username}**` +
      (safetyFilename ? ` (monde précédent conservé dans ${safetyFilename})` : ''));
    res.json({ ok: true, safetyFilename });
  } catch (err) {
    activityLog.log(req.session.user.username, 'backup-restore-error', String(err.message || err));
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Planning des sauvegardes automatiques (lecture pour tous, modification pour admin/user)
app.get('/api/backup/schedule', requireAuth, (req, res) => {
  res.json({ schedule: backupSchedule.load(), crons: backupSchedule.toCronExpressions() });
});

app.post('/api/backup/schedule', requireAuth, requireManager, (req, res) => {
  const saved = backupSchedule.save(req.body || {});
  rescheduleBackups();
  activityLog.log(req.session.user.username, 'backup-schedule-change',
    saved.enabled ? `${saved.times.join(', ')} — ${saved.days.length}j/sem` : 'désactivé');
  res.json({ ok: true, schedule: saved, crons: backupSchedule.toCronExpressions(saved) });
});

// ---------- Journal d'activité (lecture pour tout le monde) ----------
// Adresses à partager avec les amis (locale pour le réseau domestique, publique pour internet
// après redirection de port sur la box).
// Port du jeu (pas celui du dashboard) : lu en direct dans PalWorldSettings.ini, pour refléter
// la réalité même si modifié depuis l'installation initiale (via l'onglet Réglages ou à la main).
function getGamePort() {
  const file = serverSetup.getSettingsFilePath();
  if (!file || !fs.existsSync(file)) return null;
  const options = serverSetup.parseIniOptions(fs.readFileSync(file, 'utf-8'));
  const entry = options && options.find(o => o.key === 'PublicPort');
  return entry ? entry.value : null;
}

app.get('/api/network-info', requireAuth, async (req, res) => {
  res.json({
    localIp: networkInfo.getLocalIp(),
    publicIp: await networkInfo.getPublicIp(),
    port: getGamePort()
  });
});

app.get('/api/activity', requireAuth, (req, res) => {
  res.json({ entries: activityLog.list(50) });
});

// ---------- Console serveur (admin/user uniquement : peut contenir des IP de joueurs) ----------
// Alimentée par la redirection stdout/stderr configurée sur le service NSSM (voir
// lib/serverSetup.js setupNssmService) : disponible dès que le service a été (ré)installé avec
// cette version. Sur une install plus ancienne, clique "(Ré)installer les services" pour l'activer.
app.get('/api/console', requireAuth, requireManager, (req, res) => {
  const logPath = serverSetup.getCurrentConsoleLogPath();
  if (!logPath) return res.status(404).json({ error: 'not_configured' });
  const lines = logTail.readTail(logPath, 100 * 1024);
  if (lines === null) return res.status(404).json({ error: 'log_not_found' });
  res.json({ lines: lines.slice(-300), path: logPath });
});

// ---------- Plugins (UE4SS / PalDefender), admin/user, serveur éteint pour installer/retirer ----------
app.get('/api/plugins/status', requireAuth, requireManager, (req, res) => {
  res.json({ ue4ss: plugins.getStatus('ue4ss'), paldefender: plugins.getStatus('paldefender') });
});

app.post('/api/plugins/:name/install', requireAuth, requireManager, async (req, res) => {
  const name = req.params.name;
  if (!plugins.PLUGINS[name]) return res.status(404).json({ error: 'unknown_plugin' });
  if (await isGameServerActive()) return res.status(409).json({ error: 'server_running' });
  try {
    const version = await plugins.install(name);
    activityLog.log(req.session.user.username, 'plugin-install', `${plugins.PLUGINS[name].label} ${version}`);
    discord.notify(`🧩 **${plugins.PLUGINS[name].label} ${version}** installé par **${req.session.user.username}**`);
    res.json({ ok: true, version });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post('/api/plugins/:name/uninstall', requireAuth, requireManager, async (req, res) => {
  const name = req.params.name;
  if (!plugins.PLUGINS[name]) return res.status(404).json({ error: 'unknown_plugin' });
  if (await isGameServerActive()) return res.status(409).json({ error: 'server_running' });
  plugins.uninstall(name);
  activityLog.log(req.session.user.username, 'plugin-uninstall', plugins.PLUGINS[name].label);
  res.json({ ok: true });
});

// ---------- Commandes admin PalDefender (admin uniquement — pas les comptes "user") ----------
// Pas d'auto-configuration côté dashboard (pas de génération de jeton ni d'écriture dans les
// fichiers de PalDefender) : l'admin suit la doc officielle de PalDefender pour activer
// RESTConfig.json et créer un jeton lui-même, puis le colle ici. Le dashboard se contente
// d'appeler l'API avec ce jeton — un simple appel HTTP, rien de plus.
app.get('/api/paldefender/config', requireAuth, requireAdmin, (req, res) => {
  res.json({
    configured: !!process.env.PALDEFENDER_API_TOKEN,
    url: process.env.PALDEFENDER_API_URL || 'http://127.0.0.1:17993'
  });
});

app.post('/api/paldefender/config', requireAuth, requireAdmin, (req, res) => {
  const { token, url } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token_required' });
  updateEnvFile({ PALDEFENDER_API_TOKEN: token, PALDEFENDER_API_URL: (url || 'http://127.0.0.1:17993').trim() });
  activityLog.log(req.session.user.username, 'paldefender-token-set');
  res.json({ ok: true });
});

app.post('/api/paldefender/command', requireAuth, requireAdmin, async (req, res) => {
  const { command, target, fields } = req.body || {};
  const cmd = paldefenderApi.COMMANDS[command];
  if (!cmd) return res.status(400).json({ error: 'unknown_command' });
  if ((cmd.needsPlayer || cmd.needsIp) && !target) return res.status(400).json({ error: 'target_required' });
  try {
    const result = await cmd.run(target, fields || {});
    activityLog.log(req.session.user.username, 'paldefender-command', `${cmd.label}${target ? ' — ' + target : ''}`);
    res.json({ ok: true, result });
  } catch (err) {
    const message = String(err.message || err);
    if (message === 'paldefender_not_configured') return res.status(409).json({ error: 'not_configured' });
    res.status(500).json({ error: message });
  }
});

// ---------- Historique des joueurs (lecture pour tout le monde) ----------
app.get('/api/players/history', requireAuth, (req, res) => {
  res.json({ sessions: playerTracker.recentSessions(30), totals: playerTracker.totals() });
});

// ---------- Tâches planifiées ----------
// Sauvegardes : (re)programmées dynamiquement depuis la config éditable (data/backup-schedule.json),
// une tâche cron par horaire. rescheduleBackups() est rappelé quand la config change via l'API.
let backupJobs = [];
function rescheduleBackups() {
  backupJobs.forEach(job => job.stop());
  backupJobs = [];
  backupSchedule.toCronExpressions().forEach(expr => {
    if (!cron.validate(expr)) return;
    backupJobs.push(cron.schedule(expr, () => {
      makeBackup()
        .then(filename => {
          pruneBackups();
          activityLog.log('scheduler', 'backup', filename);
        })
        .catch(err => {
          console.error('Backup planifiée échouée:', err.message);
          discord.notify(`❌ Sauvegarde planifiée échouée : ${err.message}`);
        });
    }));
  });
}
rescheduleBackups();

// Redémarrages récurrents : (re)programmés dynamiquement depuis la config éditable
// (data/restart-schedule.json), une tâche cron par horaire. Au déclenchement, réutilise
// scheduleRestart() (mêmes avertissements décroissants, même bannière/annulation que le
// redémarrage ponctuel du tableau de bord) — donc annulable depuis l'UI comme n'importe quel
// autre redémarrage programmé.
let restartJobs = [];
function rescheduleRestarts() {
  restartJobs.forEach(job => job.stop());
  restartJobs = [];
  const cfg = restartScheduleCfg.load();
  restartScheduleCfg.toCronExpressions(cfg).forEach(expr => {
    if (!cron.validate(expr)) return;
    restartJobs.push(cron.schedule(expr, () => {
      if (restartLocked()) {
        activityLog.log('scheduler', 'restart-skipped', 'un redémarrage était déjà en cours');
        return;
      }
      activityLog.log('scheduler', 'restart-scheduled', `${cfg.warningMinutes} min (récurrent)`);
      discord.notify(`🕒 Redémarrage automatique programmé dans ${cfg.warningMinutes} min…`);
      scheduleRestart(cfg.warningMinutes, 'scheduler');
    }));
  });
}
rescheduleRestarts();

// ---------- Surveillance de l'espace disque ----------
const DISK_SPACE_WARN_MB = parseInt(process.env.DISK_SPACE_WARN_MB || '2048', 10);
// Mémorise les chemins déjà signalés sous le seuil, pour ne notifier qu'au moment où l'on
// franchit le seuil (pas à chaque vérification périodique tant qu'on reste bas).
let diskSpaceLow = {};

function checkDiskSpace() {
  const dirs = [...new Set([process.env.BACKUP_DIR, process.env.SAVE_PATH].filter(Boolean))];
  return dirs.map(dir => {
    const info = diskSpace.freeSpace(dir);
    if (!info) return { path: dir, freeBytes: null, totalBytes: null, low: false };
    const low = info.freeBytes < DISK_SPACE_WARN_MB * 1024 * 1024;
    const freeMb = Math.round(info.freeBytes / 1024 / 1024);
    if (low && !diskSpaceLow[dir]) {
      diskSpaceLow[dir] = true;
      activityLog.log('scheduler', 'disk-space-low', `${dir} — ${freeMb} Mo restants`);
      discord.notify(`⚠️ Espace disque faible sur \`${dir}\` : ${freeMb} Mo restants (seuil ${DISK_SPACE_WARN_MB} Mo).`);
    } else if (!low && diskSpaceLow[dir]) {
      delete diskSpaceLow[dir];
      discord.notify(`✅ Espace disque de nouveau suffisant sur \`${dir}\` (${freeMb} Mo).`);
    }
    return { path: dir, freeBytes: info.freeBytes, totalBytes: info.totalBytes, low };
  });
}

app.get('/api/disk-space', requireAuth, (req, res) => {
  res.json({ warnThresholdMb: DISK_SPACE_WARN_MB, disks: checkDiskSpace() });
});

checkDiskSpace(); // vérification immédiate au démarrage
setInterval(checkDiskSpace, 30 * 60 * 1000);

// Suivi des joueurs (sessions/temps de jeu) et watchdog anti-crash tournent en continu
playerTracker.start(60000);
watchdog.start();

// ---------- Pages ----------
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Palworld dashboard démarré sur le port ${PORT}`);
});
