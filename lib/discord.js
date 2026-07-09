const axios = require('axios');

// Catégories d'événements notifiables, affichées comme cases à cocher dans le dashboard
// (Réglages → Notifications Discord). Activées par défaut (DISCORD_NOTIFY_<CAT> absent = activé)
// pour que les installations existantes continuent de tout recevoir sans configuration
// supplémentaire ; seule une case explicitement décochée désactive sa catégorie.
const CATEGORIES = {
  server: 'Démarrage / arrêt / redémarrage du serveur',
  players: 'Joueurs qui rejoignent / quittent',
  backups: 'Sauvegardes (manuelles, planifiées, restaurations)',
  updates: 'Mises à jour du serveur',
  admin: 'Actions admin (bans, kicks, réglages, plugins)',
  disk: 'Espace disque faible',
  restart: 'Redémarrages programmés (avertissements)'
};

function categoryEnabled(category) {
  if (!category || !CATEGORIES[category]) return true;
  return process.env[`DISCORD_NOTIFY_${category.toUpperCase()}`] !== 'false';
}

// Renvoie true si le message a bien été accepté par Discord (utilisé par le bouton
// "Envoyer un message de test" pour signaler une URL de webhook morte).
async function notify(message, category) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false; // pas configuré, on ignore silencieusement
  if (!categoryEnabled(category)) return false; // catégorie désactivée par l'utilisateur
  try {
    await axios.post(webhookUrl, { content: message });
    return true;
  } catch (err) {
    console.error('Notification Discord échouée:', err.message);
    return false;
  }
}

module.exports = { notify, CATEGORIES };
