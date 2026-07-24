// Extrait les messages de chat en jeu depuis les lignes de console.log.
// PalDefender écrit chaque message sous la forme :
//   [HH:MM:SS][info] [Chat::Global]['Pseudo' (UserId=steam_..., IP=x.x.x.x)]: le message
// On ne renvoie que ce qui est utile à l'affichage (heure, canal, pseudo, message) ; l'IP est
// volontairement ignorée (donnée sensible, inutile pour lire le chat).
const CHAT_RE = /^\[(\d{2}:\d{2}:\d{2})\]\[[^\]]*\]\s*\[Chat::([^\]]+)\]\['(.*?)'\s*\(UserId=([^,]+),[^)]*\)\]:\s?(.*)$/;

function parseChatLines(lines) {
  if (!Array.isArray(lines)) return [];
  const out = [];
  for (const line of lines) {
    const m = CHAT_RE.exec(line);
    if (!m) continue;
    out.push({
      time: m[1],
      channel: m[2],
      name: m[3],
      userId: m[4],
      message: m[5]
    });
  }
  return out;
}

module.exports = { parseChatLines };
