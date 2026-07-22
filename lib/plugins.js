const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { downloadFile, extractZip } = require('./download');
const { readJson, writeJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

// Plugins tiers optionnels, installés directement depuis leurs releases GitHub officielles
// (même principe que SteamCMD/NSSM/Node dans ce projet : téléchargement à la demande, jamais
// redistribué/hébergé par nous). Les deux utilisent des DLL de proxy DIFFÉRENTES (dwmapi.dll vs
// d3d9.dll) : pas de collision de fichier entre elles. PalDefender.dll et UE4SS.dll (binaires
// compilés par leurs auteurs respectifs) sont fermés, contrairement au reste du code du projet.
const STATE_FILE = path.join(DATA_DIR, 'plugins.json');

const PLUGINS = {
  ue4ss: {
    label: 'UE4SS',
    repo: 'UE4SS-RE/RE-UE4SS',
    assetPattern: /^UE4SS_v[\d.]+\.zip$/,
    // Fichiers propres au loader : le dossier Mods/ n'est PAS supprimé à la désinstallation
    // (il peut contenir des mods ajoutés par l'utilisateur en plus de ceux fournis par défaut).
    coreFiles: ['dwmapi.dll', 'UE4SS.dll', 'UE4SS-settings.ini'],
    markerFile: 'UE4SS.dll'
  },
  paldefender: {
    label: 'PalDefender',
    repo: 'Ultimeit/PalDefender',
    assetPattern: /^PalDefender\.zip$/,
    coreFiles: ['PalDefender.dll', 'd3d9.dll'],
    markerFile: 'PalDefender.dll',
    // Les endpoints REST des Commandes Admin (kick/ban/Broadcast/Alert/SendPlayerMessage...)
    // n'existent que depuis PalDefender 1.8.0, publié uniquement en préversion pour l'instant
    // (vérifié : la DLL 1.8.0 Beta les contient tous, la stable 1.7.2 non). On installe donc la
    // dernière release EN INCLUANT les préversions pour ce plugin.
    allowPrerelease: true
  }
};

// Dossier où vivent les DLL du jeu (PalServer-Win64-Shipping.exe) : c'est là, et non à la racine
// de PALWORLD_INSTALL_DIR (qui contient le lanceur PalServer.exe), que UE4SS/PalDefender
// s'installent.
function getBinariesDir() {
  const serverDir = process.env.PALWORLD_INSTALL_DIR || '';
  return serverDir ? path.join(serverDir, 'Pal', 'Binaries', 'Win64') : '';
}

function loadState() {
  return readJson(STATE_FILE, {});
}

function isInstalled(name) {
  const dir = getBinariesDir();
  return !!dir && fs.existsSync(path.join(dir, PLUGINS[name].markerFile));
}

function getStatus(name) {
  const state = loadState();
  return {
    installed: isInstalled(name),
    installedVersion: (state[name] && state[name].version) || null
  };
}

async function getLatestRelease(name) {
  const { repo, assetPattern, label, allowPrerelease } = PLUGINS[name];
  let release;
  if (allowPrerelease) {
    // /releases/latest exclut les préversions : on liste toutes les releases (déjà triées de la
    // plus récente à la plus ancienne par GitHub) et on prend la première avec un asset attendu.
    const res = await axios.get(`https://api.github.com/repos/${repo}/releases?per_page=15`, { timeout: 10000 });
    release = (res.data || []).find(r => !r.draft && (r.assets || []).some(a => assetPattern.test(a.name)));
    if (!release) throw new Error(`Aucune release avec un asset correspondant trouvée pour ${label}`);
  } else {
    const res = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`, { timeout: 10000 });
    release = res.data;
  }
  const asset = release.assets.find(a => assetPattern.test(a.name));
  if (!asset) throw new Error(`Aucun asset correspondant trouvé pour ${label}`);
  return { version: release.tag_name, url: asset.browser_download_url, assetName: asset.name };
}

// Active l'API REST de PalDefender (Enabled: true) en écoute locale uniquement. PalDefender ne
// génère RESTConfig.json qu'au premier lancement du serveur après installation (voir sa doc :
// "Start your server once to generate the file structure") : si le fichier n'existe pas encore,
// on pré-crée le dossier avec une config par défaut déjà activée, pour que rien à faire de plus
// après ce premier lancement ; s'il existe déjà (réinstallation/mise à jour), on active dessus en
// préservant le reste (et on corrige une éventuelle écoute 0.0.0.0, exposée à tout le réseau).
function enablePalDefenderRestApi(dir) {
  const restDir = path.join(dir, 'PalDefender', 'RESTAPI');
  const configPath = path.join(restDir, 'RESTConfig.json');
  fs.mkdirSync(restDir, { recursive: true });

  let cfg = null;
  if (fs.existsSync(configPath)) {
    try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { cfg = null; }
  }
  if (!cfg) {
    cfg = {
      Version: { Major: 1, Minor: 0, Patch: 0 },
      Enabled: true,
      Address: '127.0.0.1',
      Port: 17993,
      Cors: { Comment: 'Do not change those unless you know what you are doing!', 'Allowed-Origins': '*', 'Max-Age': 86400 }
    };
  } else {
    cfg.Enabled = true;
    if (!cfg.Address || cfg.Address === '0.0.0.0') cfg.Address = '127.0.0.1';
  }
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 4));
}

// Garantit qu'un jeton d'API existe dans Tokens/ (hors TokenExample.json, l'exemple public livré
// avec le plugin). S'il y en a déjà un (créé manuellement ou lors d'une install précédente), on
// ne le touche pas. Sinon on en génère un nouveau, aléatoire, dans son propre fichier.
function ensurePalDefenderToken(dir) {
  const tokensDir = path.join(dir, 'PalDefender', 'RESTAPI', 'Tokens');
  fs.mkdirSync(tokensDir, { recursive: true });
  const existing = fs.readdirSync(tokensDir).filter(f => f.endsWith('.json') && f !== 'TokenExample.json');
  for (const f of existing) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(tokensDir, f), 'utf-8'));
      if (data.Token) return { token: data.Token, created: false };
    } catch { /* fichier corrompu : on passe au suivant */ }
  }
  // Permissions requise (voir doc PalDefender, authentication.md) : sans elle, chaque route est
  // traitée comme inexistante (HTTP 404) plutôt que refusée — un jeton sans Permissions ne peut
  // appeler que /version, quasiment inutilisable pour les Commandes Admin.
  const token = crypto.randomBytes(48).toString('base64').replace(/[+/=]/g, '').slice(0, 48);
  fs.writeFileSync(path.join(tokensDir, 'Dashboard.json'), JSON.stringify({ Name: 'Dashboard', Token: token, Permissions: ['REST.*'] }, null, 4));
  return { token, created: true };
}

async function install(name, onLog = () => {}) {
  const dir = getBinariesDir();
  if (!dir) throw new Error('Serveur non installé (PALWORLD_INSTALL_DIR manquant).');
  fs.mkdirSync(dir, { recursive: true });

  onLog(`Recherche de la dernière version de ${PLUGINS[name].label}...`);
  const latest = await getLatestRelease(name);
  onLog(`Téléchargement de ${latest.assetName} (${latest.version})...`);

  const tmpZip = path.join(dir, `_${name}-download.zip`);
  try {
    await downloadFile(latest.url, tmpZip);
    onLog('Extraction...');
    await extractZip(tmpZip, dir);
  } finally {
    // Toujours nettoyer le zip temporaire, même si le téléchargement/extraction échoue
    try { fs.unlinkSync(tmpZip); } catch (_) {}
  }

  let paldefenderToken = null;
  if (name === 'paldefender') {
    enablePalDefenderRestApi(dir);
    const tokenResult = ensurePalDefenderToken(dir);
    paldefenderToken = tokenResult.token;
    onLog(tokenResult.created
      ? "API REST de PalDefender activée et jeton créé automatiquement (écoute locale)."
      : "API REST de PalDefender activée (jeton existant conservé).");
  }

  const state = loadState();
  state[name] = { version: latest.version, installedAt: new Date().toISOString() };
  writeJson(STATE_FILE, state);
  onLog(`${PLUGINS[name].label} ${latest.version} installé.`);
  return { version: latest.version, paldefenderToken };
}

function uninstall(name) {
  const dir = getBinariesDir();
  if (dir) {
    PLUGINS[name].coreFiles.forEach(f => {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  }
  const state = loadState();
  delete state[name];
  writeJson(STATE_FILE, state);
}

// Cherche un jeton API existant dans PalDefender/RESTAPI/Tokens/*.json. LECTURE SEULE : aucune
// écriture dans le dossier du plugin (contrairement à enablePalDefenderRestApi ci-dessus).
function detectPalDefenderToken() {
  const dir = getBinariesDir();
  if (!dir) return { error: 'server_not_installed' };
  const restDir = path.join(dir, 'PalDefender', 'RESTAPI');
  const configPath = path.join(restDir, 'RESTConfig.json');
  if (!fs.existsSync(configPath)) return { error: 'no_rest_config' };
  let enabled = false;
  try { enabled = JSON.parse(fs.readFileSync(configPath, 'utf-8')).Enabled === true; } catch { /* config illisible : on considère désactivée */ }
  const tokensDir = path.join(restDir, 'Tokens');
  const files = fs.existsSync(tokensDir) ? fs.readdirSync(tokensDir).filter(f => f.endsWith('.json') && f !== 'TokenExample.json') : [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(tokensDir, f), 'utf-8'));
      if (data.Token) return { token: data.Token, enabled, file: f };
    } catch { /* fichier corrompu : on passe au suivant */ }
  }
  return { error: 'no_token_file', enabled };
}

module.exports = { PLUGINS, getBinariesDir, getStatus, getLatestRelease, install, uninstall, enablePalDefenderRestApi, ensurePalDefenderToken, detectPalDefenderToken };
