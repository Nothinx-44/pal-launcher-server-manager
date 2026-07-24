// Internationalisation FR/EN/ZH/ES. Le français reste la langue source du code (HTML/JS
// inchangés) ; pour les autres langues, un dictionnaire "texte français -> [en, zh, es]" est
// appliqué automatiquement à tout le DOM (au chargement + MutationObserver pour le contenu
// dynamique), plus des motifs regex pour les textes contenant des variables. confirm/alert/prompt
// sont traduits au vol. Toute clé/motif sans traduction zh/es retombe sur l'anglais (jamais sur le
// français) pour un public international. Langue : localStorage 'lang', sinon détection navigateur.
(function () {
  const SUPPORTED = ['fr', 'en', 'zh', 'es'];
  const stored = localStorage.getItem('lang');
  const nav = (navigator.language || '').toLowerCase();
  const detected = nav.startsWith('fr') ? 'fr' : nav.startsWith('zh') ? 'zh' : nav.startsWith('es') ? 'es' : 'en';
  const LANG = SUPPORTED.includes(stored) ? stored : detected;
  // Index dans les tableaux de traduction [en, zh, es] ; -1 = français (texte source, pas de dico)
  const IDX = { en: 0, zh: 1, es: 2 }[LANG];

  // ---------- Dictionnaire (correspondances exactes, texte "trimé") : 'fr': [en, zh, es] ----------
  const T = {
    // Login
    'Connexion — Pal Launcher Server Manager': ['Sign in — Pal Launcher Server Manager', '登录 — Pal Launcher Server Manager', 'Iniciar sesión — Pal Launcher Server Manager'],
    "Nom d'utilisateur": ['Username', '用户名', 'Nombre de usuario'],
    'Mot de passe': ['Password', '密码', 'Contraseña'],
    'Se connecter': ['Sign in', '登录', 'Iniciar sesión'],
    'Trop de tentatives, réessaie dans quelques minutes.': ['Too many attempts, try again in a few minutes.', '尝试次数过多，请几分钟后再试。', 'Demasiados intentos, vuelve a intentarlo en unos minutos.'],
    'Identifiants incorrects.': ['Invalid credentials.', '用户名或密码错误。', 'Credenciales incorrectas.'],
    // Header / nav
    'Se déconnecter': ['Sign out', '退出登录', 'Cerrar sesión'],
    'Vérification du serveur…': ['Checking server…', '正在检查服务器…', 'Comprobando el servidor…'],
    'Tableau de bord': ['Dashboard', '仪表盘', 'Panel de control'],
    'Carte': ['Map', '地图', 'Mapa'],
    'Activité': ['Activity', '活动', 'Actividad'],
    'Sauvegardes': ['Backups', '备份', 'Copias de seguridad'],
    'Réglages': ['Settings', '设置', 'Ajustes'],
    'Comptes': ['Accounts', '账户', 'Cuentas'],
    'Admin': ['Admin', '管理员', 'Admin'],
    'Utilisateur': ['User', '用户', 'Usuario'],
    'Lecture seule': ['Read-only', '只读', 'Solo lectura'],
    // Infos serveur
    'Informations serveur': ['Server information', '服务器信息', 'Información del servidor'],
    'Statut': ['Status', '状态', 'Estado'],
    'Version': ['Version', '版本', 'Versión'],
    'Joueurs': ['Players', '玩家', 'Jugadores'],
    'Uptime': ['Uptime', '运行时间', 'Tiempo activo'],
    'FPS serveur': ['Server FPS', '服务器 FPS', 'FPS del servidor'],
    'Jours en jeu': ['In-game days', '游戏内天数', 'Días en el juego'],
    'En ligne': ['Online', '在线', 'En línea'],
    'Hors ligne': ['Offline', '离线', 'Desconectado'],
    'Serveur arrêté ou injoignable': ['Server stopped or unreachable', '服务器已停止或无法访问', 'Servidor detenido o inaccesible'],
    // Adresse
    'Adresse pour rejoindre le serveur': ['Server join address', '服务器加入地址', 'Dirección para unirse al servidor'],
    'Sur ce réseau (amis chez toi / sur ta Wi-Fi)': ['On this network (friends at your place / on your Wi-Fi)', '本地网络（在你家 / 同一 Wi-Fi 的朋友）', 'En esta red (amigos en tu casa / en tu Wi-Fi)'],
    'Copier': ['Copy', '复制', 'Copiar'],
    'Depuis internet (après redirection de port sur ta box)': ['From the internet (after port forwarding on your router)', '从互联网（需在路由器上做端口转发）', 'Desde internet (tras redirigir el puerto en tu router)'],
    "C'est le port de jeu (UDP) — à donner à tes amis pour rejoindre depuis le client Palworld. Pour un accès depuis internet, vérifie qu'il est bien redirigé sur ta box.":
      ['This is the game port (UDP) — give it to your friends to join from the Palworld client. For internet access, make sure it is forwarded on your router.',
       '这是游戏端口（UDP）——把它告诉朋友即可从 Palworld 客户端加入。若需从互联网访问，请确认已在路由器上做好端口转发。',
       'Este es el puerto de juego (UDP): dáselo a tus amigos para unirse desde el cliente de Palworld. Para acceso desde internet, comprueba que esté redirigido en tu router.'],
    'Serveur pas encore installé': ['Server not installed yet', '服务器尚未安装', 'Servidor aún no instalado'],
    'Indisponible (pas de connexion internet ?)': ['Unavailable (no internet connection?)', '不可用（没有网络连接？）', 'No disponible (¿sin conexión a internet?)'],
    'Copié !': ['Copied!', '已复制！', '¡Copiado!'],
    'Impossible de copier': ['Could not copy', '无法复制', 'No se pudo copiar'],
    // Contrôle serveur
    'Contrôle du serveur': ['Server control', '服务器控制', 'Control del servidor'],
    'Démarrer': ['Start', '启动', 'Iniciar'],
    'Redémarrer': ['Restart', '重启', 'Reiniciar'],
    'Sauvegarder le monde': ['Save world', '保存世界', 'Guardar el mundo'],
    'Arrêter': ['Stop', '停止', 'Detener'],
    "Forcer l'arrêt": ['Force stop', '强制停止', 'Forzar detención'],
    'Redémarrage programmé dans': ['Schedule restart in', '计划重启于', 'Programar reinicio en'],
    'min': ['min', '分钟', 'min'],
    'Programmer': ['Schedule', '计划', 'Programar'],
    'Annuler': ['Cancel', '取消', 'Cancelar'],
    'Démarrage du serveur…': ['Starting server…', '正在启动服务器…', 'Iniciando el servidor…'],
    'Échec du démarrage': ['Failed to start', '启动失败', 'Error al iniciar'],
    'Arrêt en cours (sauvegarde puis coupure)…': ['Stopping (saving then shutting down)…', '正在停止（先保存再关闭）…', 'Deteniendo (guardando y apagando)…'],
    "Échec de l'arrêt": ['Failed to stop', '停止失败', 'Error al detener'],
    'Redémarrage en cours…': ['Restarting…', '正在重启…', 'Reiniciando…'],
    'Échec du redémarrage': ['Failed to restart', '重启失败', 'Error al reiniciar'],
    'Arrêt forcé envoyé': ['Force stop sent', '已发送强制停止命令', 'Detención forzada enviada'],
    "Échec de l'arrêt forcé": ['Force stop failed', '强制停止失败', 'Error en la detención forzada'],
    'Monde sauvegardé': ['World saved', '世界已保存', 'Mundo guardado'],
    'Redémarrage annulé': ['Restart cancelled', '重启已取消', 'Reinicio cancelado'],
    'Aucun redémarrage à annuler': ['No restart to cancel', '没有可取消的重启', 'No hay reinicio que cancelar'],
    'Échec de la programmation': ['Scheduling failed', '计划失败', 'Error al programar'],
    'Sauvegarde puis arrêt en cours…': ['Saving then stopping…', '正在保存并停止…', 'Guardando y deteniendo…'],
    'Impossible : un redémarrage est déjà en cours': ['Not possible: a restart is already in progress', '无法执行：已有重启正在进行', 'No es posible: ya hay un reinicio en curso'],
    'Arrêter le serveur ? Les joueurs connectés seront déconnectés.': ['Stop the server? Connected players will be disconnected.', '停止服务器？在线玩家将被断开连接。', '¿Detener el servidor? Los jugadores conectados serán desconectados.'],
    'Redémarrer le serveur ? Les joueurs connectés seront déconnectés quelques instants.': ['Restart the server? Connected players will be disconnected for a moment.', '重启服务器？在线玩家将短暂断开连接。', '¿Reiniciar el servidor? Los jugadores conectados se desconectarán unos instantes.'],
    "Forcer l'arrêt immédiat ? Aucune sauvegarde préalable — à réserver aux cas où le serveur est bloqué.": ['Force an immediate stop? No prior save — only for when the server is stuck.', '立即强制停止？不会预先保存——仅在服务器卡死时使用。', '¿Forzar una detención inmediata? Sin guardado previo: solo para cuando el servidor está bloqueado.'],
    // Joueurs
    'Joueurs connectés': ['Connected players', '在线玩家', 'Jugadores conectados'],
    'Nom': ['Name', '名称', 'Nombre'],
    'Niveau': ['Level', '等级', 'Nivel'],
    'Guilde': ['Guild', '公会', 'Gremio'],
    'Ping': ['Ping', '延迟', 'Ping'],
    'Aucun joueur connecté.': ['No players connected.', '当前没有在线玩家。', 'No hay jugadores conectados.'],
    'Kick': ['Kick', '踢出', 'Expulsar'],
    'Bannir': ['Ban', '封禁', 'Banear'],
    'Exclure ce joueur du serveur ?': ['Kick this player from the server?', '将该玩家踢出服务器？', '¿Expulsar a este jugador del servidor?'],
    'Joueur exclu': ['Player kicked', '玩家已被踢出', 'Jugador expulsado'],
    'Échec du kick': ['Kick failed', '踢出失败', 'Error al expulsar'],
    'Joueur banni': ['Player banned', '玩家已被封禁', 'Jugador baneado'],
    'Échec du ban': ['Ban failed', '封禁失败', 'Error al banear'],
    'Joueur débanni': ['Player unbanned', '玩家已解封', 'Jugador desbaneado'],
    'Échec du déban': ['Unban failed', '解封失败', 'Error al desbanear'],
    '📊 Voir les stats': ['📊 View stats', '📊 查看统计', '📊 Ver estadísticas'],
    '🔨 Bannir': ['🔨 Ban', '🔨 封禁', '🔨 Banear'],
    'inconnue': ['unknown', '未知', 'desconocida'],
    'en ligne': ['online', '在线', 'en línea'],
    'Temps de jeu total': ['Total playtime', '总游戏时间', 'Tiempo de juego total'],
    'Sessions': ['Sessions', '会话数', 'Sesiones'],
    'Dernière connexion': ['Last seen', '最后上线', 'Última conexión'],
    'IP utilisées': ['IPs used', '使用过的 IP', 'IPs usadas'],
    // Annonces
    'Annonce': ['Announcement', '公告', 'Anuncio'],
    'Envoyer': ['Send', '发送', 'Enviar'],
    'Message à afficher aux joueurs…': ['Message to show to players…', '要向玩家显示的消息…', 'Mensaje para mostrar a los jugadores…'],
    'Annonce envoyée': ['Announcement sent', '公告已发送', 'Anuncio enviado'],
    "Échec de l'annonce": ['Announcement failed', '公告发送失败', 'Error al enviar el anuncio'],
    'Sauvegarde imminente, tenez-vous prêts.': ['Save incoming, get ready.', '即将保存，请做好准备。', 'Guardado inminente, prepárense.'],
    'Redémarrage bientôt, mettez-vous en lieu sûr.': ['Restart soon, get to a safe place.', '即将重启，请前往安全地点。', 'Reinicio pronto, pónganse a salvo.'],
    'Bienvenue sur le serveur, amusez-vous bien !': ['Welcome to the server, have fun!', '欢迎来到服务器，玩得开心！', '¡Bienvenidos al servidor, que se diviertan!'],
    'Bonne nuit à tous, le serveur reste allumé.': ['Good night everyone, the server stays up.', '大家晚安，服务器保持在线。', 'Buenas noches a todos, el servidor sigue encendido.'],
    // Commandes admin PalDefender
    'Commandes Admin': ['Admin Commands', '管理员命令', 'Comandos de administrador'],
    '(PalDefender)': ['(PalDefender)', '(PalDefender)', '(PalDefender)'],
    "API PalDefender non configurée — configure-la depuis l'onglet Plugins.": ['PalDefender API not configured — set it up from the Plugins tab.', 'PalDefender API 未配置——请在“插件”标签页中设置。', 'API de PalDefender no configurada: configúrala desde la pestaña Plugins.'],
    'Kick un joueur': ['Kick a player', '踢出玩家', 'Expulsar a un jugador'],
    'Bannir un joueur': ['Ban a player', '封禁玩家', 'Banear a un jugador'],
    'Débannir un joueur': ['Unban a player', '解封玩家', 'Desbanear a un jugador'],
    'Bannir une IP': ['Ban an IP', '封禁 IP', 'Banear una IP'],
    'Débannir une IP': ['Unban an IP', '解封 IP', 'Desbanear una IP'],
    'Message à un joueur': ['Message a player', '私信玩家', 'Mensaje a un jugador'],
    'Annonce (Broadcast)': ['Announcement (Broadcast)', '公告（广播）', 'Anuncio (Broadcast)'],
    'Alerte': ['Alert', '警报', 'Alerta'],
    'Fréquentation': ['Player activity', '在线人数', 'Actividad de jugadores'],
    '24 h': ['24 h', '24 小时', '24 h'],
    '7 jours': ['7 days', '7 天', '7 días'],
    'Pas encore assez de données — la courbe se remplit toutes les 5 minutes.': ['Not enough data yet — the curve fills in every 5 minutes.', '数据还不够——曲线每 5 分钟补充一次。', 'Aún no hay suficientes datos: la curva se completa cada 5 minutos.'],
    'Pic :': ['Peak:', '峰值：', 'Pico:'],
    'Serveur hors ligne': ['Server offline', '服务器离线', 'Servidor desconectado'],
    'joueur(s)': ['player(s)', '名玩家', 'jugador(es)'],
    'Chat joueur': ['Player chat', '玩家聊天', 'Chat de jugador'],
    'Chat global': ['Global chat', '全局聊天', 'Chat global'],
    'Log normal': ['Normal log', '普通日志', 'Registro normal'],
    'Log important': ['Important log', '重要日志', 'Registro importante'],
    'Log très important': ['Very important log', '非常重要日志', 'Registro muy importante'],
    "Bannir aussi l'IP de ce joueur": ["Also ban this player's IP", '同时封禁该玩家的 IP', 'Banear también la IP de este jugador'],
    'Exécuter': ['Run', '执行', 'Ejecutar'],
    'Joueur (nom ou UserId) ou IP': ['Player (name or UserId) or IP', '玩家（名称或 UserId）或 IP', 'Jugador (nombre o UserId) o IP'],
    'Message': ['Message', '消息', 'Mensaje'],
    'Raison (optionnel)': ['Reason (optional)', '原因（可选）', 'Motivo (opcional)'],
    "Nom de l'expéditeur (optionnel)": ['Sender name (optional)', '发送者名称（可选）', 'Nombre del remitente (opcional)'],
    'Commande exécutée': ['Command executed', '命令已执行', 'Comando ejecutado'],
    'API PalDefender non configurée': ['PalDefender API not configured', 'PalDefender API 未配置', 'API de PalDefender no configurada'],
    // Carte
    'Carte en direct': ['Live map', '实时地图', 'Mapa en vivo'],
    'Île principale': ['Main Island', '主岛', 'Isla principal'],
    'Île de l\'Arbre': ['Tree Island', '巨树岛', 'Isla del Árbol'],
    'Molette : zoom — Glisser : déplacer.': ['Wheel: zoom — Drag: pan.', '滚轮：缩放 — 拖动：平移。', 'Rueda: zoom — Arrastrar: mover.'],
    'Bases': ['Bases', '基地', 'Bases'],
    'Filtrer (guilde…)': ['Filter (guild…)', '筛选（公会…）', 'Filtrar (gremio…)'],
    'Aucune base détectée pour le moment.': ['No base detected yet.', '暂未检测到基地。', 'Aún no se ha detectado ninguna base.'],
    'Les bases nécessitent PalDefender (non configuré sur ce serveur). Installe-le depuis l\'onglet Plugins.': ['Bases require PalDefender (not configured on this server). Install it from the Plugins tab.', '基地功能需要 PalDefender（此服务器未配置）。请在“插件”标签页中安装。', 'Las bases requieren PalDefender (no configurado en este servidor). Instálalo desde la pestaña Plugins.'],
    'ℹ️ La colonne Guilde nécessite PalDefender (non configuré sur ce serveur).': ['ℹ️ The Guild column requires PalDefender (not configured on this server).', 'ℹ️ 公会列需要 PalDefender（此服务器未配置）。', 'ℹ️ La columna Gremio requiere PalDefender (no configurado en este servidor).'],
    'Position': ['Position', '位置', 'Posición'],
    'Dernier membre vu': ['Last member seen', '最后上线的成员', 'Último miembro visto'],
    'Inconnu': ['Unknown', '未知', 'Desconocido'],
    'Active': ['Active', '活跃', 'Activa'],
    '⚠️ Abandonnée': ['⚠️ Abandoned', '⚠️ 已废弃', '⚠️ Abandonada'],
    // Activité
    'Historique des joueurs': ['Player history', '玩家历史', 'Historial de jugadores'],
    'Tous les joueurs (déjà connectés au moins une fois)': ['All players (ever connected at least once)', '所有玩家（曾经至少连接过一次）', 'Todos los jugadores (que se conectaron alguna vez)'],
    'Filtrer (pseudo, IP, guilde…)': ['Filter (name, IP, guild…)', '筛选（昵称、IP、公会…）', 'Filtrar (nombre, IP, gremio…)'],
    'Aucun joueur enregistré pour le moment.': ['No players recorded yet.', '暂无已记录的玩家。', 'Aún no hay jugadores registrados.'],
    'Temps de jeu': ['Playtime', '游戏时长', 'Tiempo de juego'],
    'Première connexion': ['First seen', '首次上线', 'Primera conexión'],
    'Pas encore de données.': ['No data yet.', '暂无数据。', 'Aún no hay datos.'],
    'Dernières sessions': ['Recent sessions', '最近会话', 'Sesiones recientes'],
    "Journal d'activité": ['Activity log', '活动日志', 'Registro de actividad'],
    'Aucune activité enregistrée.': ['No activity recorded.', '没有记录的活动。', 'No hay actividad registrada.'],
    'Aucun résultat pour ce filtre.': ['No results for this filter.', '没有符合该筛选的结果。', 'No hay resultados para este filtro.'],
    'Filtrer (pseudo, action…)': ['Filter (name, action…)', '筛选（昵称、操作…）', 'Filtrar (nombre, acción…)'],
    'Aucune session enregistrée.': ['No sessions recorded.', '没有记录的会话。', 'No hay sesiones registradas.'],
    'Joueurs bannis': ['Banned players', '被封禁的玩家', 'Jugadores baneados'],
    'Aucun joueur banni.': ['No banned players.', '没有被封禁的玩家。', 'No hay jugadores baneados.'],
    'Chat en jeu': ['In-game chat', '游戏内聊天', 'Chat del juego'],
    'Filtrer (pseudo, message…)': ['Filter (name, message…)', '筛选（昵称、消息…）', 'Filtrar (nombre, mensaje…)'],
    'Aucun message de chat pour le moment.': ['No chat messages yet.', '暂无聊天消息。', 'Aún no hay mensajes de chat.'],
    'Écrire dans le chat du jeu…': ['Write in the game chat…', '在游戏聊天中输入…', 'Escribir en el chat del juego…'],
    'Envoyer': ['Send', '发送', 'Enviar'],
    'Débannir': ['Unban', '解封', 'Desbanear'],
    '← Précédent': ['← Previous', '← 上一页', '← Anterior'],
    'Suivant →': ['Next →', '下一页 →', 'Siguiente →'],
    // Sauvegardes
    'Sauvegarder maintenant': ['Back up now', '立即备份', 'Hacer copia ahora'],
    'Importer un zip…': ['Import a zip…', '导入 zip…', 'Importar un zip…'],
    'Télécharger': ['Download', '下载', 'Descargar'],
    'Restaurer': ['Restore', '恢复', 'Restaurar'],
    'Aucune sauvegarde pour le moment.': ['No backups yet.', '暂无备份。', 'Aún no hay copias de seguridad.'],
    'Sauvegarde en cours…': ['Backing up…', '正在备份…', 'Haciendo copia…'],
    'Sauvegarde terminée': ['Backup complete', '备份完成', 'Copia completada'],
    'Échec de la sauvegarde': ['Backup failed', '备份失败', 'Error en la copia'],
    'Restauré': ['Restored', '已恢复', 'Restaurado'],
    "Impossible : arrête le serveur d'abord": ['Not possible: stop the server first', '无法执行：请先停止服务器', 'No es posible: detén primero el servidor'],
    'SAVE_PATH/BACKUP_DIR non configurés': ['SAVE_PATH/BACKUP_DIR not configured', '未配置 SAVE_PATH/BACKUP_DIR', 'SAVE_PATH/BACKUP_DIR no configurados'],
    'Échec de la restauration': ['Restore failed', '恢复失败', 'Error al restaurar'],
    'Choisis un fichier .zip': ['Choose a .zip file', '请选择一个 .zip 文件', 'Elige un archivo .zip'],
    "Ce fichier n'est pas un zip valide": ['This file is not a valid zip', '该文件不是有效的 zip', 'Este archivo no es un zip válido'],
    'Fichier trop volumineux (4 Go max)': ['File too large (4 GB max)', '文件过大（最大 4 GB）', 'Archivo demasiado grande (máx. 4 GB)'],
    'BACKUP_DIR non configuré': ['BACKUP_DIR not configured', '未配置 BACKUP_DIR', 'BACKUP_DIR no configurado'],
    "Échec de l'import": ['Import failed', '导入失败', 'Error al importar'],
    "Échec de l'import (connexion interrompue ?)": ['Import failed (connection interrupted?)', '导入失败（连接中断？）', 'Error al importar (¿conexión interrumpida?)'],
    'Sauvegardes automatiques': ['Automatic backups', '自动备份', 'Copias automáticas'],
    'Activer les sauvegardes planifiées': ['Enable scheduled backups', '启用计划备份', 'Activar copias programadas'],
    'Jours': ['Days', '星期', 'Días'],
    'Heures (plusieurs possibles)': ['Times (multiple allowed)', '时间（可多个）', 'Horas (varias posibles)'],
    'Ajouter': ['Add', '添加', 'Añadir'],
    'Sauvegardes conservées': ['Backups kept', '保留的备份数', 'Copias conservadas'],
    'les plus anciennes au-delà sont supprimées': ['oldest beyond this are deleted', '超出后最旧的将被删除', 'las más antiguas se eliminan'],
    'Enregistrer le planning': ['Save schedule', '保存计划', 'Guardar programación'],
    'Planning enregistré': ['Schedule saved', '计划已保存', 'Programación guardada'],
    "Échec de l'enregistrement du planning": ['Failed to save schedule', '计划保存失败', 'Error al guardar la programación'],
    'Heure invalide': ['Invalid time', '时间无效', 'Hora no válida'],
    'Ajoute au moins une heure': ['Add at least one time', '请至少添加一个时间', 'Añade al menos una hora'],
    'Sélectionne au moins un jour': ['Select at least one day', '请至少选择一天', 'Selecciona al menos un día'],
    'Aucune heure — ajoutes-en une.': ['No times — add one.', '没有时间——请添加一个。', 'Sin horas: añade una.'],
    '⏸️ Sauvegardes planifiées désactivées.': ['⏸️ Scheduled backups disabled.', '⏸️ 计划备份已禁用。', '⏸️ Copias programadas desactivadas.'],
    'tous les jours': ['every day', '每天', 'todos los días'],
    'Dim': ['Sun', '周日', 'Dom'], 'Lun': ['Mon', '周一', 'Lun'], 'Mar': ['Tue', '周二', 'Mar'], 'Mer': ['Wed', '周三', 'Mié'], 'Jeu': ['Thu', '周四', 'Jue'], 'Ven': ['Fri', '周五', 'Vie'], 'Sam': ['Sat', '周六', 'Sáb'],
    // Mise à jour serveur
    'Mise à jour du serveur': ['Server update', '服务器更新', 'Actualización del servidor'],
    'Vérifier les mises à jour': ['Check for updates', '检查更新', 'Buscar actualizaciones'],
    'Appliquer la mise à jour': ['Apply update', '应用更新', 'Aplicar actualización'],
    'Compare le build installé au dernier build Steam (via SteamCMD).': ['Compares the installed build with the latest Steam build (via SteamCMD).', '将已安装版本与 Steam 最新版本进行比较（通过 SteamCMD）。', 'Compara la versión instalada con la última de Steam (vía SteamCMD).'],
    'Vérification en cours… (SteamCMD démarre, ~30-60 s)': ['Checking… (SteamCMD is starting, ~30-60 s)', '正在检查…（SteamCMD 启动中，约 30-60 秒）', 'Comprobando… (SteamCMD arrancando, ~30-60 s)'],
    'Une vérification est déjà en cours…': ['A check is already in progress…', '已有检查正在进行…', 'Ya hay una comprobación en curso…'],
    "Mise à jour en cours… (suivi dans le journal d'activité et Discord)": ['Updating… (follow along in the activity log and Discord)', '正在更新…（可在活动日志和 Discord 中跟踪）', 'Actualizando… (síguelo en el registro de actividad y Discord)'],
    'Mise à jour lancée, le serveur redémarre…': ['Update started, the server is restarting…', '更新已开始，服务器正在重启…', 'Actualización iniciada, el servidor se está reiniciando…'],
    'Mise à jour lancée (serveur arrêté, il le restera)': ['Update started (server is stopped and will stay stopped)', '更新已开始（服务器已停止，将保持停止）', 'Actualización iniciada (el servidor está detenido y seguirá así)'],
    'Appliquer la mise à jour ? Une sauvegarde de sécurité est prise avant. Si le serveur tourne, il sera redémarré (arrêt propre + update + relance).': ['Apply the update? A safety backup is taken first. If the server is running it will be restarted (clean stop + update + start).', '应用更新？会先进行一次安全备份。如果服务器正在运行，将会重启（正常停止 + 更新 + 启动）。', '¿Aplicar la actualización? Antes se hace una copia de seguridad. Si el servidor está en marcha, se reiniciará (parada limpia + actualización + arranque).'],
    'Échec du lancement de la mise à jour': ['Failed to start the update', '更新启动失败', 'Error al iniciar la actualización'],
    // Installation
    'Installation du serveur': ['Server installation', '服务器安装', 'Instalación del servidor'],
    "J'ai déjà un serveur Palworld installé (ne pas re-télécharger)": ["I already have a Palworld server installed (don't re-download)", '我已安装 Palworld 服务器（不要重新下载）', 'Ya tengo un servidor de Palworld instalado (no volver a descargar)'],
    'Indique directement le dossier qui contient': ['Point directly to the folder that contains', '直接指定包含以下文件的文件夹：', 'Indica directamente la carpeta que contiene'],
    '(pas besoin du sous-dossier "Server"). Les mots de passe déjà en place sont conservés si tu laisses les champs ci-dessous vides.':
      ['(no need for the "Server" subfolder). Passwords already in place are kept if you leave the fields below empty.',
       '（无需 "Server" 子文件夹）。如下方字段留空，已有的密码将被保留。',
       '(no hace falta la subcarpeta "Server"). Las contraseñas existentes se conservan si dejas vacíos los campos de abajo.'],
    'Dossier du serveur (contient PalServer.exe)': ['Server folder (contains PalServer.exe)', '服务器文件夹（包含 PalServer.exe）', 'Carpeta del servidor (contiene PalServer.exe)'],
    "laisse vide pour conserver l'existant": ['leave empty to keep the existing one', '留空以保留现有值', 'deja vacío para conservar el existente'],
    'Mot de passe admin : 6 caractères minimum si renseigné.': ['Admin password: 6 characters minimum if provided.', '管理员密码：如填写，至少 6 个字符。', 'Contraseña de admin: mínimo 6 caracteres si se indica.'],
    "⚠️ Le dashboard ne semble pas tourner avec des droits administrateur : l'installation (service Windows, pare-feu) risque d'échouer.": ['⚠️ The dashboard does not seem to be running with administrator rights: installation (Windows service, firewall) may fail.', '⚠️ 仪表盘似乎没有以管理员权限运行：安装（Windows 服务、防火墙）可能会失败。', '⚠️ El panel no parece ejecutarse con derechos de administrador: la instalación (servicio de Windows, firewall) puede fallar.'],
    "Lancer l'installation": ['Start installation', '开始安装', 'Iniciar instalación'],
    'SteamCMD installé': ['SteamCMD installed', 'SteamCMD 已安装', 'SteamCMD instalado'],
    'Serveur Palworld installé': ['Palworld server installed', 'Palworld 服务器已安装', 'Servidor de Palworld instalado'],
    'Service Windows enregistré': ['Windows service registered', 'Windows 服务已注册', 'Servicio de Windows registrado'],
    'API REST configurée': ['REST API configured', 'REST API 已配置', 'API REST configurada'],
    "Dossier d'installation (ex: D:\\PalworldServer)": ['Install folder (e.g. D:\\PalworldServer)', '安装文件夹（例：D:\\PalworldServer）', 'Carpeta de instalación (ej.: D:\\PalworldServer)'],
    'Dossier SteamCMD': ['SteamCMD folder', 'SteamCMD 文件夹', 'Carpeta de SteamCMD'],
    'Chemin nssm.exe': ['nssm.exe path', 'nssm.exe 路径', 'Ruta de nssm.exe'],
    'Nom du service Windows': ['Windows service name', 'Windows 服务名称', 'Nombre del servicio de Windows'],
    'Nom du serveur': ['Server name', '服务器名称', 'Nombre del servidor'],
    'Mot de passe serveur (optionnel)': ['Server password (optional)', '服务器密码（可选）', 'Contraseña del servidor (opcional)'],
    'Mot de passe admin (6 caractères min., requis pour l\'API REST)': ['Admin password (6 chars min., required for the REST API)', '管理员密码（至少 6 个字符，REST API 必需）', 'Contraseña de admin (mín. 6 caracteres, requerida para la API REST)'],
    'Joueurs max': ['Max players', '最大玩家数', 'Jugadores máx.'],
    'Port de jeu (UDP)': ['Game port (UDP)', '游戏端口（UDP）', 'Puerto de juego (UDP)'],
    'Port de requête (Steam query)': ['Query port (Steam query)', '查询端口（Steam query）', 'Puerto de consulta (Steam query)'],
    'Port API REST': ['REST API port', 'REST API 端口', 'Puerto de la API REST'],
    'Dossier de sauvegardes': ['Backups folder', '备份文件夹', 'Carpeta de copias'],
    'Mot de passe admin requis (6 caractères min.).': ['Admin password required (6 chars min.).', '需要管理员密码（至少 6 个字符）。', 'Se requiere contraseña de admin (mín. 6 caracteres).'],
    'Une installation est déjà en cours.': ['An installation is already in progress.', '已有安装正在进行。', 'Ya hay una instalación en curso.'],
    "Échec du lancement de l'installation.": ['Failed to start the installation.', '安装启动失败。', 'Error al iniciar la instalación.'],
    'Installation terminée': ['Installation complete', '安装完成', 'Instalación completada'],
    // Notifications Discord
    'Notifications Discord': ['Discord notifications', 'Discord 通知', 'Notificaciones de Discord'],
    'Reçois une alerte dans un salon Discord à chaque événement (démarrage/arrêt, joueur qui rejoint/quitte, sauvegarde, mise à jour, espace disque faible…).':
      ['Get an alert in a Discord channel for every event (start/stop, player join/leave, backup, update, low disk space…).',
       '在 Discord 频道中接收每个事件的提醒（启动/停止、玩家加入/离开、备份、更新、磁盘空间不足…）。',
       'Recibe una alerta en un canal de Discord por cada evento (inicio/parada, jugadores que entran/salen, copias, actualizaciones, poco espacio en disco…).'],
    'Comment créer un webhook Discord ?': ['How to create a Discord webhook?', '如何创建 Discord webhook？', '¿Cómo crear un webhook de Discord?'],
    "(Paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL du webhook)":
      ['(Channel settings → Integrations → Webhooks → New webhook → Copy webhook URL)',
       '（频道设置 → 整合 → Webhook → 新建 Webhook → 复制 Webhook URL）',
       '(Ajustes del canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL del webhook)'],
    'Langue des messages': ['Message language', '消息语言', 'Idioma de los mensajes'],
    'Notifications à recevoir': ['Notifications to receive', '要接收的通知', 'Notificaciones a recibir'],
    'Démarrage / arrêt / redémarrage du serveur': ['Server start / stop / restart', '服务器启动 / 停止 / 重启', 'Inicio / parada / reinicio del servidor'],
    'Joueurs qui rejoignent / quittent': ['Players joining / leaving', '玩家加入 / 离开', 'Jugadores que entran / salen'],
    'Sauvegardes (manuelles, planifiées, restaurations)': ['Backups (manual, scheduled, restores)', '备份（手动、计划、恢复）', 'Copias (manuales, programadas, restauraciones)'],
    'Mises à jour du serveur': ['Server updates', '服务器更新', 'Actualizaciones del servidor'],
    'Actions admin (bans, kicks, réglages, plugins)': ['Admin actions (bans, kicks, settings, plugins)', '管理操作（封禁、踢出、设置、插件）', 'Acciones de admin (baneos, expulsiones, ajustes, plugins)'],
    'Espace disque faible': ['Low disk space', '磁盘空间不足', 'Poco espacio en disco'],
    'Redémarrages programmés (avertissements)': ['Scheduled restarts (warnings)', '计划重启（提醒）', 'Reinicios programados (avisos)'],
    'Enregistrer': ['Save', '保存', 'Guardar'],
    'Envoyer un message de test': ['Send a test message', '发送测试消息', 'Enviar un mensaje de prueba'],
    'Désactiver': ['Disable', '停用', 'Desactivar'],
    '✅ Notifications Discord activées.': ['✅ Discord notifications enabled.', '✅ Discord 通知已启用。', '✅ Notificaciones de Discord activadas.'],
    "Aucun webhook configuré — colle l'URL ci-dessus puis clique sur Enregistrer.": ['No webhook configured — paste the URL above then click Save.', '未配置 webhook——请在上方粘贴 URL，然后点击保存。', 'Sin webhook configurado: pega la URL arriba y haz clic en Guardar.'],
    "Colle d'abord l'URL du webhook Discord.": ['Paste the Discord webhook URL first.', '请先粘贴 Discord webhook 的 URL。', 'Pega primero la URL del webhook de Discord.'],
    'Webhook Discord enregistré.': ['Discord webhook saved.', 'Discord webhook 已保存。', 'Webhook de Discord guardado.'],
    'URL de webhook invalide.': ['Invalid webhook URL.', 'Webhook URL 无效。', 'URL de webhook no válida.'],
    'Message de test envoyé, vérifie ton salon Discord !': ['Test message sent, check your Discord channel!', '测试消息已发送，请查看你的 Discord 频道！', '¡Mensaje de prueba enviado, revisa tu canal de Discord!'],
    'Échec — enregistre d\'abord un webhook valide.': ['Failed — save a valid webhook first.', '失败——请先保存有效的 webhook。', 'Error: guarda primero un webhook válido.'],
    "Échec de l'envoi — vérifie que l'URL du webhook est correcte.": ['Send failed — check that the webhook URL is correct.', '发送失败——请检查 webhook URL 是否正确。', 'Error al enviar: comprueba que la URL del webhook sea correcta.'],
    'Notifications Discord désactivées.': ['Discord notifications disabled.', 'Discord 通知已停用。', 'Notificaciones de Discord desactivadas.'],
    // Redémarrage récurrent
    'Redémarrage automatique': ['Automatic restart', '自动重启', 'Reinicio automático'],
    'Activer le redémarrage récurrent': ['Enable recurring restart', '启用周期性重启', 'Activar reinicio recurrente'],
    'Avertissement aux joueurs': ['Player warning', '玩家提醒', 'Aviso a los jugadores'],
    'minutes avant le redémarrage effectif (annonces décroissantes)': ['minutes before the actual restart (countdown announcements)', '分钟（重启前倒计时公告）', 'minutos antes del reinicio efectivo (anuncios de cuenta atrás)'],
    '⏸️ Redémarrage récurrent désactivé.': ['⏸️ Recurring restart disabled.', '⏸️ 周期性重启已禁用。', '⏸️ Reinicio recurrente desactivado.'],
    // Réglages du monde
    'Réglages du monde (PalWorldSettings.ini)': ['World settings (PalWorldSettings.ini)', '世界设置（PalWorldSettings.ini）', 'Ajustes del mundo (PalWorldSettings.ini)'],
    'Afficher les réglages': ['Show settings', '显示设置', 'Mostrar ajustes'],
    'Masquer les réglages': ['Hide settings', '隐藏设置', 'Ocultar ajustes'],
    'Arrêter (avec sauvegarde) pour modifier': ['Stop (with save) to edit', '停止（先保存）以编辑', 'Detener (con guardado) para editar'],
    'Enregistrer les modifications': ['Save changes', '保存修改', 'Guardar cambios'],
    'Modifiable uniquement serveur éteint (Palworld ne relit ce fichier qu\'au démarrage).': ['Editable only while the server is stopped (Palworld only reads this file at startup).', '仅在服务器停止时可编辑（Palworld 只在启动时读取此文件）。', 'Editable solo con el servidor detenido (Palworld solo lee este archivo al arrancar).'],
    "🔒 Serveur en cours d'exécution : arrête-le pour modifier les réglages (Palworld ne relit ce fichier qu'au démarrage).": ['🔒 Server is running: stop it to edit the settings (Palworld only reads this file at startup).', '🔒 服务器正在运行：请停止后再修改设置（Palworld 只在启动时读取此文件）。', '🔒 Servidor en marcha: deténlo para editar los ajustes (Palworld solo lee este archivo al arrancar).'],
    '✏️ Serveur éteint : les réglages sont modifiables. Les champs modifiés sont surlignés.': ['✏️ Server stopped: settings are editable. Modified fields are highlighted.', '✏️ 服务器已停止：设置可编辑。已修改的字段会高亮显示。', '✏️ Servidor detenido: los ajustes son editables. Los campos modificados quedan resaltados.'],
    'Arrêter le serveur (avec sauvegarde) pour pouvoir modifier les réglages ? Les joueurs connectés seront déconnectés.': ['Stop the server (with a save) to edit the settings? Connected players will be disconnected.', '停止服务器（先保存）以修改设置？在线玩家将被断开连接。', '¿Detener el servidor (con guardado) para editar los ajustes? Los jugadores conectados serán desconectados.'],
    'Serveur arrêté — réglages modifiables': ['Server stopped — settings editable', '服务器已停止——设置可编辑', 'Servidor detenido: ajustes editables'],
    "Le serveur met du temps à s'arrêter, réessaie dans un instant": ['The server is taking a while to stop, try again shortly', '服务器停止较慢，请稍后重试', 'El servidor tarda en detenerse, inténtalo de nuevo en un momento'],
    'PalWorldSettings.ini introuvable (serveur pas encore installé ?)': ['PalWorldSettings.ini not found (server not installed yet?)', '未找到 PalWorldSettings.ini（服务器尚未安装？）', 'PalWorldSettings.ini no encontrado (¿servidor aún no instalado?)'],
    'Impossible de lire les réglages': ['Could not read the settings', '无法读取设置', 'No se pudieron leer los ajustes'],
    'Aucune modification à enregistrer': ['No changes to save', '没有要保存的修改', 'No hay cambios que guardar'],
    "Impossible : le serveur tourne, arrête-le d'abord": ['Not possible: the server is running, stop it first', '无法执行：服务器正在运行，请先停止', 'No es posible: el servidor está en marcha, deténlo primero'],
    'Refusé : la modification aurait corrompu le fichier': ['Refused: the change would have corrupted the file', '已拒绝：该修改会损坏文件', 'Rechazado: el cambio habría corrompido el archivo'],
    'Oui': ['Yes', '是', 'Sí'],
    'Non': ['No', '否', 'No'],
    // Plugins
    '(mods Lua/Blueprint)': ['(Lua/Blueprint mods)', '（Lua/Blueprint 模组）', '(mods Lua/Blueprint)'],
    '(anti-triche)': ['(anti-cheat)', '（反作弊）', '(anti-trampas)'],
    'Installer / mettre à jour': ['Install / update', '安装 / 更新', 'Instalar / actualizar'],
    'Désinstaller': ['Uninstall', '卸载', 'Desinstalar'],
    'Open source (MIT). Ajoute un dossier': ['Open source (MIT). Adds a', '开源（MIT）。会添加一个', 'Código abierto (MIT). Añade una carpeta'],
    'avec quelques mods d\'exemple ; les tiens peuvent être ajoutés par la suite directement dans ce dossier.': ['folder with a few example mods; yours can be added later directly into that folder.', '文件夹，内含一些示例模组；之后你可以直接把自己的模组放进该文件夹。', 'con algunos mods de ejemplo; los tuyos pueden añadirse después directamente en esa carpeta.'],
    '⚠️ Binaire fermé (code non public) fourni par ses auteurs — installé directement depuis leur release GitHub officielle, jamais modifié par ce dashboard. Installe la dernière version':
      ['⚠️ Closed binary (non-public code) provided by its authors — installed directly from their official GitHub release, never modified by this dashboard. Installs the latest',
       '⚠️ 由作者提供的闭源二进制文件（代码不公开）——直接从其官方 GitHub release 安装，本仪表盘从不修改。安装最新的',
       '⚠️ Binario cerrado (código no público) proporcionado por sus autores: instalado directamente desde su release oficial de GitHub, nunca modificado por este panel. Instala la última'],
    'préversion (bêta 1.8.0)': ['pre-release (1.8.0 beta)', '预发布版（1.8.0 测试版）', 'preversión (beta 1.8.0)'],
    ": c'est la première à exposer l'API des Commandes Admin.": [': it is the first to expose the Admin Commands API.', '：这是第一个提供管理员命令 API 的版本。', ': es la primera que expone la API de Comandos de administrador.'],
    'Commandes Admin (onglet Tableau de bord)': ['Admin Commands (Dashboard tab)', '管理员命令（仪表盘标签页）', 'Comandos de admin (pestaña Panel)'],
    "Entièrement automatique : l'installation active l'API et configure l'accès. Il suffit ensuite de démarrer le serveur.":
      ['Fully automatic: installation enables the API and sets up access. Just start the server afterwards.',
       '完全自动：安装会启用 API 并配置访问权限。之后只需启动服务器即可。',
       'Totalmente automático: la instalación activa la API y configura el acceso. Después solo hay que iniciar el servidor.'],
    'Installation/désinstallation possibles uniquement serveur éteint (les fichiers sont chargés par le processus en cours d\'exécution).': ['Install/uninstall only possible while the server is stopped (the files are loaded by the running process).', '仅在服务器停止时才能安装/卸载（文件被运行中的进程占用）。', 'Instalar/desinstalar solo es posible con el servidor detenido (el proceso en ejecución carga los archivos).'],
    '✅ Installé': ['✅ Installed', '✅ 已安装', '✅ Instalado'],
    '⭕ Non installé': ['⭕ Not installed', '⭕ 未安装', '⭕ No instalado'],
    '✅ Prêt — les Commandes Admin fonctionnent': ['✅ Ready — Admin Commands work', '✅ 就绪——管理员命令可用', '✅ Listo: los Comandos de admin funcionan'],
    '⭕ Installe PalDefender puis démarre le serveur une fois': ['⭕ Install PalDefender then start the server once', '⭕ 安装 PalDefender 后启动一次服务器', '⭕ Instala PalDefender y arranca el servidor una vez'],
    'IP bannie': ['IP banned', 'IP 已封禁', 'IP baneada'],
    'IP débannie': ['IP unbanned', 'IP 已解封', 'IP desbaneada'],
    'joueur banni': ['player banned', '玩家已封禁', 'jugador baneado'],
    // Comptes
    'Mon compte': ['My account', '我的账户', 'Mi cuenta'],
    'Changer le mot de passe': ['Change password', '修改密码', 'Cambiar contraseña'],
    'Mot de passe actuel': ['Current password', '当前密码', 'Contraseña actual'],
    'Nouveau mot de passe (6 caractères min.)': ['New password (6 chars min.)', '新密码（至少 6 个字符）', 'Nueva contraseña (mín. 6 caracteres)'],
    'Mot de passe changé': ['Password changed', '密码已修改', 'Contraseña cambiada'],
    'Mot de passe actuel incorrect.': ['Current password is incorrect.', '当前密码不正确。', 'La contraseña actual es incorrecta.'],
    'Échec du changement de mot de passe.': ['Failed to change password.', '密码修改失败。', 'Error al cambiar la contraseña.'],
    'Gestion des utilisateurs': ['User management', '用户管理', 'Gestión de usuarios'],
    'Rôle': ['Role', '角色', 'Rol'],
    'Créer un compte': ['Create an account', '创建账户', 'Crear una cuenta'],
    'Admin (accès complet)': ['Admin (full access)', '管理员（完全访问）', 'Admin (acceso completo)'],
    'Utilisateur (actions, sans installation ni comptes admin)': ['User (actions, no installation or admin accounts)', '用户（可操作，但无安装及管理员账户权限）', 'Usuario (acciones, sin instalación ni cuentas de admin)'],
    'Créer': ['Create', '创建', 'Crear'],
    'Mot de passe (6 caractères min.)': ['Password (6 chars min.)', '密码（至少 6 个字符）', 'Contraseña (mín. 6 caracteres)'],
    'toi': ['you', '你', 'tú'],
    'Réinitialiser mdp': ['Reset password', '重置密码', 'Restablecer contraseña'],
    'Supprimer': ['Delete', '删除', 'Eliminar'],
    'Rôle mis à jour': ['Role updated', '角色已更新', 'Rol actualizado'],
    'Impossible : il doit rester au moins un admin': ['Not possible: at least one admin must remain', '无法执行：必须至少保留一名管理员', 'No es posible: debe quedar al menos un admin'],
    'Réservé aux admins': ['Admins only', '仅限管理员', 'Solo para admins'],
    'Échec de la mise à jour': ['Update failed', '更新失败', 'Error al actualizar'],
    '6 caractères minimum': ['6 characters minimum', '至少 6 个字符', 'Mínimo 6 caracteres'],
    'Mot de passe réinitialisé': ['Password reset', '密码已重置', 'Contraseña restablecida'],
    'Échec de la réinitialisation': ['Reset failed', '重置失败', 'Error al restablecer'],
    'Compte supprimé': ['Account deleted', '账户已删除', 'Cuenta eliminada'],
    'Échec de la suppression': ['Deletion failed', '删除失败', 'Error al eliminar'],
    'Compte créé': ['Account created', '账户已创建', 'Cuenta creada'],
    "Ce nom d'utilisateur existe déjà.": ['This username already exists.', '该用户名已存在。', 'Este nombre de usuario ya existe.'],
    'Seul un admin peut créer un compte admin.': ['Only an admin can create an admin account.', '只有管理员才能创建管理员账户。', 'Solo un admin puede crear una cuenta de admin.'],
    'Mot de passe : 6 caractères minimum.': ['Password: 6 characters minimum.', '密码：至少 6 个字符。', 'Contraseña: mínimo 6 caracteres.'],
    'Échec de la création du compte.': ['Failed to create the account.', '账户创建失败。', 'Error al crear la cuenta.'],
    // Launcher Electron
    "⚠️ L'application ne tourne pas avec les droits administrateur : la création des services Windows et de la règle de pare-feu échouera. Ferme, fais un clic droit sur l'.exe → « Exécuter en tant qu'administrateur ».":
      ["⚠️ The application is not running with administrator rights: creating Windows services and the firewall rule will fail. Close it, right-click the .exe → \"Run as administrator\".",
       '⚠️ 应用未以管理员权限运行：创建 Windows 服务和防火墙规则将失败。请关闭后右键点击 .exe → “以管理员身份运行”。',
       '⚠️ La aplicación no se está ejecutando con derechos de administrador: la creación de los servicios de Windows y de la regla del firewall fallará. Ciérrala y haz clic derecho en el .exe → "Ejecutar como administrador".'],
    'État de l\'installation': ['Installation status', '安装状态', 'Estado de la instalación'],
    'Installer / configurer le serveur': ['Install / configure the server', '安装 / 配置服务器', 'Instalar / configurar el servidor'],
    'Télécharge SteamCMD + le serveur Palworld (12–15 Go), configure': ['Downloads SteamCMD + Palworld server (12–15 GB), configures', '下载 SteamCMD + Palworld 服务器（12–15 GB），配置', 'Descarga SteamCMD + el servidor de Palworld (12–15 GB), configura'],
    ', crée les services Windows (serveur + dashboard) et la règle de pare-feu. NSSM est téléchargé automatiquement.': [', creates Windows services (server + dashboard) and the firewall rule. NSSM is downloaded automatically.', '，创建 Windows 服务（服务器 + 仪表盘）及防火墙规则。NSSM 会自动下载。', ', crea los servicios de Windows (servidor + panel) y la regla del firewall. NSSM se descarga automáticamente.'],
    'Dossier d\'installation': ['Install folder', '安装文件夹', 'Carpeta de instalación'],
    'ex: D:\\PalworldServer': ['e.g. D:\\PalworldServer', '例：D:\\PalworldServer', 'ej.: D:\\PalworldServer'],
    'Arguments de lancement supplémentaires (avancé, optionnel)': ['Additional launch arguments (advanced, optional)', '额外启动参数（高级，可选）', 'Argumentos de lanzamiento adicionales (avanzado, opcional)'],
    'ex: -publiclobby -NoAsyncLoadingThread': ['e.g. -publiclobby -NoAsyncLoadingThread', '例：-publiclobby -NoAsyncLoadingThread', 'ej.: -publiclobby -NoAsyncLoadingThread'],
    'PalServer.exe sera installé dans :': ['PalServer.exe will be installed in:', 'PalServer.exe 将安装在：', 'PalServer.exe se instalará en:'],
    'ex: Chez les copains': ['e.g. My Friends Server', '例：朋友们的服务器', 'ej.: El server de los amigos'],
    'Parcourir…': ['Browse…', '浏览…', 'Examinar…'],
    'Mot de passe serveur': ['Server password', '服务器密码', 'Contraseña del servidor'],
    'optionnel': ['optional', '可选', 'opcional'],
    "Mot de passe admin (sert aussi à l'API REST)": ['Admin password (also used for the REST API)', '管理员密码（也用于 REST API）', 'Contraseña de admin (también para la API REST)'],
    '6 caractères minimum — requis': ['Minimum 6 characters — required', '至少 6 个字符——必填', 'Mínimo 6 caracteres: obligatorio'],
    'auto si laissé vide': ['auto if left empty', '留空则自动', 'auto si se deja vacío'],
    "Échec de l'installation.": ['Installation failed.', '安装失败。', 'Error en la instalación.'],
    'Lancer le dashboard': ['Launch the dashboard', '启动仪表盘', 'Iniciar el panel'],
    'Ouvrir dans le navigateur': ['Open in browser', '在浏览器中打开', 'Abrir en el navegador'],
    'Dashboard démarré': ['Dashboard started', '仪表盘已启动', 'Panel iniciado'],
    'Dashboard arrêté': ['Dashboard stopped', '仪表盘已停止', 'Panel detenido'],
    'Dashboard : en ligne': ['Dashboard: online', '仪表盘：在线', 'Panel: en línea'],
    'Dashboard : arrêté': ['Dashboard: stopped', '仪表盘：已停止', 'Panel: detenido'],
    'Dashboard : non installé': ['Dashboard: not installed', '仪表盘：未安装', 'Panel: no instalado'],
    'Journal d\'installation': ['Installation log', '安装日志', 'Registro de instalación'],
    'Services Windows': ['Windows services', 'Windows 服务', 'Servicios de Windows'],
    'Recrée ou supprime les services (serveur + dashboard) sans re-télécharger. La désinstallation ne touche ni au serveur ni aux sauvegardes.': ['Recreates or removes services (server + dashboard) without re-downloading. Uninstallation does not touch the server or backups.', '重新创建或删除服务（服务器 + 仪表盘），无需重新下载。卸载不会影响服务器和备份。', 'Recrea o elimina los servicios (servidor + panel) sin volver a descargar. La desinstalación no toca ni el servidor ni las copias.'],
    "À partager avec tes amis (après redirection de port sur ta box) :": ['Share with your friends (after port forwarding on your router):', '分享给朋友（需先在路由器上做端口转发）：', 'Para compartir con tus amigos (tras redirigir el puerto en tu router):'],
    '(Ré)installer': ['(Re)install', '（重新）安装', '(Re)instalar'],
    'Services installés': ['Services installed', '服务已安装', 'Servicios instalados'],
    'Services désinstallés': ['Services uninstalled', '服务已卸载', 'Servicios desinstalados'],
    'Supprimer les services Windows (serveur + dashboard) ? Le serveur installé et les sauvegardes ne sont pas touchés.': ['Remove the Windows services (server + dashboard)? The installed server and backups are not affected.', '删除 Windows 服务（服务器 + 仪表盘）？已安装的服务器和备份不受影响。', '¿Eliminar los servicios de Windows (servidor + panel)? El servidor instalado y las copias no se ven afectados.'],
    'Échec de l\'installation': ['Installation failed', '安装失败', 'Error en la instalación'],
    'Pense à': ['Remember to', '记得', 'Recuerda'],
    // Checklist du launcher
    'Droits administrateur': ['Administrator rights', '管理员权限', 'Derechos de administrador'],
    'Service serveur enregistré': ['Server service registered', '服务器服务已注册', 'Servicio del servidor registrado'],
    'Service dashboard enregistré': ['Dashboard service registered', '仪表盘服务已注册', 'Servicio del panel registrado'],
    // Comptes (launcher)
    'Créer le compte': ['Create account', '创建账户', 'Crear cuenta'],
    'Mot de passe (6 car. min.)': ['Password (6 chars min.)', '密码（至少 6 个字符）', 'Contraseña (mín. 6 caracteres)'],
    'Aucun compte — crée le premier ci-dessous.': ['No accounts yet — create the first one below.', '暂无账户——请在下方创建第一个。', 'Sin cuentas: crea la primera abajo.'],
    "Nom d'utilisateur et mot de passe requis.": ['Username and password required.', '用户名和密码为必填。', 'Se requieren nombre de usuario y contraseña.'],
    'Ce compte existe déjà.': ['This account already exists.', '该账户已存在。', 'Esta cuenta ya existe.'],
    'Échec de la création.': ['Creation failed.', '创建失败。', 'Error al crear.'],
    'Aucune configuration enregistrée — fais d\'abord une installation complète (étape 2).': ['No configuration saved yet — do a full installation first (step 2).', '尚无保存的配置——请先完成完整安装（第 2 步）。', 'Sin configuración guardada: haz primero una instalación completa (paso 2).'],
    // Divers
    'télécharger sur GitHub': ['download on GitHub', '在 GitHub 上下载', 'descargar en GitHub']
  };

  // ---------- Motifs (textes contenant des variables) : [regex, en, zh, es] ----------
  const PATTERNS = [
    [/^— (\d+) joueur\(s\) connecté\(s\)$/, '— $1 player(s) online', '— $1 名玩家在线', '— $1 jugador(es) en línea'],
    [/^(\d+)j (\d+)h (\d+)min$/, '$1d $2h $3min', '$1天 $2小时 $3分钟', '$1d $2h $3min'],
    [/^⏳ Redémarrage programmé dans ~(\d+) min\.$/, '⏳ Restart scheduled in ~$1 min.', '⏳ 计划于约 $1 分钟后重启。', '⏳ Reinicio programado en ~$1 min.'],
    [/^Redémarrage programmé dans (\d+) min$/, 'Restart scheduled in $1 min', '计划于 $1 分钟后重启', 'Reinicio programado en $1 min'],
    [/^(UE4SS|PalDefender) (.+) installé — API de commandes prête, plus rien à configurer$/, '$1 $2 installed — Command API ready, nothing left to configure', '$1 $2 已安装——命令 API 就绪，无需其他配置', '$1 $2 instalado: API de comandos lista, nada más que configurar'],
    [/^(UE4SS|PalDefender) (.+) installé$/, '$1 $2 installed', '$1 $2 已安装', '$1 $2 instalado'],
    [/^(UE4SS|PalDefender) désinstallé$/, '$1 uninstalled', '$1 已卸载', '$1 desinstalado'],
    [/^Échec de l'installation de (.+)$/, 'Failed to install $1', '$1 安装失败', 'Error al instalar $1'],
    [/^Échec de la désinstallation de (.+)$/, 'Failed to uninstall $1', '$1 卸载失败', 'Error al desinstalar $1'],
    [/^Installer\/mettre à jour (.+) vers la dernière version \? Le serveur doit être éteint\.$/, 'Install/update $1 to the latest version? The server must be stopped.', '安装/更新 $1 到最新版本？服务器必须处于停止状态。', '¿Instalar/actualizar $1 a la última versión? El servidor debe estar detenido.'],
    [/^Désinstaller (.+) \? Le serveur doit être éteint\.$/, 'Uninstall $1? The server must be stopped.', '卸载 $1？服务器必须处于停止状态。', '¿Desinstalar $1? El servidor debe estar detenido.'],
    [/^✅ Installé — (.+)$/, '✅ Installed — $1', '✅ 已安装 — $1', '✅ Instalado — $1'],
    [/^Jeton importé \((.+)\) — pense à mettre Enabled: true dans RESTConfig\.json puis à redémarrer le serveur$/, 'Token imported ($1) — remember to set Enabled: true in RESTConfig.json then restart the server', '令牌已导入（$1）——记得在 RESTConfig.json 中设置 Enabled: true，然后重启服务器', 'Token importado ($1): recuerda poner Enabled: true en RESTConfig.json y reiniciar el servidor'],
    [/^Jeton importé \((.+)\)$/, 'Token imported ($1)', '令牌已导入（$1）', 'Token importado ($1)'],
    [/^Échec : (.+)$/, 'Failed: $1', '失败：$1', 'Error: $1'],
    [/^PalServer\.exe introuvable dans "(.+)" — vérifie le dossier indiqué \(celui qui contient PalServer\.exe directement\)\.$/,
      'PalServer.exe not found in "$1" — check the folder you provided (the one that directly contains PalServer.exe).',
      '在 "$1" 中未找到 PalServer.exe——请检查所指定的文件夹（应直接包含 PalServer.exe）。',
      'PalServer.exe no encontrado en "$1": comprueba la carpeta indicada (la que contiene directamente PalServer.exe).'],
    [/^⬆️ (v[\d.]+) → (v[\d.]+) disponible$/, '⬆️ $1 → $2 available', '⬆️ 新版本可用：$1 → $2', '⬆️ $1 → $2 disponible'],
    [/^Bannir (.+) \? Il sera déconnecté et ne pourra plus se reconnecter\.$/, 'Ban $1? They will be disconnected and unable to reconnect.', '封禁 $1？该玩家将被断开且无法再连接。', '¿Banear a $1? Será desconectado y no podrá volver a conectarse.'],
    [/^Bannir (.+) \? Il sera déconnecté \(s'il est en ligne\) et ne pourra plus se reconnecter\.$/, "Ban $1? They will be disconnected (if online) and unable to reconnect.", '封禁 $1？该玩家（若在线）将被断开且无法再连接。', '¿Banear a $1? Será desconectado (si está en línea) y no podrá volver a conectarse.'],
    [/^— banni le (.+)$/, '— banned on $1', '— 封禁于 $1', '— baneado el $1'],
    [/ — banni le (.+)$/, ' — banned on $1', ' — 封禁于 $1', ' — baneado el $1'],
    [/^parti à (.+)$/, 'left at $1', '于 $1 离开', 'salió a las $1'],
    [/^([\d.]+) h au total$/, '$1 h total', '总计 $1 小时', '$1 h en total'],
    [/^Restaurer "(.+)" \? Le monde actuel sera remplacé \(une sauvegarde de sécurité du monde actuel sera prise avant\)\. Le serveur doit être éteint\.$/, 'Restore "$1"? The current world will be replaced (a safety backup of the current world is taken first). The server must be stopped.', '恢复 "$1"？当前世界将被替换（会先对当前世界做一次安全备份）。服务器必须处于停止状态。', '¿Restaurar "$1"? El mundo actual será reemplazado (antes se hace una copia de seguridad del mundo actual). El servidor debe estar detenido.'],
    [/^Restauré \(ancien monde sauvegardé sous (.+)\)$/, 'Restored (previous world saved as $1)', '已恢复（原世界已另存为 $1）', 'Restaurado (mundo anterior guardado como $1)'],
    [/^Import de (.+) en cours…$/, 'Importing $1…', '正在导入 $1…', 'Importando $1…'],
    [/^Sauvegarde importée : (.+)$/, 'Backup imported: $1', '备份已导入：$1', 'Copia importada: $1'],
    [/ — ([\d.]+) Mo$/, ' — $1 MB', ' — $1 MB', ' — $1 MB'],
    [/^⚠️ Espace disque faible : (.+)$/, '⚠️ Low disk space: $1', '⚠️ 磁盘空间不足：$1', '⚠️ Poco espacio en disco: $1'],
    [/([\d.]+) Go libres/g, '$1 GB free', '剩余 $1 GB', '$1 GB libres'],
    [/(\d+) Mo libres/g, '$1 MB free', '剩余 $1 MB', '$1 MB libres'],
    [/^Enregistrer (\d+) réglage\(s\) modifié\(s\) \? Ils s'appliqueront au prochain démarrage du serveur\.$/, 'Save $1 modified setting(s)? They will apply at the next server start.', '保存 $1 项已修改的设置？将在服务器下次启动时生效。', '¿Guardar $1 ajuste(s) modificado(s)? Se aplicarán en el próximo arranque del servidor.'],
    [/^(\d+) réglage\(s\) enregistré\(s\)$/, '$1 setting(s) saved', '已保存 $1 项设置', '$1 ajuste(s) guardado(s)'],
    [/^Échec de l'enregistrement \((.+)\)$/, 'Failed to save ($1)', '保存失败（$1）', 'Error al guardar ($1)'],
    [/^⬆️ Mise à jour disponible : build (.+) → (.+)\.$/, '⬆️ Update available: build $1 → $2.', '⬆️ 有可用更新：版本 $1 → $2。', '⬆️ Actualización disponible: build $1 → $2.'],
    [/^✅ Serveur à jour \(build (.+)\)\.$/, '✅ Server up to date (build $1).', '✅ 服务器已是最新（版本 $1）。', '✅ Servidor al día (build $1).'],
    [/^Build installé illisible — dernier build Steam : (.+)\.$/, 'Installed build unreadable — latest Steam build: $1.', '无法读取已安装版本——Steam 最新版本：$1。', 'Build instalada ilegible: última build de Steam: $1.'],
    [/^Échec de la vérification : (.+)$/, 'Check failed: $1', '检查失败：$1', 'Error en la comprobación: $1'],
    [/^Échec de l'installation : (.*)$/, 'Installation failed: $1', '安装失败：$1', 'Error en la instalación: $1'],
    [/^Supprimer le compte "(.+)" \?$/, 'Delete the account "$1"?', '删除账户 "$1"？', '¿Eliminar la cuenta "$1"?'],
    [/^Nouveau mot de passe pour (.+) :$/, 'New password for $1:', '$1 的新密码：', 'Nueva contraseña para $1:'],
    [/^⬆️ Nouvelle version du dashboard disponible :$/, '⬆️ New dashboard version available:', '⬆️ 仪表盘有新版本可用：', '⬆️ Nueva versión del panel disponible:'],
    [/^\(tu utilises la v([\d.]+)\) —$/, '(you are on v$1) —', '（当前版本 v$1）—', '(estás en la v$1) —'],
    [/ — tous les jours — /, ' — every day — ', ' — 每天 — ', ' — todos los días — '],
    [/(\d+) sauvegardes conservées\.$/, '$1 backups kept.', '保留 $1 个备份。', '$1 copias conservadas.'],
    [/avertissement (\d+) min avant\.$/, 'warning $1 min before.', '提前 $1 分钟提醒。', 'aviso $1 min antes.'],
    // Libellés du journal d'activité ("<pseudo> a fait X" [— détails]). Le lookahead (?=$| — )
    // tolère un suffixe "— détails" ajouté par l'UI sans l'exiger.
    [/ a rejoint le serveur$/, ' joined the server', ' 加入了服务器', ' se unió al servidor'],
    [/ a quitté le serveur(?=$| — )/, ' left the server', ' 离开了服务器', ' salió del servidor'],
    [/ a démarré le serveur(?=$| — )/, ' started the server', ' 启动了服务器', ' inició el servidor'],
    [/ a arrêté le serveur(?=$| — )/, ' stopped the server', ' 停止了服务器', ' detuvo el servidor'],
    [/ a forcé l'arrêt du serveur(?=$| — )/, ' force-stopped the server', ' 强制停止了服务器', ' forzó la detención del servidor'],
    [/ a redémarré le serveur(?=$| — )/, ' restarted the server', ' 重启了服务器', ' reinició el servidor'],
    [/ a lancé une sauvegarde(?=$| — )/, ' started a backup', ' 发起了一次备份', ' lanzó una copia de seguridad'],
    [/ a sauvegardé le monde(?=$| — )/, ' saved the world', ' 保存了世界', ' guardó el mundo'],
    [/ a envoyé une annonce(?=$| — )/, ' sent an announcement', ' 发送了公告', ' envió un anuncio'],
    [/ a exclu un joueur(?=$| — )/, ' kicked a player', ' 踢出了一名玩家', ' expulsó a un jugador'],
    [/ a banni un joueur(?=$| — )/, ' banned a player', ' 封禁了一名玩家', ' baneó a un jugador'],
    [/ a débanni un joueur(?=$| — )/, ' unbanned a player', ' 解封了一名玩家', ' desbaneó a un jugador'],
    [/ a programmé un redémarrage(?=$| — )/, ' scheduled a restart', ' 计划了一次重启', ' programó un reinicio'],
    [/ a annulé le redémarrage programmé(?=$| — )/, ' cancelled the scheduled restart', ' 取消了计划的重启', ' canceló el reinicio programado'],
    [/ a vérifié les mises à jour(?=$| — )/, ' checked for updates', ' 检查了更新', ' buscó actualizaciones'],
    [/ a lancé une mise à jour du serveur(?=$| — )/, ' started a server update', ' 发起了服务器更新', ' lanzó una actualización del servidor'],
    [/ a modifié les réglages du monde(?=$| — )/, ' changed the world settings', ' 修改了世界设置', ' cambió los ajustes del mundo'],
    [/ a modifié le planning des sauvegardes(?=$| — )/, ' changed the backup schedule', ' 修改了备份计划', ' cambió la programación de copias'],
    [/ a modifié le planning de redémarrage(?=$| — )/, ' changed the restart schedule', ' 修改了重启计划', ' cambió la programación de reinicio'],
    [/ a restauré une sauvegarde(?=$| — )/, ' restored a backup', ' 恢复了一个备份', ' restauró una copia'],
    [/ échec de la sauvegarde planifiée(?=$| — )/, ' scheduled backup failed', ' 计划备份失败', ' fallo en la copia programada'],
    [/ a échoué à restaurer une sauvegarde(?=$| — )/, ' failed to restore a backup', ' 恢复备份失败', ' falló al restaurar una copia'],
    [/ a importé une sauvegarde(?=$| — )/, ' imported a backup', ' 导入了一个备份', ' importó una copia'],
    [/ a activé la console serveur(?=$| — )/, ' enabled the server console', ' 启用了服务器控制台', ' activó la consola del servidor'],
    [/ a installé un plugin(?=$| — )/, ' installed a plugin', ' 安装了一个插件', ' instaló un plugin'],
    [/ a désinstallé un plugin(?=$| — )/, ' uninstalled a plugin', ' 卸载了一个插件', ' desinstaló un plugin'],
    [/ a enregistré le jeton API PalDefender(?=$| — )/, ' saved the PalDefender API token', ' 保存了 PalDefender API 令牌', ' guardó el token de la API de PalDefender'],
    [/ a exécuté une commande PalDefender(?=$| — )/, ' ran a PalDefender command', ' 执行了一条 PalDefender 命令', ' ejecutó un comando de PalDefender'],
    [/ alerte espace disque faible(?=$| — )/, ' low disk space alert', ' 磁盘空间不足警报', ' alerta de poco espacio en disco'],
    [/ redémarrage automatique \(watchdog\)(?=$| — )/, ' automatic restart (watchdog)', ' 自动重启（看门狗）', ' reinicio automático (watchdog)'],
    [/ annonce de redémarrage planifié(?=$| — )/, ' scheduled restart announcement', ' 计划重启公告', ' anuncio de reinicio programado'],
    [/ redémarrage planifié ignoré \(un autre était en cours\)(?=$| — )/, ' scheduled restart skipped (another was in progress)', ' 已跳过计划重启（另一次正在进行）', ' reinicio programado omitido (otro estaba en curso)'],
    [/ a créé un compte(?=$| — )/, ' created an account', ' 创建了一个账户', ' creó una cuenta'],
    [/ a modifié un compte(?=$| — )/, ' updated an account', ' 修改了一个账户', ' modificó una cuenta'],
    [/ a supprimé un compte(?=$| — )/, ' deleted an account', ' 删除了一个账户', ' eliminó una cuenta'],
    [/ a changé son mot de passe(?=$| — )/, ' changed their password', ' 修改了自己的密码', ' cambió su contraseña'],
    [/ vérification de mise à jour SteamCMD(?=$| — )/, ' SteamCMD update check', ' SteamCMD 更新检查', ' comprobación de actualización de SteamCMD'],
    // Détails d'activité les plus fréquents (valeurs fixes, pas du texte libre)
    [/mise à jour appliquée$/, 'update applied', '更新已应用', 'actualización aplicada'],
    [/déjà à jour$/, 'already up to date', '已是最新', 'ya actualizado'],
    [/un redémarrage était déjà en cours$/, 'a restart was already in progress', '已有一次重启正在进行', 'ya había un reinicio en curso'],
    [/API injoignable alors que le service Windows est actif$/, 'API unreachable while the Windows service is still active', 'Windows 服务仍在运行但 API 无法访问', 'API inaccesible mientras el servicio de Windows sigue activo'],
    [/(\d+) Mo restants$/, '$1 MB remaining', '剩余 $1 MB', '$1 MB restantes'],
    [/(\d+) min \(récurrent\)$/, '$1 min (recurring)', '$1 分钟（周期性）', '$1 min (recurrente)'],
    // Résumés de planning avec jours (ex: "— Lun, Mar, Ven —")
    [/\bLun\b/g, 'Mon', '周一', 'Lun'], [/\bMar\b/g, 'Tue', '周二', 'Mar'], [/\bMer\b/g, 'Wed', '周三', 'Mié'], [/\bJeu\b/g, 'Thu', '周四', 'Jue'],
    [/\bVen\b/g, 'Fri', '周五', 'Vie'], [/\bSam\b/g, 'Sat', '周六', 'Sáb'], [/\bDim\b/g, 'Sun', '周日', 'Dom']
  ];

  function translate(str) {
    const trimmed = str.trim();
    if (!trimmed) return null;
    if (Object.prototype.hasOwnProperty.call(T, trimmed)) {
      // Repli sur l'anglais (index 0) si la traduction zh/es manque pour cette clé
      const entry = T[trimmed];
      const value = entry[IDX] || entry[0];
      return str.replace(trimmed, value);
    }
    let out = str;
    for (const row of PATTERNS) {
      const repl = row[1 + IDX] || row[1];
      out = out.replace(row[0], repl);
    }
    return out !== str ? out : null;
  }

  // t() exposé pour un usage explicite éventuel dans app.js
  window.t = s => (LANG !== 'fr' && translate(String(s))) || s;
  window.I18N_LANG = LANG;

  // ---------- Sélecteur de langue (injecté dans le header / la page de login) ----------
  const LANG_LABELS = { fr: 'Français', en: 'English', zh: '中文', es: 'Español' };
  function injectLangToggle() {
    // Le launcher Electron a déjà son propre sélecteur #langToggle dans son en-tête : ne pas en
    // injecter un second par-dessus (deux contrôles superposés en haut à droite).
    if (document.getElementById('langToggle')) return;
    const sel = document.createElement('select');
    sel.id = 'langToggle';
    sel.title = 'Language';
    sel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:1000;background:rgba(20,24,31,.85);color:#e7ebf0;border:1px solid rgba(139,150,165,.35);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;';
    for (const code of SUPPORTED) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = '🌐 ' + LANG_LABELS[code];
      if (code === LANG) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      localStorage.setItem('lang', sel.value);
      location.reload();
    });
    document.body.appendChild(sel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLangToggle);
  } else {
    injectLangToggle();
  }

  if (LANG === 'fr') return; // français : rien d'autre à faire, le contenu est déjà en français

  document.documentElement.lang = LANG;

  // ---------- Traduction du DOM (au chargement + contenu dynamique via MutationObserver) ----------
  const ATTRS = ['placeholder', 'title', 'alt'];

  function translateTextNode(node) {
    const tr = translate(node.nodeValue);
    if (tr !== null && tr !== node.nodeValue) node.nodeValue = tr;
  }

  function translateElementAttrs(el) {
    for (const attr of ATTRS) {
      const val = el.getAttribute && el.getAttribute(attr);
      if (val) {
        const tr = translate(val);
        if (tr !== null && tr !== val) el.setAttribute(attr, tr);
      }
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
      translateElementAttrs(root);
    }
    for (const child of root.childNodes) walk(child);
  }

  function start() {
    walk(document.documentElement);
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData') translateTextNode(m.target);
        else m.addedNodes.forEach(n => walk(n));
      }
    });
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // ---------- confirm / alert / prompt traduits au vol ----------
  const _confirm = window.confirm.bind(window);
  const _alert = window.alert.bind(window);
  const _prompt = window.prompt.bind(window);
  window.confirm = msg => _confirm(window.t(msg));
  window.alert = msg => _alert(window.t(msg));
  window.prompt = (msg, def) => _prompt(window.t(msg), def);
})();
