const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const playersBody = document.getElementById('playersBody');
const playersEmpty = document.getElementById('playersEmpty');
const backupList = document.getElementById('backupList');
const activityList = document.getElementById('activityList');
const sessionsList = document.getElementById('sessionsList');
const totalsList = document.getElementById('totalsList');
const totalsEmpty = document.getElementById('totalsEmpty');
const roleBadge = document.getElementById('roleBadge');
const toast = document.getElementById('toast');

let currentRole = 'viewer';
let currentUsername = '';
let onlinePlayers = [];

// admin : tout. user : actions + gestion des comptes non-admin, sans installation. viewer : lecture.
function isAdmin() { return currentRole === 'admin'; }
function isManager() { return currentRole === 'admin' || currentRole === 'user'; }

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return null;
  }
  return res.json();
}

async function loadMe() {
  const data = await api('GET', '/api/me');
  if (!data || !data.user) return;
  currentRole = data.user.role;
  currentUsername = data.user.username;
  const labels = { admin: 'Admin', user: 'Utilisateur', viewer: 'Lecture seule' };
  roleBadge.textContent = labels[currentRole] || currentRole;
  // data-admin-only : admin seul (installation, comptes admin). data-manager-only : admin + user.
  if (!isAdmin()) document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display = 'none');
  if (!isManager()) document.querySelectorAll('[data-manager-only]').forEach(el => el.style.display = 'none');
  // Un "user" ne peut pas créer de compte admin : on retire l'option correspondante.
  if (!isAdmin()) document.querySelectorAll('#newUserRole [data-role-admin]').forEach(o => o.remove());
}

async function refreshStatus() {
  const data = await api('GET', '/api/status');
  if (!data) return;

  renderScheduledBanner(data.scheduledRestartAt);

  if (data.online) {
    statusDot.classList.add('online');
    const nbPlayers = (data.players || []).length;
    statusText.innerHTML = `En ligne <span class="muted">— ${nbPlayers} joueur(s) connecté(s)</span>`;
    renderPlayers(data.players || []);
    renderServerInfo(data);
  } else {
    statusDot.classList.remove('online');
    statusText.textContent = 'Serveur arrêté ou injoignable';
    renderPlayers([]);
    renderServerInfo(null);
  }
  if (window.updateMapPlayers) window.updateMapPlayers(data.online ? data.players || [] : []);
}

function formatUptime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${min}min`);
  return parts.join(' ');
}

function renderServerInfo(data) {
  const set = (id, val) => { document.getElementById(id).textContent = val; };
  if (!data) {
    set('infoOnline', 'Hors ligne');
    ['infoVersion', 'infoPlayers', 'infoUptime', 'infoFps', 'infoDays'].forEach(id => set(id, '—'));
    return;
  }
  const m = data.metrics || {};
  set('infoOnline', 'En ligne');
  set('infoVersion', (data.info && data.info.version) || '—');
  set('infoPlayers', `${(data.players || []).length}${m.maxplayernum != null ? '/' + m.maxplayernum : ''}`);
  set('infoUptime', m.uptime != null ? formatUptime(m.uptime) : '—');
  set('infoFps', m.serverfps != null ? String(m.serverfps) : '—');
  set('infoDays', m.days != null ? String(m.days) : '—');
}

function renderScheduledBanner(at) {
  const banner = document.getElementById('scheduledBanner');
  if (!at) { banner.style.display = 'none'; return; }
  const mins = Math.max(0, Math.round((at - Date.now()) / 60000));
  document.getElementById('scheduledText').textContent =
    `⏳ Redémarrage programmé dans ~${mins} min.`;
  banner.style.display = 'flex';
}

function renderPlayers(players) {
  onlinePlayers = players || [];
  const datalist = document.getElementById('pdOnlinePlayers');
  if (datalist) {
    datalist.innerHTML = onlinePlayers.map(p => `<option value="${escapeHtml(p.name || '')}">${escapeHtml(p.userId || '')}</option>`).join('');
  }
  playersBody.innerHTML = '';
  if (!players.length) {
    playersEmpty.style.display = 'block';
    return;
  }
  playersEmpty.style.display = 'none';
  players.forEach(p => {
    const tr = document.createElement('tr');
    const actions = isManager()
      ? `<div class="row-actions">
           <button class="kick-btn" data-userid="${escapeHtml(p.userId || '')}">Kick</button>
           <button class="ban-btn" data-userid="${escapeHtml(p.userId || '')}" data-name="${escapeHtml(p.name || '')}">Bannir</button>
         </div>`
      : '';
    tr.innerHTML = `
      <td><span class="player-name" data-userid="${escapeHtml(p.userId || '')}" data-name="${escapeHtml(p.name || '')}">${escapeHtml(p.name || '—')}</span></td>
      <td>${p.level ?? '—'}</td>
      <td>${p.ping ?? '—'}</td>
      <td>${actions}</td>
    `;
    playersBody.appendChild(tr);
  });
  playersBody.querySelectorAll('.player-name').forEach(el => {
    el.addEventListener('click', () => showPlayerMenu(el, el.dataset.userid, el.dataset.name));
  });
  document.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Exclure ce joueur du serveur ?')) return;
      const r = await api('POST', '/api/kick', { userid: btn.dataset.userid });
      if (r && r.ok) { showToast('Joueur exclu'); refreshStatus(); }
      else showToast('Échec du kick');
    });
  });
  document.querySelectorAll('.ban-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Bannir ${btn.dataset.name || 'ce joueur'} ? Il sera déconnecté et ne pourra plus se reconnecter.`)) return;
      const r = await api('POST', '/api/ban', { userid: btn.dataset.userid, name: btn.dataset.name });
      if (r && r.ok) { showToast('Joueur banni'); refreshStatus(); refreshBans(); refreshActivity(); }
      else showToast('Échec du ban');
    });
  });
}

async function refreshBans() {
  if (!isManager()) return;
  const data = await api('GET', '/api/bans');
  if (!data) return;
  const list = document.getElementById('bansList');
  const empty = document.getElementById('bansEmpty');
  list.innerHTML = '';
  if (!data.bans.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  data.bans.forEach(b => {
    const li = document.createElement('li');
    // Les entrées PalDefender n'ont pas d'horodatage ; on affiche le type (IP vs joueur) à la place.
    const meta = b.type === 'ip' ? 'IP bannie'
      : (b.ts ? `banni le ${new Date(b.ts).toLocaleString('fr-FR')}` : 'joueur banni');
    li.innerHTML = `<span>${escapeHtml(b.name)} <span class="muted">— ${meta}</span></span>`;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.textContent = 'Débannir';
    btn.addEventListener('click', async () => {
      const r = await api('POST', '/api/unban', { userid: b.userId, type: b.type });
      if (r && r.ok) { showToast(b.type === 'ip' ? 'IP débannie' : 'Joueur débanni'); refreshBans(); refreshActivity(); }
      else showToast('Échec du déban');
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function refreshBackups() {
  const data = await api('GET', '/api/backups');
  if (!data) return;
  backupList.innerHTML = '';
  if (!data.backups.length) {
    backupList.innerHTML = '<li>Aucune sauvegarde pour le moment.</li>';
    return;
  }
  data.backups.forEach(b => {
    const li = document.createElement('li');
    const sizeMb = (b.size / 1024 / 1024).toFixed(1);
    const date = new Date(b.date).toLocaleString('fr-FR');
    const restoreBtn = isManager()
      ? `<button class="icon-btn danger" data-restore="${escapeHtml(b.filename)}">Restaurer</button>`
      : '';
    li.innerHTML = `
      <span>${date} — ${sizeMb} Mo</span>
      <span class="row-actions">
        <a href="/api/backups/${encodeURIComponent(b.filename)}">Télécharger</a>
        ${restoreBtn}
      </span>`;
    backupList.appendChild(li);
  });
  backupList.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const filename = btn.dataset.restore;
      if (!confirm(`Restaurer "${filename}" ? Le monde actuel sera remplacé (une sauvegarde de sécurité du monde actuel sera prise avant). Le serveur doit être éteint.`)) return;
      btn.disabled = true;
      const r = await api('POST', `/api/backups/${encodeURIComponent(filename)}/restore`);
      btn.disabled = false;
      if (r && r.ok) {
        showToast(r.safetyFilename ? `Restauré (ancien monde sauvegardé sous ${r.safetyFilename})` : 'Restauré');
        refreshBackups();
        refreshActivity();
      } else {
        showToast(
          r && r.error === 'server_running' ? 'Impossible : arrête le serveur d\'abord'
          : r && r.error === 'not_configured' ? 'SAVE_PATH/BACKUP_DIR non configurés'
          : 'Échec de la restauration');
      }
    });
  });
}

function formatBytes(bytes) {
  if (bytes == null) return '?';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} Go` : `${Math.round(bytes / 1024 / 1024)} Mo`;
}

async function refreshDiskSpace() {
  const data = await api('GET', '/api/disk-space');
  const banner = document.getElementById('diskSpaceWarning');
  if (!data || !data.disks || !data.disks.length) { banner.style.display = 'none'; return; }
  const low = data.disks.filter(d => d.low);
  if (!low.length) { banner.style.display = 'none'; return; }
  banner.textContent = `⚠️ Espace disque faible : ${low.map(d => `${d.path} (${formatBytes(d.freeBytes)} libres)`).join(' — ')}.`;
  banner.style.display = 'block';
}

// Bannière "nouvelle version disponible" (vérifiée une fois par session, cache 6h côté serveur)
async function refreshDashboardUpdate() {
  const data = await api('GET', '/api/dashboard/update');
  if (!data || !data.updateAvailable) return;
  const banner = document.getElementById('updateBanner');
  banner.innerHTML = `⬆️ Nouvelle version du dashboard disponible : <strong>v${escapeHtml(data.latest)}</strong> (tu utilises la v${escapeHtml(data.current)}) — <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">télécharger sur GitHub</a>`;
  banner.style.display = 'block';
}

async function refreshNetworkInfo() {
  const data = await api('GET', '/api/network-info');
  if (!data) return;
  if (!data.port) {
    document.getElementById('localAddr').textContent = 'Serveur pas encore installé';
    document.getElementById('publicAddr').textContent = 'Serveur pas encore installé';
    return;
  }
  document.getElementById('localAddr').textContent = `${data.localIp}:${data.port}`;
  document.getElementById('publicAddr').textContent = data.publicIp ? `${data.publicIp}:${data.port}` : 'Indisponible (pas de connexion internet ?)';
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => showToast('Copié !'),
    () => showToast('Impossible de copier')
  );
}

document.getElementById('copyLocalBtn').addEventListener('click', () => copyToClipboard(document.getElementById('localAddr').textContent));
document.getElementById('copyPublicBtn').addEventListener('click', () => copyToClipboard(document.getElementById('publicAddr').textContent));

// ---------- Plugins (UE4SS / PalDefender) ----------
async function refreshPlugins() {
  if (!isManager()) return;
  const data = await api('GET', '/api/plugins/status');
  if (!data) return;
  ['ue4ss', 'paldefender'].forEach(name => {
    const info = data[name];
    const statusEl = document.getElementById(`${name}Status`);
    const uninstallBtn = document.getElementById(`${name}UninstallBtn`);
    statusEl.textContent = info.installed
      ? `✅ Installé${info.installedVersion ? ' — ' + info.installedVersion : ''}`
      : '⭕ Non installé';
    uninstallBtn.style.display = info.installed ? 'inline-block' : 'none';
  });
}

async function installPlugin(name, label) {
  if (!confirm(`Installer/mettre à jour ${label} vers la dernière version ? Le serveur doit être éteint.`)) return;
  const r = await api('POST', `/api/plugins/${name}/install`, {});
  if (r && r.ok) {
    showToast(r.paldefenderConfigured
      ? `${label} ${r.version} installé — API de commandes prête, plus rien à configurer`
      : `${label} ${r.version} installé`);
    refreshActivity();
    if (name === 'paldefender') refreshPaldefenderApiStatus();
  } else {
    showToast(r && r.error === 'server_running' ? 'Impossible : arrête le serveur d\'abord' : `Échec de l'installation de ${label}`);
  }
  refreshPlugins();
}

async function uninstallPlugin(name, label) {
  if (!confirm(`Désinstaller ${label} ? Le serveur doit être éteint.`)) return;
  const r = await api('POST', `/api/plugins/${name}/uninstall`, {});
  if (r && r.ok) { showToast(`${label} désinstallé`); refreshActivity(); }
  else showToast(r && r.error === 'server_running' ? 'Impossible : arrête le serveur d\'abord' : `Échec de la désinstallation de ${label}`);
  refreshPlugins();
}

document.getElementById('ue4ssInstallBtn').addEventListener('click', () => installPlugin('ue4ss', 'UE4SS'));
document.getElementById('ue4ssUninstallBtn').addEventListener('click', () => uninstallPlugin('ue4ss', 'UE4SS'));
document.getElementById('paldefenderInstallBtn').addEventListener('click', () => installPlugin('paldefender', 'PalDefender'));
document.getElementById('paldefenderUninstallBtn').addEventListener('click', () => uninstallPlugin('paldefender', 'PalDefender'));

// ---------- API de commandes PalDefender ----------
let pdApiConfigured = false;

async function refreshPaldefenderApiStatus() {
  if (!isAdmin()) return;
  let data = await api('GET', '/api/paldefender/config');
  if (!data) return;
  // Auto-import silencieux : si aucun jeton n'est encore enregistré mais qu'un jeton existe déjà
  // dans PalDefender/RESTAPI/Tokens/ (plugin installé, serveur démarré au moins une fois), on
  // l'importe automatiquement — aucune action manuelle demandée à l'utilisateur.
  if (!data.configured) {
    const imported = await api('POST', '/api/paldefender/detect', {});
    if (imported && imported.ok) data = await api('GET', '/api/paldefender/config') || data;
  }
  pdApiConfigured = data.configured;
  document.getElementById('paldefenderApiStatus').textContent = data.configured
    ? '✅ Prêt — les Commandes Admin fonctionnent'
    : '⭕ Installe PalDefender puis démarre le serveur une fois';
  const unavailable = document.getElementById('pdCommandsUnavailable');
  const form = document.getElementById('pdCommandForm');
  if (unavailable) unavailable.style.display = pdApiConfigured ? 'none' : 'block';
  if (form) form.style.display = pdApiConfigured ? 'flex' : 'none';
}

// Affiche/masque les champs pertinents selon la commande sélectionnée.
function updatePdFieldsVisibility() {
  const cmd = document.getElementById('pdCommand').value;
  const show = (id, cond) => { document.getElementById(id).style.display = cond ? '' : 'none'; };
  const needsPlayerOrIp = ['kick', 'ban', 'unban', 'banip', 'unbanip', 'message'].includes(cmd);
  show('pdTarget', needsPlayerOrIp);
  show('pdSendType', cmd === 'message');
  show('pdMessage', ['message', 'broadcast', 'alert'].includes(cmd));
  show('pdReason', ['kick', 'ban', 'unban', 'banip', 'unbanip'].includes(cmd));
  show('pdSender', cmd === 'broadcast');
  show('pdIpBanRow', cmd === 'ban');
}
document.getElementById('pdCommand').addEventListener('change', updatePdFieldsVisibility);
updatePdFieldsVisibility();

document.getElementById('pdCommandForm').addEventListener('submit', async e => {
  e.preventDefault();
  const command = document.getElementById('pdCommand').value;
  const targetInput = document.getElementById('pdTarget').value.trim();
  // Autorise de saisir un pseudo (résolu vers son UserId via les joueurs connectés) ou un
  // UserId/IP directement.
  const matched = onlinePlayers.find(p => p.name === targetInput);
  const target = matched ? matched.userId : targetInput;

  const fields = {
    Reason: document.getElementById('pdReason').value.trim(),
    Message: document.getElementById('pdMessage').value.trim(),
    Sender: document.getElementById('pdSender').value.trim(),
    SendType: document.getElementById('pdSendType').value,
    IP: document.getElementById('pdBanIp').checked,
    // Nom lisible (si le pseudo saisi correspond à un joueur connu) : sert à afficher un vrai
    // pseudo dans la liste des bannis plutôt que le UserId brut.
    _name: matched ? matched.name : (targetInput !== target ? targetInput : undefined)
  };

  const r = await api('POST', '/api/paldefender/command', { command, target, fields });
  if (r && r.ok) {
    showToast('Commande exécutée');
    e.target.reset();
    updatePdFieldsVisibility();
    refreshActivity();
    if (['ban', 'banip', 'unban', 'unbanip'].includes(command)) refreshBans();
  } else {
    showToast(r && r.error === 'not_configured' ? 'API PalDefender non configurée' : `Échec : ${(r && r.error) || 'erreur inconnue'}`);
  }
});

let activityEntries = [];
let activityPage = 0;
const ACTIVITY_PER_PAGE = 10;

async function refreshActivity() {
  const data = await api('GET', '/api/activity');
  if (!data) return;
  activityEntries = data.entries || [];
  activityPage = 0;
  renderActivityPage();
}

function renderActivityPage() {
  activityList.innerHTML = '';
  const pager = document.getElementById('activityPager');
  if (!activityEntries.length) {
    activityList.innerHTML = '<li>Aucune activité enregistrée.</li>';
    if (pager) pager.style.display = 'none';
    return;
  }
  const labels = {
    start: 'a démarré le serveur',
    stop: 'a arrêté le serveur',
    'stop-forced': 'a forcé l\'arrêt du serveur',
    restart: 'a redémarré le serveur',
    backup: 'a lancé une sauvegarde',
    save: 'a sauvegardé le monde',
    announce: 'a envoyé une annonce',
    kick: 'a exclu un joueur',
    ban: 'a banni un joueur',
    unban: 'a débanni un joueur',
    'force-stop': 'a forcé l\'arrêt du serveur',
    'restart-scheduled': 'a programmé un redémarrage',
    'restart-cancelled': 'a annulé le redémarrage programmé',
    'update-check': 'a vérifié les mises à jour',
    'update-apply': 'a lancé une mise à jour du serveur',
    'settings-change': 'a modifié les réglages du monde',
    'backup-schedule-change': 'a modifié le planning des sauvegardes',
    'restart-schedule-change': 'a modifié le planning de redémarrage',
    'backup-restore': 'a restauré une sauvegarde',
    'backup-import': 'a importé une sauvegarde',
    'console-enable': 'a activé la console serveur',
    'backup-restore-error': 'a échoué à restaurer une sauvegarde',
    'plugin-install': 'a installé un plugin',
    'plugin-uninstall': 'a désinstallé un plugin',
    'paldefender-token-set': 'a enregistré le jeton API PalDefender',
    'paldefender-command': 'a exécuté une commande PalDefender',
    'player-join': 'a rejoint le serveur',
    'player-leave': 'a quitté le serveur',
    'disk-space-low': 'alerte espace disque faible',
    'auto-restart': 'redémarrage automatique (watchdog)',
    'restart-warning': 'annonce de redémarrage planifié',
    'restart-skipped': 'redémarrage planifié ignoré (un autre était en cours)',
    'user-create': 'a créé un compte',
    'user-update': 'a modifié un compte',
    'user-delete': 'a supprimé un compte',
    'password-change': 'a changé son mot de passe',
    'steam-update-check': 'vérification de mise à jour SteamCMD'
  };
  const totalPages = Math.ceil(activityEntries.length / ACTIVITY_PER_PAGE);
  activityPage = Math.max(0, Math.min(activityPage, totalPages - 1));
  const start = activityPage * ACTIVITY_PER_PAGE;
  activityEntries.slice(start, start + ACTIVITY_PER_PAGE).forEach(e => {
    const li = document.createElement('li');
    const date = new Date(e.ts).toLocaleString('fr-FR');
    const label = labels[e.action] || e.action;
    const details = e.details ? ` — ${escapeHtml(e.details)}` : '';
    li.innerHTML = `<span>${escapeHtml(e.username)} ${label}${details}</span><span>${date}</span>`;
    activityList.appendChild(li);
  });

  if (pager) {
    pager.style.display = totalPages > 1 ? 'flex' : 'none';
    document.getElementById('activityPageInfo').textContent = `Page ${activityPage + 1} / ${totalPages}`;
    document.getElementById('activityPrev').disabled = activityPage === 0;
    document.getElementById('activityNext').disabled = activityPage >= totalPages - 1;
  }
}

document.getElementById('activityPrev').addEventListener('click', () => { activityPage--; renderActivityPage(); });
document.getElementById('activityNext').addEventListener('click', () => { activityPage++; renderActivityPage(); });

// Menu contextuel sur un nom de joueur (historique) : stats globales + ban rapide.
function closePlayerMenu() {
  const existing = document.getElementById('playerMenu');
  if (existing) existing.remove();
  document.removeEventListener('click', closePlayerMenuOnOutsideClick);
}
function closePlayerMenuOnOutsideClick(e) {
  if (!e.target.closest('#playerMenu') && !e.target.classList.contains('player-name')) closePlayerMenu();
}

function showPlayerMenu(anchorEl, userId, name) {
  closePlayerMenu();
  const menu = document.createElement('div');
  menu.id = 'playerMenu';
  menu.className = 'player-menu';

  const statsBtn = document.createElement('button');
  statsBtn.type = 'button';
  statsBtn.textContent = '📊 Voir les stats';
  statsBtn.addEventListener('click', () => {
    closePlayerMenu();
    const totals = (lastHistoryData && lastHistoryData.totals) || {};
    const sessions = ((lastHistoryData && lastHistoryData.sessions) || []).filter(s => s.userId === userId);
    const minutes = totals[userId] || 0;
    const hours = (minutes / 60).toFixed(1);
    const lastSeen = sessions[0] ? new Date(sessions[0].joined).toLocaleString('fr-FR') : 'inconnue';
    alert(`${name}\n\nTemps de jeu total : ${hours} h\nSessions récentes trouvées : ${sessions.length}\nDernière connexion : ${lastSeen}`);
  });
  menu.appendChild(statsBtn);

  if (isManager()) {
    const banBtn = document.createElement('button');
    banBtn.type = 'button';
    banBtn.className = 'danger';
    banBtn.textContent = '🔨 Bannir';
    banBtn.addEventListener('click', async () => {
      closePlayerMenu();
      if (!confirm(`Bannir ${name} ? Il sera déconnecté (s'il est en ligne) et ne pourra plus se reconnecter.`)) return;
      const r = await api('POST', '/api/ban', { userid: userId, name });
      if (r && r.ok) { showToast('Joueur banni'); refreshStatus(); refreshBans(); refreshActivity(); }
      else showToast('Échec du ban');
    });
    menu.appendChild(banBtn);
  }

  document.body.appendChild(menu);
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top = `${window.scrollY + rect.bottom + 4}px`;
  menu.style.left = `${window.scrollX + rect.left}px`;
  setTimeout(() => document.addEventListener('click', closePlayerMenuOnOutsideClick), 0);
}

let lastHistoryData = null;

async function refreshPlayerHistory() {
  const data = await api('GET', '/api/players/history');
  if (!data) return;
  lastHistoryData = data;

  totalsList.innerHTML = '';
  const totalsEntries = Object.entries(data.totals || {});
  if (!totalsEntries.length) {
    totalsEmpty.style.display = 'block';
  } else {
    totalsEmpty.style.display = 'none';
    // On récupère un nom lisible depuis les sessions plutôt que d'afficher le userId brut
    const nameByUserId = {};
    (data.sessions || []).forEach(s => { nameByUserId[s.userId] = s.name; });
    totalsEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([userId, minutes]) => {
        const li = document.createElement('li');
        const hours = (minutes / 60).toFixed(1);
        const name = nameByUserId[userId] || userId;
        li.innerHTML = `<span class="player-name" data-userid="${escapeHtml(userId)}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</span><span>${hours} h au total</span>`;
        totalsList.appendChild(li);
      });
  }

  sessionsList.innerHTML = '';
  if (!data.sessions || !data.sessions.length) {
    sessionsList.innerHTML = '<li>Aucune session enregistrée.</li>';
  } else {
    data.sessions.slice(0, 10).forEach(s => {
      const li = document.createElement('li');
      const joined = new Date(s.joined).toLocaleString('fr-FR');
      const status = s.left ? `parti à ${new Date(s.left).toLocaleTimeString('fr-FR')}` : 'en ligne';
      li.innerHTML = `<span class="player-name" data-userid="${escapeHtml(s.userId)}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span><span>${joined} — ${status}</span>`;
      sessionsList.appendChild(li);
    });
  }

  document.querySelectorAll('#tab-activity .player-name').forEach(el => {
    el.addEventListener('click', () => showPlayerMenu(el, el.dataset.userid, el.dataset.name));
  });
}

function actionError(r, fallback) {
  return r && r.error === 'restart_in_progress' ? 'Impossible : un redémarrage est déjà en cours' : fallback;
}

document.getElementById('startBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/start');
  showToast(r && r.ok ? 'Démarrage du serveur…' : actionError(r, 'Échec du démarrage'));
  setTimeout(refreshStatus, 4000);
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  if (!confirm('Arrêter le serveur ? Les joueurs connectés seront déconnectés.')) return;
  const r = await api('POST', '/api/stop');
  showToast(r && r.ok ? 'Arrêt en cours (sauvegarde puis coupure)…' : actionError(r, 'Échec de l\'arrêt'));
  setTimeout(refreshStatus, 12000);
});

document.getElementById('restartBtn').addEventListener('click', async () => {
  if (!confirm('Redémarrer le serveur ? Les joueurs connectés seront déconnectés quelques instants.')) return;
  const r = await api('POST', '/api/restart');
  showToast(r && r.ok ? 'Redémarrage en cours…' : actionError(r, 'Échec du redémarrage'));
  setTimeout(refreshStatus, 20000);
});

// Import d'une sauvegarde externe : le zip est envoyé tel quel (streamé côté serveur) et
// rejoint la liste des sauvegardes restaurables.
document.getElementById('importBackupBtn').addEventListener('click', () => {
  document.getElementById('importBackupFile').click();
});

document.getElementById('importBackupFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = ''; // permet de réimporter le même fichier plus tard
  if (!file) return;
  if (!/\.zip$/i.test(file.name)) { showToast('Choisis un fichier .zip'); return; }
  showToast(`Import de ${file.name} en cours…`);
  try {
    const res = await fetch('/api/backups/import', { method: 'POST', body: file });
    const r = await res.json().catch(() => null);
    if (r && r.ok) {
      showToast(`Sauvegarde importée : ${r.filename}`);
      refreshBackups();
      refreshActivity();
    } else {
      showToast(
        r && r.error === 'not_a_zip' ? 'Ce fichier n\'est pas un zip valide'
        : r && r.error === 'too_large' ? 'Fichier trop volumineux (4 Go max)'
        : r && r.error === 'not_configured' ? 'BACKUP_DIR non configuré'
        : 'Échec de l\'import');
    }
  } catch {
    showToast('Échec de l\'import (connexion interrompue ?)');
  }
});

document.getElementById('backupBtn').addEventListener('click', async () => {
  showToast('Sauvegarde en cours…');
  const r = await api('POST', '/api/backup');
  showToast(r && r.ok ? 'Sauvegarde terminée' : 'Échec de la sauvegarde');
  refreshBackups();
  refreshActivity();
});

document.getElementById('saveWorldBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/save');
  showToast(r && r.ok ? 'Monde sauvegardé' : actionError(r, 'Échec de la sauvegarde'));
  refreshActivity();
});

document.getElementById('forceStopBtn').addEventListener('click', async () => {
  if (!confirm('Forcer l\'arrêt immédiat ? Aucune sauvegarde préalable — à réserver aux cas où le serveur est bloqué.')) return;
  const r = await api('POST', '/api/force-stop');
  showToast(r && r.ok ? 'Arrêt forcé envoyé' : actionError(r, 'Échec de l\'arrêt forcé'));
  setTimeout(refreshStatus, 5000);
});

document.getElementById('scheduleRestartBtn').addEventListener('click', async () => {
  const minutes = parseInt(document.getElementById('restartMinutes').value, 10) || 5;
  const r = await api('POST', '/api/schedule-restart', { minutes });
  showToast(r && r.ok ? `Redémarrage programmé dans ${r.minutes} min` : actionError(r, 'Échec de la programmation'));
  refreshStatus();
  refreshActivity();
});

document.getElementById('cancelRestartBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/cancel-restart');
  showToast(r && r.ok ? 'Redémarrage annulé' : 'Aucun redémarrage à annuler');
  refreshStatus();
  refreshActivity();
});

// ---------- Éditeur des réglages du monde (PalWorldSettings.ini) ----------
// Édition directe du fichier, autorisée uniquement serveur éteint. Le bouton alterne
// affichage/masquage ; seules les valeurs modifiées (surlignées) sont envoyées.
let settingsOriginal = {}; // clé -> valeur d'origine, pour ne poster que les changements
let settingsVisible = false;

function renderSettingsEditor(settings, running) {
  const list = document.getElementById('settingsList');
  const hint = document.getElementById('settingsHint');
  list.innerHTML = '';
  settingsOriginal = {};
  settings.forEach(({ key, value }) => {
    settingsOriginal[key] = value;
    const row = document.createElement('div');
    row.className = 'settings-row';
    const label = document.createElement('span');
    label.textContent = key;
    row.appendChild(label);

    const isPassword = /password/i.test(key);
    let input;
    if (value === 'True' || value === 'False') {
      input = document.createElement('select');
      ['True', 'False'].forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v === 'True' ? 'Oui' : 'Non';
        if (v === value) opt.selected = true;
        input.appendChild(opt);
      });
    } else {
      input = document.createElement('input');
      input.type = isPassword ? 'password' : 'text';
      input.value = value;
    }
    input.dataset.key = key;
    input.disabled = running;
    const markChanged = () => input.classList.toggle('changed', input.value !== settingsOriginal[key]);
    input.addEventListener('input', markChanged);
    input.addEventListener('change', markChanged);

    if (isPassword && input.tagName === 'INPUT') {
      // Mot de passe masqué par défaut, avec un bouton œil pour révéler
      const wrap = document.createElement('div');
      wrap.className = 'pw-wrap';
      const eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'pw-reveal';
      eye.textContent = '👁';
      eye.title = 'Afficher / masquer';
      eye.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; });
      wrap.appendChild(input);
      wrap.appendChild(eye);
      row.appendChild(wrap);
    } else {
      row.appendChild(input);
    }
    list.appendChild(row);
  });
  hint.textContent = running
    ? '🔒 Serveur en cours d\'exécution : arrête-le pour modifier les réglages (Palworld ne relit ce fichier qu\'au démarrage).'
    : '✏️ Serveur éteint : les réglages sont modifiables. Les champs modifiés sont surlignés.';
  document.getElementById('saveSettingsBtn').style.display = running ? 'none' : 'inline-block';
  document.getElementById('stopToEditBtn').style.display = (running && isManager()) ? 'inline-block' : 'none';
}

document.getElementById('stopToEditBtn').addEventListener('click', async () => {
  if (!confirm('Arrêter le serveur (avec sauvegarde) pour pouvoir modifier les réglages ? Les joueurs connectés seront déconnectés.')) return;
  const btn = document.getElementById('stopToEditBtn');
  btn.disabled = true;
  const r = await api('POST', '/api/stop');
  if (!r || !r.ok) { btn.disabled = false; showToast(actionError(r, 'Échec de l\'arrêt')); return; }
  showToast('Sauvegarde puis arrêt en cours…');

  // L'arrêt propre sauvegarde d'abord puis laisse waittime (≈10 s) à Palworld pour couper : on
  // sonde /api/settings/file (qui recalcule l'état réel du serveur) jusqu'à ce qu'il soit bien
  // arrêté, plutôt qu'un délai fixe qui pourrait tomber trop tôt.
  const waitMs = ((r.waittime || 10) + 2) * 1000;
  await new Promise(resolve => setTimeout(resolve, waitMs));
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await api('GET', '/api/settings/file');
    if (data && !data.error && !data.running) {
      renderSettingsEditor(data.settings || [], data.running);
      document.getElementById('settingsList').style.display = 'grid';
      document.getElementById('loadSettingsBtn').textContent = 'Masquer les réglages';
      settingsVisible = true;
      showToast('Serveur arrêté — réglages modifiables');
      break;
    }
    if (attempt === maxAttempts - 1) showToast('Le serveur met du temps à s\'arrêter, réessaie dans un instant');
    else await new Promise(resolve => setTimeout(resolve, 2000));
  }
  btn.disabled = false;
  refreshStatus();
});

document.getElementById('loadSettingsBtn').addEventListener('click', async () => {
  const list = document.getElementById('settingsList');
  const btn = document.getElementById('loadSettingsBtn');
  if (settingsVisible) { // referme
    list.style.display = 'none';
    document.getElementById('saveSettingsBtn').style.display = 'none';
    btn.textContent = 'Afficher les réglages';
    settingsVisible = false;
    return;
  }
  btn.disabled = true;
  const data = await api('GET', '/api/settings/file');
  btn.disabled = false;
  if (!data || data.error) {
    showToast(data && data.error === 'settings_file_not_found'
      ? 'PalWorldSettings.ini introuvable (serveur pas encore installé ?)'
      : 'Impossible de lire les réglages');
    return;
  }
  renderSettingsEditor(data.settings || [], data.running);
  list.style.display = 'grid';
  btn.textContent = 'Masquer les réglages';
  settingsVisible = true;
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const changes = {};
  document.querySelectorAll('#settingsList [data-key]').forEach(input => {
    if (input.value !== settingsOriginal[input.dataset.key]) changes[input.dataset.key] = input.value;
  });
  if (!Object.keys(changes).length) { showToast('Aucune modification à enregistrer'); return; }
  if (!confirm(`Enregistrer ${Object.keys(changes).length} réglage(s) modifié(s) ? Ils s'appliqueront au prochain démarrage du serveur.`)) return;
  const r = await api('POST', '/api/settings/file', { changes });
  if (r && r.ok) {
    showToast(`${r.changed} réglage(s) enregistré(s)`);
    Object.assign(settingsOriginal, changes);
    document.querySelectorAll('#settingsList .changed').forEach(el => el.classList.remove('changed'));
    refreshActivity();
  } else {
    showToast(
      r && r.error === 'server_running' ? 'Impossible : le serveur tourne, arrête-le d\'abord'
      : r && r.error === 'integrity_check_failed' ? 'Refusé : la modification aurait corrompu le fichier'
      : `Échec de l'enregistrement${r && r.key ? ` (${r.key})` : ''}`);
  }
});

// ---------- Mise à jour du serveur ----------
document.getElementById('checkUpdateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('checkUpdateBtn');
  const status = document.getElementById('updateStatus');
  const applyBtn = document.getElementById('applyUpdateBtn');
  btn.disabled = true;
  status.textContent = 'Vérification en cours… (SteamCMD démarre, ~30-60 s)';
  const r = await api('GET', '/api/update/check');
  btn.disabled = false;
  if (!r || r.error) {
    status.textContent = r && r.error === 'check_in_progress'
      ? 'Une vérification est déjà en cours…'
      : `Échec de la vérification : ${(r && r.error) || 'erreur inconnue'}`;
    applyBtn.style.display = 'none';
    return;
  }
  if (r.updateAvailable) {
    status.textContent = `⬆️ Mise à jour disponible : build ${r.installedBuild} → ${r.latestBuild}.`;
    applyBtn.style.display = 'inline-block';
  } else {
    status.textContent = r.installedBuild
      ? `✅ Serveur à jour (build ${r.installedBuild}).`
      : `Build installé illisible — dernier build Steam : ${r.latestBuild}.`;
    applyBtn.style.display = 'none';
  }
  refreshActivity();
});

document.getElementById('applyUpdateBtn').addEventListener('click', async () => {
  if (!confirm('Appliquer la mise à jour ? Si le serveur tourne, il sera redémarré (arrêt propre + update + relance).')) return;
  const r = await api('POST', '/api/update/apply');
  if (r && r.ok) {
    showToast(r.wasRunning ? 'Mise à jour lancée, le serveur redémarre…' : 'Mise à jour lancée (serveur arrêté, il le restera)');
    document.getElementById('applyUpdateBtn').style.display = 'none';
    document.getElementById('updateStatus').textContent = 'Mise à jour en cours… (suivi dans le journal d\'activité et Discord)';
  } else {
    showToast(actionError(r, 'Échec du lancement de la mise à jour'));
  }
  refreshActivity();
});

// Messages préréglés : boutons rapides qui envoient une annonce en un clic
const PRESET_MESSAGES = [
  'Sauvegarde imminente, tenez-vous prêts.',
  'Redémarrage bientôt, mettez-vous en lieu sûr.',
  'Bienvenue sur le serveur, amusez-vous bien !',
  'Bonne nuit à tous, le serveur reste allumé.'
];
(function renderPresets() {
  const row = document.getElementById('presetRow');
  if (!row) return;
  PRESET_MESSAGES.forEach(msg => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.type = 'button';
    btn.textContent = msg.length > 34 ? msg.slice(0, 32) + '…' : msg;
    btn.title = msg;
    btn.addEventListener('click', async () => {
      const r = await api('POST', '/api/announce', { message: msg });
      showToast(r && r.ok ? 'Annonce envoyée' : 'Échec de l\'annonce');
      refreshActivity();
    });
    row.appendChild(btn);
  });
})();

document.getElementById('announceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('announceInput');
  const r = await api('POST', '/api/announce', { message: input.value });
  showToast(r && r.ok ? 'Annonce envoyée' : 'Échec de l\'annonce');
  if (r && r.ok) input.value = '';
  refreshActivity();
});

async function refreshUsers() {
  if (!isManager()) return;
  const data = await api('GET', '/api/users');
  if (!data) return;
  const canManageAdmins = !!data.canManageAdmins; // vrai seulement pour un admin
  const usersBody = document.getElementById('usersBody');
  usersBody.innerHTML = '';
  data.users.forEach(u => {
    const tr = document.createElement('tr');
    const isSelf = u.username === currentUsername;
    // Un "user" ne peut pas toucher aux comptes admin (ni les modifier, ni les supprimer).
    const locked = isSelf || (u.role === 'admin' && !canManageAdmins);
    const adminOpt = canManageAdmins ? `<option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>` : '';
    tr.innerHTML = `
      <td>${escapeHtml(u.username)}${isSelf ? ' <span class="role-badge">toi</span>' : ''}</td>
      <td>
        <select class="role-select" data-username="${escapeHtml(u.username)}" ${locked ? 'disabled' : ''}>
          ${adminOpt}
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>Utilisateur</option>
          <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Lecture seule</option>
        </select>
      </td>
      <td class="row-actions">
        <button class="icon-btn" data-reset="${escapeHtml(u.username)}" ${locked && !isSelf ? 'disabled' : ''}>Réinitialiser mdp</button>
        <button class="icon-btn danger" data-delete="${escapeHtml(u.username)}" ${locked ? 'disabled' : ''}>Supprimer</button>
      </td>
    `;
    usersBody.appendChild(tr);
  });

  usersBody.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const r = await api('PUT', `/api/users/${encodeURIComponent(sel.dataset.username)}`, { role: sel.value });
      if (r && r.ok) showToast('Rôle mis à jour');
      else {
        showToast(r && r.error === 'last_admin' ? 'Impossible : il doit rester au moins un admin'
          : r && r.error === 'admin_required' ? 'Réservé aux admins'
          : 'Échec de la mise à jour');
        refreshUsers();
      }
    });
  });

  usersBody.querySelectorAll('[data-reset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newPass = prompt(`Nouveau mot de passe pour ${btn.dataset.reset} :`);
      if (!newPass) return;
      if (newPass.length < 6) { showToast('6 caractères minimum'); return; }
      const r = await api('PUT', `/api/users/${encodeURIComponent(btn.dataset.reset)}`, { password: newPass });
      showToast(r && r.ok ? 'Mot de passe réinitialisé' : 'Échec de la réinitialisation');
    });
  });

  usersBody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer le compte "${btn.dataset.delete}" ?`)) return;
      const r = await api('DELETE', `/api/users/${encodeURIComponent(btn.dataset.delete)}`);
      if (r && r.ok) { showToast('Compte supprimé'); refreshUsers(); }
      else showToast(r && r.error === 'last_admin' ? 'Impossible : il doit rester au moins un admin' : 'Échec de la suppression');
    });
  });
}

document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;
  const errorEl = document.getElementById('createUserError');
  errorEl.textContent = '';
  const r = await api('POST', '/api/users', { username, password, role });
  if (r && r.ok) {
    showToast('Compte créé');
    e.target.reset();
    refreshUsers();
  } else {
    errorEl.textContent =
      r && r.error === 'already_exists' ? 'Ce nom d\'utilisateur existe déjà.'
      : r && r.error === 'admin_required' ? 'Seul un admin peut créer un compte admin.'
      : r && r.error === 'password_too_short' ? 'Mot de passe : 6 caractères minimum.'
      : 'Échec de la création du compte.';
  }
});

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const errorEl = document.getElementById('passwordError');
  errorEl.textContent = '';
  const r = await api('POST', '/api/me/password', { currentPassword, newPassword });
  if (r && r.ok) {
    showToast('Mot de passe changé');
    e.target.reset();
  } else {
    errorEl.textContent = r && r.error === 'invalid_current_password' ? 'Mot de passe actuel incorrect.' : 'Échec du changement de mot de passe.';
  }
});

// ---------- Installation du serveur Palworld (visualisation uniquement) ----------
const setupChecklist = document.getElementById('setupChecklist');
const setupElevatedWarning = document.getElementById('setupElevatedWarning');

function renderSetupChecklist(status) {
  const items = [
    ['SteamCMD installé', status.steamCmdPresent],
    ['Serveur Palworld installé', status.serverInstalled],
    ['Service Windows enregistré', status.serviceRegistered],
    ['API REST configurée', status.restApiConfigured]
  ];
  setupChecklist.innerHTML = '';
  items.forEach(([label, ok]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="check-icon${ok ? ' ok' : ''}">${ok ? '✓' : '○'}</span> ${label}`;
    setupChecklist.appendChild(li);
  });
  setupElevatedWarning.style.display = status.elevated ? 'none' : 'block';
}

async function refreshSetupStatus() {
  if (currentRole !== 'admin') return;
  const data = await api('GET', '/api/setup/status');
  if (!data || data.error) return;
  renderSetupChecklist(data);
}

// ---------- Notifications Discord ----------
const discordWebhookUrl = document.getElementById('discordWebhookUrl');
const discordStatus = document.getElementById('discordStatus');
const discordRemoveBtn = document.getElementById('discordRemoveBtn');
const discordCategories = document.getElementById('discordCategories');

function renderDiscordCategories(labels, values) {
  discordCategories.innerHTML = '';
  Object.entries(labels).forEach(([key, label]) => {
    const row = document.createElement('label');
    row.className = 'switch-row';
    row.innerHTML = `<input type="checkbox" data-category="${key}" ${values[key] !== false ? 'checked' : ''}> ${label}`;
    discordCategories.appendChild(row);
  });
}

function readDiscordCategories() {
  const categories = {};
  discordCategories.querySelectorAll('input[data-category]').forEach(input => {
    categories[input.dataset.category] = input.checked;
  });
  return categories;
}

async function refreshDiscordConfig() {
  if (currentRole !== 'admin') return;
  const data = await api('GET', '/api/discord/config');
  if (!data || data.error) return;
  discordWebhookUrl.value = data.url || '';
  discordStatus.textContent = data.configured
    ? '✅ Notifications Discord activées.'
    : 'Aucun webhook configuré — colle l\'URL ci-dessus puis clique sur Enregistrer.';
  discordRemoveBtn.style.display = data.configured ? '' : 'none';
  renderDiscordCategories(data.categoryLabels || {}, data.categories || {});
}

document.getElementById('discordSaveBtn').addEventListener('click', async () => {
  const url = discordWebhookUrl.value.trim();
  if (!url) { showToast('Colle d\'abord l\'URL du webhook Discord.'); return; }
  const r = await api('POST', '/api/discord/config', { url, categories: readDiscordCategories() });
  if (r && r.ok) {
    showToast('Webhook Discord enregistré.');
    refreshDiscordConfig();
  } else {
    showToast('URL de webhook invalide.');
  }
});

document.getElementById('discordTestBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/discord/test', {});
  if (r && r.ok) showToast('Message de test envoyé, vérifie ton salon Discord !');
  else if (r && r.error === 'send_failed') showToast('Échec de l\'envoi — vérifie que l\'URL du webhook est correcte.');
  else showToast('Échec — enregistre d\'abord un webhook valide.');
});

discordRemoveBtn.addEventListener('click', async () => {
  await api('POST', '/api/discord/remove', {});
  discordWebhookUrl.value = '';
  showToast('Notifications Discord désactivées.');
  refreshDiscordConfig();
});

// ---------- Planificateur de sauvegardes automatiques ----------
// Index 0=dimanche..6=samedi (convention JS/cron, utilisée telle quelle par le backend) — mais
// affichée dans l'ordre lundi->dimanche (convention FR), via DAY_ORDER ci-dessous.
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Widgets réutilisés par les deux planificateurs (sauvegardes et redémarrage) : sélecteur de
// jours et liste d'heures avec ajout/retrait.
function renderDayPicker(containerId, selectedDays, onToggle) {
  const row = document.getElementById(containerId);
  row.innerHTML = '';
  DAY_ORDER.forEach(i => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'day-btn' + (selectedDays.includes(i) ? ' on' : '');
    btn.textContent = DAY_LABELS[i];
    btn.addEventListener('click', () => onToggle(i));
    row.appendChild(btn);
  });
}

function renderTimeChips(containerId, times, onRemove) {
  const list = document.getElementById(containerId);
  list.innerHTML = '';
  times.slice().sort().forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'time-chip';
    chip.textContent = t;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Retirer';
    x.addEventListener('click', () => onRemove(t));
    chip.appendChild(x);
    list.appendChild(chip);
  });
  if (!times.length) list.innerHTML = '<span class="muted-hint">Aucune heure — ajoutes-en une.</span>';
}

function daysSummary(days) {
  return days.length >= 7 ? 'tous les jours' : DAY_ORDER.filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(', ');
}

// ---------- Sauvegardes automatiques ----------
let bkTimes = []; // heures "HH:MM" en cours d'édition
let bkDays = [];  // jours 0..6 sélectionnés

function renderBkDays() {
  renderDayPicker('bkDays', bkDays, i => {
    bkDays = bkDays.includes(i) ? bkDays.filter(d => d !== i) : [...bkDays, i];
    renderBkDays();
  });
}

function renderBkTimes() {
  renderTimeChips('bkTimes', bkTimes, t => { bkTimes = bkTimes.filter(v => v !== t); renderBkTimes(); });
}

function summarizeBk(schedule) {
  const el = document.getElementById('bkSummary');
  el.textContent = !schedule.enabled
    ? '⏸️ Sauvegardes planifiées désactivées.'
    : `✅ ${schedule.times.join(', ')} — ${daysSummary(schedule.days)} — ${schedule.keepCount} sauvegardes conservées.`;
}

async function refreshBackupSchedule() {
  const data = await api('GET', '/api/backup/schedule');
  if (!data || !data.schedule) return;
  const s = data.schedule;
  document.getElementById('bkEnabled').checked = s.enabled;
  document.getElementById('bkKeepCount').value = s.keepCount;
  bkTimes = [...s.times];
  bkDays = [...s.days];
  renderBkDays();
  renderBkTimes();
  summarizeBk(s);
}

document.getElementById('bkAddTime').addEventListener('click', () => {
  const val = document.getElementById('bkNewTime').value;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) { showToast('Heure invalide'); return; }
  if (!bkTimes.includes(val)) bkTimes.push(val);
  renderBkTimes();
});

document.getElementById('bkSaveBtn').addEventListener('click', async () => {
  const enabled = document.getElementById('bkEnabled').checked;
  if (enabled && !bkTimes.length) { showToast('Ajoute au moins une heure'); return; }
  if (enabled && !bkDays.length) { showToast('Sélectionne au moins un jour'); return; }
  const body = {
    enabled,
    times: bkTimes,
    days: bkDays,
    keepCount: parseInt(document.getElementById('bkKeepCount').value, 10) || 14
  };
  const r = await api('POST', '/api/backup/schedule', body);
  if (r && r.ok) { showToast('Planning enregistré'); summarizeBk(r.schedule); refreshActivity(); }
  else showToast('Échec de l\'enregistrement du planning');
});

// ---------- Redémarrage automatique récurrent ----------
let rsTimes = [];
let rsDays = [];

function renderRsDays() {
  renderDayPicker('rsDays', rsDays, i => {
    rsDays = rsDays.includes(i) ? rsDays.filter(d => d !== i) : [...rsDays, i];
    renderRsDays();
  });
}

function renderRsTimes() {
  renderTimeChips('rsTimes', rsTimes, t => { rsTimes = rsTimes.filter(v => v !== t); renderRsTimes(); });
}

function summarizeRs(schedule) {
  const el = document.getElementById('rsSummary');
  el.textContent = !schedule.enabled
    ? '⏸️ Redémarrage récurrent désactivé.'
    : `✅ ${schedule.times.join(', ')} — ${daysSummary(schedule.days)} — avertissement ${schedule.warningMinutes} min avant.`;
}

async function refreshRestartSchedule() {
  const data = await api('GET', '/api/restart/schedule');
  if (!data || !data.schedule) return;
  const s = data.schedule;
  document.getElementById('rsEnabled').checked = s.enabled;
  document.getElementById('rsWarningMinutes').value = s.warningMinutes;
  rsTimes = [...s.times];
  rsDays = [...s.days];
  renderRsDays();
  renderRsTimes();
  summarizeRs(s);
}

document.getElementById('rsAddTime').addEventListener('click', () => {
  const val = document.getElementById('rsNewTime').value;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) { showToast('Heure invalide'); return; }
  if (!rsTimes.includes(val)) rsTimes.push(val);
  renderRsTimes();
});

document.getElementById('rsSaveBtn').addEventListener('click', async () => {
  const enabled = document.getElementById('rsEnabled').checked;
  if (enabled && !rsTimes.length) { showToast('Ajoute au moins une heure'); return; }
  if (enabled && !rsDays.length) { showToast('Sélectionne au moins un jour'); return; }
  const body = {
    enabled,
    times: rsTimes,
    days: rsDays,
    warningMinutes: parseInt(document.getElementById('rsWarningMinutes').value, 10) || 5
  };
  const r = await api('POST', '/api/restart/schedule', body);
  if (r && r.ok) { showToast('Planning enregistré'); summarizeRs(r.schedule); refreshActivity(); }
  else showToast('Échec de l\'enregistrement du planning');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('POST', '/api/logout');
  window.location.href = '/login.html';
});

// ---------- Navigation par onglets ----------
function activateTab(name) {
  const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  // Onglet inexistant ou masqué (ex : "Réglages" pour un viewer) : repli sur le tableau de bord
  if (!btn || btn.style.display === 'none') name = 'dash';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === `tab-${name}`));
  localStorage.setItem('activeTab', name);
  // La carte a besoin d'un redraw quand son onglet devient visible (canvas de taille nulle avant)
  if (name === 'map') requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  if (name === 'plugins') { refreshPlugins(); refreshPaldefenderApiStatus(); }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

(async function init() {
  await loadMe(); // masque d'abord les éléments admin-only (le repli d'onglet en dépend)
  activateTab(localStorage.getItem('activeTab') || 'dash');
  refreshStatus();
  refreshBackups();
  refreshActivity();
  refreshPlayerHistory();
  refreshUsers();
  refreshBans();
  refreshBackupSchedule();
  refreshRestartSchedule();
  refreshSetupStatus();
  refreshDiscordConfig();
  refreshDiskSpace();
  refreshNetworkInfo();
  refreshPaldefenderApiStatus();
  refreshDashboardUpdate();
  setInterval(refreshStatus, 15000);
  setInterval(refreshActivity, 30000);
  setInterval(refreshPlayerHistory, 30000);
  setInterval(refreshDiskSpace, 5 * 60000);
})();
