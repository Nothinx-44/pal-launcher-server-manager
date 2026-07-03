const { app, BrowserWindow, ipcMain, shell, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// --- Dossier de base inscriptible, partagé avec le service dashboard ---
// C:\ProgramData est lisible par le compte LocalSystem sous lequel tourne le service NSSM, à la
// différence d'un dossier sous le profil d'un utilisateur. On le fixe AVANT de requérir les
// modules lib/* (paths.js lit ces variables au chargement).
const HOME = process.env.PALWORLD_DASHBOARD_HOME
  || path.join(process.env.ProgramData || 'C:\\ProgramData', 'PalworldDashboard');
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

const APP_ROOT = path.join(__dirname, '..');
const getPort = () => process.env.PORT || '3000';

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// Secrets/valeurs minimales pour que le service dashboard démarre correctement dès le 1er lancement.
function ensureBaseEnv() {
  const updates = {};
  if (!process.env.SESSION_SECRET) updates.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  if (!process.env.PORT) updates.PORT = '3000';
  if (Object.keys(updates).length) updateEnvFile(updates);
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
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function sendLog(line) {
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
    if (!input.adminPassword || input.adminPassword.length < 6) {
      throw new Error('Mot de passe admin requis (6 caractères minimum).');
    }
    sendLog('=== Préparation ===');
    // ensureNssm télécharge NSSM et met NSSM_PATH à jour : à faire AVANT normalizeConfig, qui
    // capture nssmPath depuis process.env. Sinon la config figerait le C:\nssm\nssm.exe par défaut.
    await ensureNssm(sendLog);
    const config = serverSetup.normalizeConfig(input);
    await serverSetup.runInstall(config, sendLog);

    sendLog('=== Configuration du service du dashboard ===');
    const { appDir, nodeExe, serverJs } = await runtime.materializeRuntime(
      { appRoot: APP_ROOT, home: HOME, packaged: app.isPackaged }, sendLog);
    await dashboardService.install({ nodeExe, serverJs, appDir, home: HOME }, sendLog);
    ensureBaseEnv();

    sendLog('=== Terminé : crée un compte puis démarre le dashboard ===');
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
    const { appDir, nodeExe, serverJs } = await runtime.materializeRuntime(
      { appRoot: APP_ROOT, home: HOME, packaged: app.isPackaged }, sendLog);
    await dashboardService.install({ nodeExe, serverJs, appDir, home: HOME }, sendLog);
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
    users.upsertUser(username, password, role === 'viewer' ? 'viewer' : 'admin');
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
