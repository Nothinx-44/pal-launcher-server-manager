const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const { runNssm, getNssmPath, getServiceName } = require('./palworldClient');
const { updateEnvFile } = require('./envFile');
const { downloadFile, extractZip } = require('./download');
const { readJson, writeJson } = require('./jsonStore');
const { HOME } = require('./paths');

// Config du serveur mémorisée après une installation réussie (sans les mots de passe), pour
// pouvoir (ré)installer les services plus tard sans re-télécharger le serveur.
const SERVER_CONFIG_FILE = path.join(HOME, 'server-config.json');

function saveServerConfig(config) {
  const { adminPassword, serverPassword, ...safe } = config;
  writeJson(SERVER_CONFIG_FILE, safe);
}

function getSavedConfig() {
  return readJson(SERVER_CONFIG_FILE, null);
}

const APP_ID = '2394010';
const STEAMCMD_ZIP_URL = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip';
const FIREWALL_RULE_NAME = 'Palworld Server';

// ---------- Utilitaires ----------

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// PalWorldSettings.ini stocke tous les réglages sur une seule ligne
// OptionSettings=(Cle1=val1,Cle2="val2",...). On remplace uniquement la valeur de la clé visée
// en s'ancrant sur le délimiteur précédent ("(" ou ",") pour ne pas confondre deux clés dont
// l'une est un suffixe de l'autre (ex: PublicPort / RESTAPIPort).
function setIniOption(content, key, value, { quoted = false } = {}) {
  const formattedValue = quoted ? `"${String(value).replace(/"/g, '')}"` : String(value);
  const pattern = new RegExp(`([,(]${escapeRegex(key)}=)("[^"]*"|[^,)]*)`);
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${formattedValue}`);
  }
  // Clé absente (ne devrait pas arriver sur un fichier généré par le serveur) : on l'ajoute
  // juste avant la parenthèse fermante d'OptionSettings.
  return content.replace(/^OptionSettings=\((.*)\)$/m, (_, inner) => `OptionSettings=(${inner},${key}=${formattedValue})`);
}

// Chemin du fichier console.log courant (vide si PALWORLD_INSTALL_DIR non configuré).
function getCurrentConsoleLogPath() {
  const serverDir = process.env.PALWORLD_INSTALL_DIR || '';
  return serverDir ? getConsoleLogPath(serverDir) : '';
}

// Chemin du PalWorldSettings.ini du serveur installé (vide si PALWORLD_INSTALL_DIR non configuré).
function getSettingsFilePath() {
  const serverDir = process.env.PALWORLD_INSTALL_DIR || '';
  return serverDir ? path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer', 'PalWorldSettings.ini') : '';
}

// Découpe le contenu de OptionSettings=(Cle=val,Cle2="val2",...) en couples clé/valeur, en
// respectant les virgules à l'intérieur des valeurs entre guillemets. Renvoie null si la ligne
// OptionSettings est introuvable.
function parseIniOptions(content) {
  const m = String(content).match(/^OptionSettings=\((.*)\)\s*$/m);
  if (!m) return null;
  const out = [];
  let cur = '';
  let inQuotes = false;
  const push = () => {
    const eq = cur.indexOf('=');
    if (eq > 0) {
      const key = cur.slice(0, eq).trim();
      let value = cur.slice(eq + 1).trim();
      const quoted = value.startsWith('"') && value.endsWith('"') && value.length >= 2;
      if (quoted) value = value.slice(1, -1);
      out.push({ key, value, quoted });
    }
    cur = '';
  };
  for (const ch of m[1]) {
    if (ch === '"') { inQuotes = !inQuotes; cur += ch; }
    else if (ch === ',' && !inQuotes) push();
    else cur += ch;
  }
  push();
  return out;
}

function applyIniSettings(iniPath, config) {
  let content = fs.readFileSync(iniPath, 'utf-8');
  content = setIniOption(content, 'ServerName', config.serverName, { quoted: true });
  content = setIniOption(content, 'ServerPassword', config.serverPassword || '', { quoted: true });
  content = setIniOption(content, 'AdminPassword', config.adminPassword, { quoted: true });
  content = setIniOption(content, 'ServerPlayerMaxNum', config.maxPlayers);
  content = setIniOption(content, 'PublicPort', config.port);
  content = setIniOption(content, 'RESTAPIEnabled', 'True');
  content = setIniOption(content, 'RESTAPIPort', config.restApiPort);
  fs.writeFileSync(iniPath, content);
}

function isElevated() {
  return new Promise(resolve => {
    execFile('net', ['session'], error => resolve(!error));
  });
}

// steamcmd peut prendre plusieurs minutes (12-15 Go) : spawn + streaming ligne à ligne au lieu
// d'execFile (qui bufferise tout jusqu'à la fin) pour donner une vraie progression en direct.
function runSteamCmdUpdate(steamCmdExe, serverDir, onLog) {
  return new Promise((resolve, reject) => {
    const proc = spawn(steamCmdExe, ['+force_install_dir', serverDir, '+login', 'anonymous', '+app_update', APP_ID, 'validate', '+quit']);
    let buffer = '';
    const handleData = data => {
      buffer += data.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach(line => { if (line.trim()) onLog(line.trim()); });
    };
    proc.stdout.on('data', handleData);
    proc.stderr.on('data', handleData);
    proc.on('error', reject);
    // On renvoie le code de sortie sans juger : SteamCMD renvoie fréquemment des codes non-nuls
    // (7, 8…) même en cas de succès — notamment au 1er lancement, où il se met à jour lui-même
    // puis se relance. C'est l'appelant qui valide le vrai résultat via la présence de PalServer.exe.
    proc.on('close', code => resolve(code));
  });
}

// PalServer.exe n'est qu'un lanceur : il démarre un process enfant (PalServer-Win64-Shipping-Cmd.exe)
// qui, lui, ouvre le port du jeu. Un simple proc.kill() laisserait cet enfant tourner (port 8211
// occupé, fenêtre serveur ouverte). On tue donc tout l'arbre de process via taskkill /T.
function killTree(pid) {
  try { execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => {}); } catch (_) {}
}

function firstLaunch(serverDir, onLog) {
  return new Promise((resolve, reject) => {
    const exePath = path.join(serverDir, 'PalServer.exe');
    const configDir = path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer');
    const proc = spawn(exePath, [], { cwd: serverDir });
    const maxWaitMs = 45000;
    const startedAt = Date.now();

    const stop = () => { clearInterval(timer); killTree(proc.pid); proc.kill(); };
    const timer = setInterval(() => {
      if (fs.existsSync(configDir)) {
        stop();
        onLog('Config générée.');
        resolve();
      } else if (Date.now() - startedAt > maxWaitMs) {
        stop();
        onLog('Config non détectée après 45s, on continue quand même.');
        resolve();
      }
    }, 2000);

    proc.on('error', err => { clearInterval(timer); reject(err); });
  });
}

// Chemin du fichier où NSSM redirige la sortie console de PalServer.exe (stdout+stderr) : c'est
// ce que l'onglet "Activité" du dashboard affiche en tant que "console serveur". On contrôle nous
// même ce fichier (plutôt que de deviner où Palworld écrit ses propres logs internes), donc c'est
// garanti disponible dès que le service a été (ré)installé une fois avec cette version.
function getConsoleLogPath(serverDir) {
  return path.join(path.dirname(serverDir), 'console.log');
}

async function setupNssmService({ serverDir, serverName, port, maxPlayers, queryPort }, onLog) {
  const serviceName = getServiceName();
  let exists = true;
  try {
    await runNssm(['status', serviceName]);
  } catch {
    exists = false;
  }

  // -queryport : port Steam query (server browser / A2S), DISTINCT du port de jeu (-port). Son
  // défaut Palworld (27015) entre souvent en collision avec d'autres serveurs (Source, Rust...)
  // déjà présents sur la même machine — configurable pour éviter ça.
  const appParams = `-ServerName="${serverName}" -port=${port} -queryport=${queryPort} -players=${maxPlayers} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS EpicApp=PalServer`;
  const logPath = getConsoleLogPath(serverDir);

  if (!exists) {
    onLog(`Création du service Windows "${serviceName}"...`);
    await runNssm(['install', serviceName, path.join(serverDir, 'PalServer.exe')]);
    await runNssm(['set', serviceName, 'AppParameters', appParams]);
    await runNssm(['set', serviceName, 'AppDirectory', serverDir]);
    await runNssm(['set', serviceName, 'Start', 'SERVICE_DEMAND_START']);
    await runNssm(['set', serviceName, 'AppExit', 'Default', 'Restart']);
    await runNssm(['set', serviceName, 'AppRestartDelay', '5000']);
    onLog('Service créé (démarrage manuel, à contrôler depuis le dashboard).');
  } else {
    onLog(`Service "${serviceName}" déjà existant, mise à jour des paramètres...`);
    await runNssm(['set', serviceName, 'AppParameters', appParams]);
  }

  // Redirection de la console + rotation : appliquée aussi bien à la création qu'à une
  // réinstallation, pour que "(Ré)installer les services" active la console viewer sur un
  // serveur déjà en place.
  await configureConsoleRedirect(serviceName, logPath);
}

// Redirection stdout/stderr du service vers console.log + rotation (10 Mo, en continu même
// service démarré) : c'est ce fichier que l'onglet Activité affiche comme "console serveur".
async function configureConsoleRedirect(serviceName, logPath) {
  await runNssm(['set', serviceName, 'AppStdout', logPath]);
  await runNssm(['set', serviceName, 'AppStderr', logPath]);
  await runNssm(['set', serviceName, 'AppRotateFiles', '1']);
  await runNssm(['set', serviceName, 'AppRotateOnline', '1']);
  await runNssm(['set', serviceName, 'AppRotateSeconds', '0']);
  await runNssm(['set', serviceName, 'AppRotateBytes', String(10 * 1024 * 1024)]);
}

// Active la redirection console sur le service EXISTANT, sans réinstallation complète : pour les
// serveurs installés avec une version du dashboard antérieure à la fonctionnalité console.
// NSSM ne prend la redirection en compte qu'au prochain démarrage du process.
async function enableConsoleRedirect() {
  const logPath = getCurrentConsoleLogPath();
  if (!logPath) throw new Error('server_not_installed');
  const serviceName = getServiceName();
  try {
    await runNssm(['status', serviceName]);
  } catch {
    throw new Error('service_not_registered');
  }
  await configureConsoleRedirect(serviceName, logPath);
  return logPath;
}

function ensureFirewallRule(port, onLog) {
  return new Promise((resolve, reject) => {
    execFile('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${FIREWALL_RULE_NAME}`], (error, stdout) => {
      if (!error && /Palworld Server/i.test(stdout || '')) {
        onLog('Règle de pare-feu déjà présente, ok.');
        return resolve();
      }
      execFile('netsh', ['advfirewall', 'firewall', 'add', 'rule', `name=${FIREWALL_RULE_NAME}`, 'dir=in', 'action=allow', 'protocol=UDP', `localport=${port}`], err2 => {
        if (err2) return reject(err2);
        onLog('Règle de pare-feu ajoutée.');
        resolve();
      });
    });
  });
}

// ---------- API publique ----------

// Complète les champs non fournis par l'utilisateur avec des valeurs par défaut cohérentes
// avec .env.example / server-setup/install-palworld-server.ps1.
function normalizeConfig(body = {}) {
  const installDir = body.installDir || 'D:\\PalworldServer';
  return {
    installDir,
    steamCmdDir: body.steamCmdDir || path.join(installDir, 'SteamCMD'),
    nssmPath: body.nssmPath || getNssmPath(),
    serviceName: body.serviceName || getServiceName(),
    serverName: body.serverName || 'Serveur Palworld',
    serverPassword: body.serverPassword || '',
    adminPassword: body.adminPassword,
    // existingServer : voir runInstall() — pointe directement sur un serveur déjà installé,
    // sans re-télécharger ni écraser ses mots de passe. serverPasswordProvided distingue "laissé
    // vide pour conserver l'existant" (import) de "laissé vide = pas de mot de passe" (install neuve).
    existingServer: !!body.existingServer,
    serverPasswordProvided: body.serverPassword !== undefined && body.serverPassword !== '',
    maxPlayers: parseInt(body.maxPlayers, 10) || 8,
    port: parseInt(body.port, 10) || 8211,
    queryPort: parseInt(body.queryPort, 10) || 27015,
    restApiPort: parseInt(body.restApiPort, 10) || 8212,
    backupDir: body.backupDir || path.join(installDir, 'Backups')
  };
}

async function getStatus() {
  const serverDir = process.env.PALWORLD_INSTALL_DIR || '';
  const steamCmdExe = process.env.STEAMCMD_PATH || '';
  const settingsFile = serverDir
    ? path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer', 'PalWorldSettings.ini')
    : '';

  let restApiConfigured = false;
  if (settingsFile && fs.existsSync(settingsFile)) {
    restApiConfigured = /RESTAPIEnabled=True/i.test(fs.readFileSync(settingsFile, 'utf-8'));
  }

  let serviceRegistered = false;
  try {
    await runNssm(['status', getServiceName()]);
    serviceRegistered = true;
  } catch {
    serviceRegistered = false;
  }

  // Pré-remplissage du formulaire : la config de la dernière installation réussie fait foi
  // (elle contient les vraies valeurs — nom du serveur, ports, joueurs max — que l'inspection
  // de l'environnement seul ne connaît pas), avec repli sur l'environnement puis les défauts.
  const saved = getSavedConfig() || {};
  return {
    elevated: await isElevated(),
    steamCmdPresent: !!steamCmdExe && fs.existsSync(steamCmdExe),
    serverInstalled: !!serverDir && fs.existsSync(path.join(serverDir, 'PalServer.exe')),
    serviceRegistered,
    restApiConfigured,
    current: {
      installDir: saved.installDir || (serverDir ? path.dirname(serverDir) : ''),
      steamCmdDir: saved.steamCmdDir || (steamCmdExe ? path.dirname(steamCmdExe) : ''),
      nssmPath: getNssmPath(),
      serviceName: getServiceName(),
      serverName: saved.serverName || '',
      backupDir: saved.backupDir || process.env.BACKUP_DIR || '',
      port: saved.port || 8211,
      queryPort: saved.queryPort || 27015,
      restApiPort: saved.restApiPort || 8212,
      maxPlayers: saved.maxPlayers || 8
    }
  };
}

async function runInstall(config, onLog) {
  // Fixés dès le début (et pas seulement à la fin via updateEnvFile) car setupNssmService()
  // s'appuie sur runNssm(), qui lit NSSM_PATH/SERVICE_NAME depuis process.env à l'appel.
  process.env.NSSM_PATH = config.nssmPath;
  process.env.SERVICE_NAME = config.serviceName;

  // existingServer : le dashboard pointe directement sur un serveur déjà installé ailleurs
  // (migration depuis un autre launcher, install manuelle...) — pas de sous-dossier "Server"
  // imposé, pas de (re)téléchargement, et les mots de passe déjà en place dans le .ini sont
  // préservés plutôt qu'écrasés (sauf si l'utilisateur en saisit explicitement de nouveaux).
  const serverDir = config.existingServer ? config.installDir : path.join(config.installDir, 'Server');
  const steamCmdExe = path.join(config.steamCmdDir, 'steamcmd.exe');
  const palServerExe = path.join(serverDir, 'PalServer.exe');

  onLog('=== Installation du serveur Palworld ===');

  if (config.existingServer) {
    onLog('[1/6] Serveur déjà installé indiqué — pas de téléchargement.');
    if (!fs.existsSync(palServerExe)) {
      throw new Error(`PalServer.exe introuvable dans "${serverDir}" — vérifie le dossier indiqué (celui qui contient PalServer.exe directement).`);
    }
  } else {
    if (!fs.existsSync(steamCmdExe)) {
      onLog('[1/7] SteamCMD introuvable, téléchargement...');
      fs.mkdirSync(config.steamCmdDir, { recursive: true });
      const zipPath = path.join(config.steamCmdDir, 'steamcmd.zip');
      await downloadFile(STEAMCMD_ZIP_URL, zipPath);
      await extractZip(zipPath, config.steamCmdDir);
      fs.unlinkSync(zipPath);
      onLog('SteamCMD installé.');
    } else {
      onLog('[1/7] SteamCMD déjà présent, ok.');
    }

    // SteamCMD se met à jour lui-même au 1er lancement puis se relance/sort avec un code non-nul
    // sans avoir téléchargé l'app : on relance donc jusqu'à ce que PalServer.exe existe réellement,
    // plutôt que de se fier au code de sortie (peu fiable).
    const MAX_STEAMCMD_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_STEAMCMD_ATTEMPTS && !fs.existsSync(palServerExe); attempt++) {
      onLog(attempt === 1
        ? `[2/7] Téléchargement du serveur Palworld (App ID ${APP_ID})... (12-15 Go, ça peut prendre un moment)`
        : `[2/7] PalServer.exe pas encore présent — SteamCMD s'auto-met à jour au 1er passage, nouvelle tentative (${attempt}/${MAX_STEAMCMD_ATTEMPTS})...`);
      const code = await runSteamCmdUpdate(steamCmdExe, serverDir, onLog);
      if (code !== 0) onLog(`(SteamCMD a renvoyé le code ${code} — souvent bénin, on vérifie via PalServer.exe.)`);
    }
    if (!fs.existsSync(palServerExe)) {
      throw new Error(`Échec : PalServer.exe introuvable après ${MAX_STEAMCMD_ATTEMPTS} tentatives SteamCMD (vérifie l'espace disque et la connexion).`);
    }
    onLog('Serveur Palworld installé/à jour.');
  }

  const configDir = path.join(serverDir, 'Pal', 'Saved', 'Config', 'WindowsServer');
  const settingsFile = path.join(configDir, 'PalWorldSettings.ini');
  const defaultSettingsFile = path.join(serverDir, 'DefaultPalWorldSettings.ini');

  if (!fs.existsSync(configDir)) {
    onLog('Premier lancement pour générer la config...');
    await firstLaunch(serverDir, onLog);
  } else {
    onLog('Config déjà générée, ok.');
  }

  onLog('Configuration de PalWorldSettings.ini...');
  if (fs.existsSync(defaultSettingsFile) && (!fs.existsSync(settingsFile) || fs.statSync(settingsFile).size <= 10)) {
    fs.copyFileSync(defaultSettingsFile, settingsFile);
  }

  if (config.existingServer && fs.existsSync(settingsFile)) {
    // Ne touche pas aux mots de passe déjà en place si le formulaire les a laissés vides —
    // seuls RESTAPIEnabled/RESTAPIPort (requis pour le dashboard) sont toujours forcés.
    const existing = parseIniOptions(fs.readFileSync(settingsFile, 'utf-8')) || [];
    const findVal = key => { const e = existing.find(o => o.key === key); return e ? e.value : ''; };
    if (!config.adminPassword) {
      config.adminPassword = findVal('AdminPassword') || crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
      onLog(findVal('AdminPassword') ? 'Mot de passe admin existant conservé.' : 'Aucun mot de passe admin existant : un nouveau a été généré automatiquement.');
    }
    if (!config.serverPasswordProvided) {
      config.serverPassword = findVal('ServerPassword');
    }
  }
  applyIniSettings(settingsFile, config);
  onLog('Réglages appliqués (nom, mots de passe, joueurs max, ports, API REST activée).');

  fs.mkdirSync(config.backupDir, { recursive: true });

  onLog('Configuration du service Windows...');
  await setupNssmService({ serverDir, serverName: config.serverName, port: config.port, queryPort: config.queryPort, maxPlayers: config.maxPlayers }, onLog);

  onLog(`Règle de pare-feu (port ${config.port}/UDP)...`);
  await ensureFirewallRule(config.port, onLog);

  onLog('Mise à jour de la configuration du dashboard (.env)...');
  updateEnvFile({
    NSSM_PATH: config.nssmPath,
    SERVICE_NAME: config.serviceName,
    SAVE_PATH: path.join(serverDir, 'Pal', 'Saved', 'SaveGames'),
    BACKUP_DIR: config.backupDir,
    STEAMCMD_PATH: steamCmdExe,
    PALWORLD_INSTALL_DIR: serverDir,
    PALWORLD_API_URL: `http://127.0.0.1:${config.restApiPort}`,
    PALWORLD_API_PASSWORD: config.adminPassword
  });

  saveServerConfig(config);
  onLog('=== Installation terminée avec succès — le dashboard est prêt à gérer ce serveur ===');
}

// (Ré)installe uniquement le service Windows du serveur + la règle de pare-feu, sans re-télécharger
// le serveur. Utile pour réparer/recréer les services depuis un serveur déjà installé.
async function installGameService(config, onLog = () => {}) {
  const serverDir = path.join(config.installDir, 'Server');
  if (!fs.existsSync(path.join(serverDir, 'PalServer.exe'))) {
    throw new Error('Serveur Palworld non installé — lance d\'abord l\'installation complète.');
  }
  process.env.SERVICE_NAME = config.serviceName; // NSSM_PATH est déjà posé par ensureNssm en amont
  await setupNssmService({ serverDir, serverName: config.serverName, port: config.port, queryPort: config.queryPort, maxPlayers: config.maxPlayers }, onLog);
  await ensureFirewallRule(config.port, onLog);
  saveServerConfig(config);
}

// Arrête et supprime le service Windows du serveur de jeu.
async function uninstallGameService(onLog = () => {}) {
  const name = getServiceName();
  try { await runNssm(['stop', name]); } catch (_) {}
  await runNssm(['remove', name, 'confirm']);
  onLog(`Service serveur "${name}" supprimé.`);
}

module.exports = {
  getStatus, runInstall, normalizeConfig, setIniOption, isElevated,
  installGameService, uninstallGameService, getSavedConfig, saveServerConfig,
  getSettingsFilePath, parseIniOptions, getCurrentConsoleLogPath, enableConsoleRedirect
};
