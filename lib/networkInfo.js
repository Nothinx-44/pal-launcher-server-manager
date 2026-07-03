const os = require('os');
const axios = require('axios');

// IP locale (réseau domestique) : première IPv4 non-interne trouvée.
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// IP publique de la box : interrogée via un service externe (le serveur ne la connaît pas
// lui-même), mise en cache pour ne pas refaire la requête à chaque appel — elle ne change
// quasiment jamais pour une IP fixe.
const CACHE_MS = 10 * 60 * 1000;
let cache = { ip: null, at: 0 };

async function getPublicIp() {
  if (cache.ip && Date.now() - cache.at < CACHE_MS) return cache.ip;
  try {
    const res = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    cache = { ip: res.data.ip, at: Date.now() };
    return cache.ip;
  } catch {
    return cache.ip; // dernière valeur connue si le service est injoignable, sinon null
  }
}

module.exports = { getLocalIp, getPublicIp };
