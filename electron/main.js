const { app, BrowserWindow, ipcMain, shell, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// --- Dossier de base inscriptible, partagé avec le service dashboard ---
// C:\ProgramData est lisible par le compte LocalSystem sous lequel tourne le service NSSM, à la
// différence d'un dossier sous le profil d'un utilisateur. On le fixe AVANT de requérir les
// modules lib/* (paths.js lit ces variables au chargement).
const HOME = process.env.PALWORLD_DASHBOARD_HOME
  || path.join(process.env.ProgramData || 'C:\\ProgramData', 'PalworldDashboard');

// Doit être initialisé avant tout le reste : jusqu'ici, une erreur au tout début du démarrage
// (dossier illisible, dépendance manquante dans un build corrompu...) faisait disparaître l'app
// en silence, sans fenêtre pour afficher quoi que ce soit. process.on('uncaughtException') étant
// posé ici, il intercepte aussi les erreurs survenant pendant le chargement des modules suivants.
const crashLog = require('./crashLog');
crashLog.init(HOME, dialog);

fs.mkdirSync(HOME, { recursive: true });
process.env.PALWORLD_DASHBOARD_HOME = HOME;
process.env.DATA_DIR = path.join(HOME, 'data');
require('dotenv').config({ path: path.join(HOME, '.env') });

const { updateEnvFile } = require('../lib/envFile');
const serverSetup = require('../lib/serverSetup');
const { ensureNssm } = require('../lib/nssmSetup');
const dashboardService = require('../lib/dashboardService');
const runtime = require('../lib/runtime');
const users = require('../lib/users');
// getLocalIp de networkInfo : préfère la vraie IP LAN (192.168.x) aux adaptateurs VPN/virtuels
const { getLocalIp } = require('../lib/networkInfo');

const APP_ROOT = path.join(__dirname, '..');
const getPort = () => process.env.PORT || '3000';
const CURRENT_VERSION = require('../package.json').version;

// Secrets/valeurs minimales pour que le service dashboard démarre correctement dès le 1er lancement.
function ensureBaseEnv() {
  const updates = {};
  if (!process.env.SESSION_SECRET) updates.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  if (!process.env.PORT) updates.PORT = '3000';
  if (Object.keys(updates).length) updateEnvFile(updates);
}

// Le service dashboard exécute node.exe et server.js depuis HOME/app, que materializeRuntime()
// écrase à chaque (ré)installation. Windows verrouille un exécutable en cours d'utilisation :
// écraser runtime/node.exe pendant que le service tourne encore échoue (EBUSY/EPERM).
//
// L'arrêt est INCONDITIONNEL (pas de vérification préalable via dashboardService.status()) : un
// cas réel a montré que le statut NSSM peut ne pas refléter la réalité (rapporté "non actif" alors
// que le fichier était bel et bien verrouillé par le process), ce qui faisait sauter l'arrêt et
// échouer la copie. dashboardService.stop() est sans risque si le service est déjà arrêté ou même
// pas encore enregistré (l'erreur est simplement avalée) — même principe que uninstall(), qui,
// lui, fonctionnait de façon fiable.
async function withDashboardStopped(fn) {
  sendLog('Arrêt du service dashboard (au cas où il tournerait) avant mise à jour des fichiers…');
  try { await dashboardService.stop(); } catch (_) {}
  // Laisse le temps à Windows de relâcher le verrou du fichier exécutable après la sortie du process.
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    return await fn();
  } finally {
    sendLog('Démarrage du service dashboard…');
    try { await dashboardService.start(); }
    catch (err) { sendLog(`Le service dashboard ne s'est pas relancé automatiquement : ${err.message || err}`); }
  }
}

// Compare deux versions "x.y.z" : true si `a` est strictement plus récente que `b`.
function isVersionNewer(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function getDeployedDashboardVersion(appDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf-8')).version;
  } catch (_) {
    return null;
  }
}

// Détecte, à l'ouverture du launcher, si le service dashboard déjà installé tourne une version
// plus ancienne que ce launcher — et le met à jour tout seul si besoin, sans qu'aucun clic ne soit
// nécessaire. Objectif : que quelqu'un qui ne comprend rien aux services Windows n'ait jamais à
// se soucier de cliquer sur "(Ré)installer" après avoir juste remplacé l'.exe par une nouvelle
// version — jusqu'ici, la mise à jour du service exigeait cette action manuelle explicite.
async function autoUpdateDashboardIfNeeded() {
  const { registered } = await dashboardService.status();
  if (!registered) return; // rien à mettre à jour tant que le service n'a jamais été installé

  const appDir = path.join(HOME, 'app');
  const deployedVersion = getDeployedDashboardVersion(appDir);
  if (deployedVersion && !isVersionNewer(CURRENT_VERSION, deployedVersion)) return; // déjà à jour

  sendLog(`=== Mise à jour automatique du service dashboard détectée (v${deployedVersion || '?'} → v${CURRENT_VERSION}) ===`);
  await withDashboardStopped(async () => {
    const { appDir: newAppDir, nodeExe, serverJs } = await runtime.materializeRuntime(
      { appRoot: APP_ROOT, home: HOME, packaged: app.isPackaged }, sendLog);
    await dashboardService.install({ nodeExe, serverJs, appDir: newAppDir, home: HOME }, sendLog);
  });
  sendLog('=== Mise à jour automatique terminée ===');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    useContentSize: true,
    backgroundColor: '#14181f',
    title: 'Pal Launcher Server Manager — Installation & Lancement',
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
    .catch(err => crashLog.reportFatal("Échec du chargement de l'interface", err));
  mainWindow.webContents.on('render-process-gone', (_evt, details) => {
    crashLog.reportFatal('Interface interrompue', new Error(`render-process-gone: ${details.reason}`));
  });
}

// Journal affiché dans l'UI pendant l'installation, ET persisté dans launcher.log (utile même
// si l'utilisateur n'a pas eu le temps de lire l'écran, ou pour du support après coup).
function sendLog(line) {
  crashLog.writeLine(line);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('setup:log', line);
}

// ---------- IPC ----------
ipcMain.handle('setup:getStatus', async () => {
  const serverStatus = await serverSetup.getStatus();
  const dashboard = await dashboardService.status();
  return {
    ...serverStatus,
    dashboard,
    home: HOME,
    port: getPort(),
    localIp: getLocalIp(),
    accounts: users.listUsers()
  };
});

ipcMain.handle('setup:install', async (_evt, body) => {
  try {
    const input = body || {};
    // "Serveur déjà installé" : le mot de passe admin peut rester vide (celui déjà en place dans
    // le .ini existant sera conservé, ou un nouveau généré automatiquement s'il n'y en a pas).
    // Sinon (installation neuve), il reste obligatoire pour activer l'API REST du dashboard.
    if (!input.existingServer && (!input.adminPassword || input.adminPassword.length < 6)) {
      throw new Error('Mot de passe admin requis (6 caractères minimum).');
    }
    if (input.adminPassword && input.adminPassword.length < 6) {
      throw new Error('Mot de passe admin : 6 caractères minimum si renseigné.');
    }
    sendLog('=== Préparation ===');
    // ensureNssm télécharge NSSM et met NSSM_PATH à jour : à faire AVANT normalizeConfig, qui
    // capture nssmPath depuis process.env. Sinon la config figerait le C:\nssm\nssm.exe par défaut.
    await ensureNssm(sendLog);
    const config = serverSetup.normalizeConfig(input);
    await serverSetup.runInstall(config, sendLog);

    sendLog('=== Configuration du service du dashboard ===');
    await withDashboardStopped(async () => {
      const { appDir, nodeExe, serverJs } = await runtime.materializeRuntime(
        { appRoot: APP_ROOT, home: HOME, packaged: app.isPackaged }, sendLog);
      await dashboardService.install({ nodeExe, serverJs, appDir, home: HOME }, sendLog);
    });
    ensureBaseEnv();

    sendLog('=== Terminé : le dashboard est démarré, crée maintenant un compte pour t\'y connecter ===');
    return { ok: true };
  } catch (err) {
    sendLog(`ERREUR : ${err.message || err}`);
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('services:install', async () => {
  try {
    const saved = serverSetup.getSavedConfig();
    if (!saved) throw new Error('Aucune configuration enregistrée — fais d\'abord une installation complète (étape 2).');
    sendLog('=== (Ré)installation des services ===');
    await ensureNssm(sendLog);
    await serverSetup.installGameService(saved, sendLog);
    await withDashboardStopped(async () => {
      const { appDir, nodeExe, serverJs } = await runtime.materializeRuntime(
        { appRoot: APP_ROOT, home: HOME, packaged: app.isPackaged }, sendLog);
      await dashboardService.install({ nodeExe, serverJs, appDir, home: HOME }, sendLog);
    });
    ensureBaseEnv();
    sendLog('=== Services installés ===');
    return { ok: true };
  } catch (err) {
    sendLog(`ERREUR : ${err.message || err}`);
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('services:uninstall', async () => {
  sendLog('=== Désinstallation des services ===');
  try { await dashboardService.uninstall(sendLog); }
  catch (e) { sendLog(`Service dashboard : ${e.message || e}`); }
  try { await serverSetup.uninstallGameService(sendLog); }
  catch (e) { sendLog(`Service serveur : ${e.message || e}`); }
  sendLog('=== Services désinstallés ===');
  return { ok: true };
});

ipcMain.handle('dashboard:start', async () => {
  try { await dashboardService.start(); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('dashboard:stop', async () => {
  try { await dashboardService.stop(); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('dashboard:open', async () => {
  await shell.openExternal(`http://localhost:${getPort()}`);
  return { ok: true };
});

ipcMain.handle('account:create', async (_evt, { username, password, role } = {}) => {
  try {
    if (!username || !password) throw new Error("Nom d'utilisateur et mot de passe requis.");
    if (password.length < 6) throw new Error('Mot de passe : 6 caractères minimum.');
    if (users.findUser(username)) throw new Error('Ce compte existe déjà.');
    users.upsertUser(username, password, role); // rôle inconnu -> admin (users.normalizeRole)
    return { ok: true, accounts: users.listUsers() };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('account:list', () => ({ accounts: users.listUsers() }));

// Sélecteur de dossier natif Windows, pour renseigner les chemins sans les taper à la main.
ipcMain.handle('dialog:pickFolder', async (_evt, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un dossier',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// Ajuste la fenêtre à la hauteur réelle du contenu, sans dépasser la zone d'écran disponible.
// La largeur reste celle choisie par l'utilisateur (il peut élargir pour aérer les 2 colonnes).
ipcMain.on('window:fit', (_evt, width, height) => {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized()) return;
  const workArea = screen.getDisplayMatching(mainWindow.getBounds()).workAreaSize;
  const [currentWidth] = mainWindow.getContentSize();
  const targetHeight = Math.min(Math.ceil(height), workArea.height - 40);
  mainWindow.setContentSize(Math.max(currentWidth, Math.ceil(width)), targetHeight);
});

// ---------- Cycle de vie ----------
app.whenReady().then(() => {
  ensureBaseEnv();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  // Non bloquant : la fenêtre s'affiche immédiatement, la mise à jour (si nécessaire) tourne en
  // parallèle et son avancement apparaît dans le journal comme n'importe quelle autre opération.
  autoUpdateDashboardIfNeeded().catch(err => crashLog.reportFatal('Échec de la mise à jour automatique du dashboard', err));
}).catch(err => crashLog.reportFatal('Échec du démarrage', err));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
