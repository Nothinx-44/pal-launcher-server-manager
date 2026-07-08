const axios = require('axios');

// Client pour l'API REST propre à PalDefender (distincte de l'API officielle Palworld) :
// http://127.0.0.1:17993/v1/pdapi/..., authentification par jeton Bearer. Le jeton est fourni
// par l'admin (collé dans l'onglet Plugins). Le préfixe /v1/pdapi/ EST requis pour tous les
// endpoints (confirmé dans le code source de la doc — github.com/Ultimeit/PalDefender —
// docs/en/RESTAPI/Endpoints/*.md, section "**Endpoint:**" : `POST /v1/pdapi/Broadcast`, etc.
// et vérifié empiriquement sur un serveur réel en v1.7.2). Une tentative précédente de retirer
// ce préfixe se basait sur la page web rendue du wiki, où seul le TITRE de page affiche
// "POST /Broadcast" (raccourci d'affichage) — le vrai chemin documenté dans le corps de chaque
// page garde bien le préfixe complet.
function client() {
  return axios.create({
    baseURL: process.env.PALDEFENDER_API_URL || 'http://127.0.0.1:17993',
    headers: { Authorization: `Bearer ${process.env.PALDEFENDER_API_TOKEN || ''}` },
    timeout: 8000,
    validateStatus: () => true
  });
}

async function call(method, path, body) {
  if (!process.env.PALDEFENDER_API_TOKEN) throw new Error('paldefender_not_configured');
  const res = await client().request({ method, url: path, data: body });
  if (res.status === 401) throw new Error('paldefender_invalid_token');
  if (res.status >= 400) throw new Error((res.data && res.data.Error && res.data.Error.Message) || `Erreur PalDefender (HTTP ${res.status})`);
  return res.data;
}

// Banlist autoritative de PalDefender (utilisateurs ET IP). C'est la seule source fiable pour
// débannir : un ban avec IP crée une entrée IP séparée qu'un simple /unban <userid> ne retire
// pas. Renvoie deux listes normalisées { entries: [{type:'user', id}], ips: [{type:'ip', id}] }
// filtrées sur les bans encore actifs. Renvoie null si l'API n'est pas configurée/joignable.
async function getBanlist() {
  if (!process.env.PALDEFENDER_API_TOKEN) return null;
  try {
    const data = await call('get', '/v1/pdapi/banlist?active=true');
    const bl = (data && data.Banlist) || {};
    const users = (bl.UserEntries || []).filter(e => e.Active !== false).map(e => ({ type: 'user', id: e.UserId }));
    const ips = (bl.IPEntries || []).filter(e => e.Active !== false).map(e => ({ type: 'ip', id: e.IP }));
    return [...users, ...ips];
  } catch {
    return null; // API injoignable : l'appelant retombe sur data/bans.json
  }
}

// Commandes "principales" exposées par l'onglet Tableau de bord (le reste — items/pals/tech —
// nécessiterait une base d'identifiants d'objets que ce dashboard n'a pas).
const COMMANDS = {
  kick: { label: 'Kick', needsPlayer: true, fields: ['Reason'], run: (id, f) => call('post', `/v1/pdapi/kick/${encodeURIComponent(id)}`, { Reason: f.Reason || undefined }) },
  ban: { label: 'Ban', needsPlayer: true, fields: ['Reason', 'IP'], run: (id, f) => call('post', `/v1/pdapi/ban/${encodeURIComponent(id)}`, { Reason: f.Reason || undefined, IP: !!f.IP }) },
  unban: { label: 'Débannir', needsPlayer: true, fields: ['Reason'], run: (id, f) => call('post', `/v1/pdapi/unban/${encodeURIComponent(id)}`, { Reason: f.Reason || undefined }) },
  banip: { label: 'Bannir une IP', needsIp: true, fields: ['Reason'], run: (ip, f) => call('post', `/v1/pdapi/banip/${encodeURIComponent(ip)}`, { Reason: f.Reason || undefined }) },
  unbanip: { label: 'Débannir une IP', needsIp: true, fields: ['Reason'], run: (ip, f) => call('post', `/v1/pdapi/unbanip/${encodeURIComponent(ip)}`, { Reason: f.Reason || undefined }) },
  broadcast: { label: 'Annonce (Broadcast)', fields: ['Message', 'Sender'], run: (_id, f) => call('post', '/v1/pdapi/Broadcast', { Message: f.Message, Sender: f.Sender || undefined }) },
  alert: { label: 'Alerte', fields: ['Message'], run: (_id, f) => call('post', '/v1/pdapi/Alert', { Message: f.Message }) },
  message: {
    label: 'Message à un joueur', needsPlayer: true, fields: ['Message', 'SendType'],
    run: (id, f) => call('post', '/v1/pdapi/SendPlayerMessage', { SendType: f.SendType || 'PlayerChat', UserID: id, Message: f.Message })
  }
};

module.exports = { COMMANDS, call, getBanlist };
