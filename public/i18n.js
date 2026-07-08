// Internationalisation FR/EN. Le français reste la langue source du code (HTML/JS inchangés) ;
// en anglais, un dictionnaire "texte français -> texte anglais" est appliqué automatiquement à
// tout le DOM (au chargement + MutationObserver pour le contenu dynamique), plus des motifs
// regex pour les textes contenant des variables. confirm/alert/prompt sont traduits au vol.
// Langue : localStorage 'lang', sinon détection navigateur (fr -> français, sinon anglais).
(function () {
  const stored = localStorage.getItem('lang');
  const LANG = stored || ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');

  // ---------- Dictionnaire (correspondances exactes, texte "trimé") ----------
  const T = {
    // Login
    'Connexion — Pal Launcher Server Manager': 'Sign in — Pal Launcher Server Manager',
    "Nom d'utilisateur": 'Username',
    'Mot de passe': 'Password',
    'Se connecter': 'Sign in',
    'Trop de tentatives, réessaie dans quelques minutes.': 'Too many attempts, try again in a few minutes.',
    'Identifiants incorrects.': 'Invalid credentials.',
    // Header / nav
    'Se déconnecter': 'Sign out',
    'Vérification du serveur…': 'Checking server…',
    'Tableau de bord': 'Dashboard',
    'Carte': 'Map',
    'Activité': 'Activity',
    'Sauvegardes': 'Backups',
    'Réglages': 'Settings',
    'Comptes': 'Accounts',
    'Admin': 'Admin',
    'Utilisateur': 'User',
    'Lecture seule': 'Read-only',
    // Infos serveur
    'Informations serveur': 'Server information',
    'Statut': 'Status',
    'Version': 'Version',
    'Joueurs': 'Players',
    'Uptime': 'Uptime',
    'FPS serveur': 'Server FPS',
    'Jours en jeu': 'In-game days',
    'En ligne': 'Online',
    'Hors ligne': 'Offline',
    'Serveur arrêté ou injoignable': 'Server stopped or unreachable',
    // Adresse
    'Adresse pour rejoindre le serveur': 'Server join address',
    'Sur ce réseau (amis chez toi / sur ta Wi-Fi)': 'On this network (friends at your place / on your Wi-Fi)',
    'Copier': 'Copy',
    'Depuis internet (après redirection de port sur ta box)': 'From the internet (after port forwarding on your router)',
    "C'est le port de jeu (UDP) — à donner à tes amis pour rejoindre depuis le client Palworld. Pour un accès depuis internet, vérifie qu'il est bien redirigé sur ta box.":
      'This is the game port (UDP) — give it to your friends to join from the Palworld client. For internet access, make sure it is forwarded on your router.',
    'Serveur pas encore installé': 'Server not installed yet',
    'Indisponible (pas de connexion internet ?)': 'Unavailable (no internet connection?)',
    'Copié !': 'Copied!',
    'Impossible de copier': 'Could not copy',
    // Contrôle serveur
    'Contrôle du serveur': 'Server control',
    'Démarrer': 'Start',
    'Redémarrer': 'Restart',
    'Sauvegarder le monde': 'Save world',
    'Arrêter': 'Stop',
    "Forcer l'arrêt": 'Force stop',
    'Redémarrage programmé dans': 'Schedule restart in',
    'min': 'min',
    'Programmer': 'Schedule',
    'Annuler': 'Cancel',
    'Démarrage du serveur…': 'Starting server…',
    'Échec du démarrage': 'Failed to start',
    'Arrêt en cours (sauvegarde puis coupure)…': 'Stopping (saving then shutting down)…',
    "Échec de l'arrêt": 'Failed to stop',
    'Redémarrage en cours…': 'Restarting…',
    'Échec du redémarrage': 'Failed to restart',
    'Arrêt forcé envoyé': 'Force stop sent',
    "Échec de l'arrêt forcé": 'Force stop failed',
    'Monde sauvegardé': 'World saved',
    'Redémarrage annulé': 'Restart cancelled',
    'Aucun redémarrage à annuler': 'No restart to cancel',
    'Impossible : un redémarrage est déjà en cours': 'Not possible: a restart is already in progress',
    'Arrêter le serveur ? Les joueurs connectés seront déconnectés.': 'Stop the server? Connected players will be disconnected.',
    'Redémarrer le serveur ? Les joueurs connectés seront déconnectés quelques instants.': 'Restart the server? Connected players will be disconnected for a moment.',
    "Forcer l'arrêt immédiat ? Aucune sauvegarde préalable — à réserver aux cas où le serveur est bloqué.": 'Force an immediate stop? No prior save — only for when the server is stuck.',
    // Joueurs
    'Joueurs connectés': 'Connected players',
    'Nom': 'Name',
    'Niveau': 'Level',
    'Ping': 'Ping',
    'Aucun joueur connecté.': 'No players connected.',
    'Kick': 'Kick',
    'Bannir': 'Ban',
    'Exclure ce joueur du serveur ?': 'Kick this player from the server?',
    'Joueur exclu': 'Player kicked',
    'Échec du kick': 'Kick failed',
    'Joueur banni': 'Player banned',
    'Échec du ban': 'Ban failed',
    'Joueur débanni': 'Player unbanned',
    'Échec du déban': 'Unban failed',
    '📊 Voir les stats': '📊 View stats',
    '🔨 Bannir': '🔨 Ban',
    'inconnue': 'unknown',
    'en ligne': 'online',
    // Annonces
    'Annonce': 'Announcement',
    'Envoyer': 'Send',
    'Message à afficher aux joueurs…': 'Message to show to players…',
    'Annonce envoyée': 'Announcement sent',
    "Échec de l'annonce": 'Announcement failed',
    'Sauvegarde imminente, tenez-vous prêts.': 'Save incoming, get ready.',
    'Redémarrage bientôt, mettez-vous en lieu sûr.': 'Restart soon, get to a safe place.',
    'Bienvenue sur le serveur, amusez-vous bien !': 'Welcome to the server, have fun!',
    'Bonne nuit à tous, le serveur reste allumé.': 'Good night everyone, the server stays up.',
    // Commandes admin PalDefender
    'Commandes Admin': 'Admin Commands',
    '(PalDefender)': '(PalDefender)',
    "API PalDefender non configurée — configure-la depuis l'onglet Plugins.": 'PalDefender API not configured — set it up from the Plugins tab.',
    'Kick un joueur': 'Kick a player',
    'Bannir un joueur': 'Ban a player',
    'Débannir un joueur': 'Unban a player',
    'Bannir une IP': 'Ban an IP',
    'Débannir une IP': 'Unban an IP',
    'Message à un joueur': 'Message a player',
    'Annonce (Broadcast)': 'Announcement (Broadcast)',
    'Alerte': 'Alert',
    'Chat joueur': 'Player chat',
    'Chat global': 'Global chat',
    'Log normal': 'Normal log',
    'Log important': 'Important log',
    'Log très important': 'Very important log',
    "Bannir aussi l'IP de ce joueur": "Also ban this player's IP",
    'Exécuter': 'Run',
    'Joueur (nom ou UserId) ou IP': 'Player (name or UserId) or IP',
    'Message': 'Message',
    'Raison (optionnel)': 'Reason (optional)',
    "Nom de l'expéditeur (optionnel)": 'Sender name (optional)',
    'Commande exécutée': 'Command executed',
    'API PalDefender non configurée': 'PalDefender API not configured',
    // Carte
    'Carte en direct': 'Live map',
    'Molette : zoom — Glisser : déplacer.': 'Wheel: zoom — Drag: pan.',
    // Activité
    'Historique des joueurs': 'Player history',
    'Pas encore de données.': 'No data yet.',
    'Dernières sessions': 'Recent sessions',
    "Journal d'activité": 'Activity log',
    'Aucune activité enregistrée.': 'No activity recorded.',
    'Aucune session enregistrée.': 'No sessions recorded.',
    'Joueurs bannis': 'Banned players',
    'Aucun joueur banni.': 'No banned players.',
    'Débannir': 'Unban',
    '← Précédent': '← Previous',
    'Suivant →': 'Next →',
    // Console
    'Console serveur': 'Server console',
    'Rafraîchir': 'Refresh',
    'Auto (5 s)': 'Auto (5 s)',
    'Activer la console': 'Enable console',
    'Filtrer les lignes…': 'Filter lines…',
    'Clique sur "Rafraîchir" pour charger la console.': 'Click "Refresh" to load the console.',
    'Serveur pas encore installé.': 'Server not installed yet.',
    'Console pas encore active sur ce serveur — clique "Activer la console" ci-dessus, puis redémarre le serveur.': 'Console not active on this server yet — click "Enable console" above, then restart the server.',
    'Impossible de charger la console.': 'Could not load the console.',
    '(console vide pour le moment)': '(console empty for now)',
    '(aucune ligne ne correspond au filtre)': '(no lines match the filter)',
    "(vide) PalServer.exe n'écrit aucune sortie console exploitable — c'est une limitation connue de Palworld sur Windows, pas un problème du dashboard. Le Journal d'activité ci-dessus reste la meilleure source pour suivre ce qui se passe (démarrages, sauvegardes, joueurs, alertes...).":
      "(empty) PalServer.exe doesn't write any usable console output — this is a known Palworld limitation on Windows, not a dashboard problem. The Activity log above remains the best source to follow what's happening (starts, backups, players, alerts...).",
    "Console activée — redémarre le serveur pour qu'elle commence à enregistrer": 'Console enabled — restart the server so it starts recording',
    'Service Windows introuvable — (ré)installe les services depuis le lanceur': 'Windows service not found — (re)install the services from the launcher',
    "Échec de l'activation de la console": 'Failed to enable the console',
    // Sauvegardes
    'Sauvegarder maintenant': 'Back up now',
    'Importer un zip…': 'Import a zip…',
    'Télécharger': 'Download',
    'Restaurer': 'Restore',
    'Aucune sauvegarde pour le moment.': 'No backups yet.',
    'Sauvegarde en cours…': 'Backing up…',
    'Sauvegarde terminée': 'Backup complete',
    'Échec de la sauvegarde': 'Backup failed',
    'Restauré': 'Restored',
    "Impossible : arrête le serveur d'abord": 'Not possible: stop the server first',
    'SAVE_PATH/BACKUP_DIR non configurés': 'SAVE_PATH/BACKUP_DIR not configured',
    'Échec de la restauration': 'Restore failed',
    'Choisis un fichier .zip': 'Choose a .zip file',
    "Ce fichier n'est pas un zip valide": 'This file is not a valid zip',
    'Fichier trop volumineux (4 Go max)': 'File too large (4 GB max)',
    'BACKUP_DIR non configuré': 'BACKUP_DIR not configured',
    "Échec de l'import": 'Import failed',
    "Échec de l'import (connexion interrompue ?)": 'Import failed (connection interrupted?)',
    'Sauvegardes automatiques': 'Automatic backups',
    'Activer les sauvegardes planifiées': 'Enable scheduled backups',
    'Jours': 'Days',
    'Heures (plusieurs possibles)': 'Times (multiple allowed)',
    'Ajouter': 'Add',
    'Sauvegardes conservées': 'Backups kept',
    'les plus anciennes au-delà sont supprimées': 'oldest beyond this are deleted',
    'Enregistrer le planning': 'Save schedule',
    'Planning enregistré': 'Schedule saved',
    "Échec de l'enregistrement du planning": 'Failed to save schedule',
    'Heure invalide': 'Invalid time',
    'Ajoute au moins une heure': 'Add at least one time',
    'Sélectionne au moins un jour': 'Select at least one day',
    'Aucune heure — ajoutes-en une.': 'No times — add one.',
    '⏸️ Sauvegardes planifiées désactivées.': '⏸️ Scheduled backups disabled.',
    'tous les jours': 'every day',
    'Dim': 'Sun', 'Lun': 'Mon', 'Mar': 'Tue', 'Mer': 'Wed', 'Jeu': 'Thu', 'Ven': 'Fri', 'Sam': 'Sat',
    // Mise à jour serveur
    'Mise à jour du serveur': 'Server update',
    'Vérifier les mises à jour': 'Check for updates',
    'Appliquer la mise à jour': 'Apply update',
    'Compare le build installé au dernier build Steam (via SteamCMD).': 'Compares the installed build with the latest Steam build (via SteamCMD).',
    'Vérification en cours… (SteamCMD démarre, ~30-60 s)': 'Checking… (SteamCMD is starting, ~30-60 s)',
    'Une vérification est déjà en cours…': 'A check is already in progress…',
    "Mise à jour en cours… (suivi dans le journal d'activité et Discord)": 'Updating… (follow along in the activity log and Discord)',
    'Mise à jour lancée, le serveur redémarre…': 'Update started, the server is restarting…',
    'Mise à jour lancée (serveur arrêté, il le restera)': 'Update started (server is stopped and will stay stopped)',
    'Appliquer la mise à jour ? Si le serveur tourne, il sera redémarré (arrêt propre + update + relance).': 'Apply the update? If the server is running it will be restarted (clean stop + update + start).',
    'Échec du lancement de la mise à jour': 'Failed to start the update',
    // Installation
    'Installation du serveur': 'Server installation',
    "⚠️ Le dashboard ne semble pas tourner avec des droits administrateur : l'installation (service Windows, pare-feu) risque d'échouer.": '⚠️ The dashboard does not seem to be running with administrator rights: installation (Windows service, firewall) may fail.',
    'Configurer / réinstaller': 'Configure / reinstall',
    "Lancer l'installation": 'Start installation',
    'SteamCMD installé': 'SteamCMD installed',
    'Serveur Palworld installé': 'Palworld server installed',
    'Service Windows enregistré': 'Windows service registered',
    'API REST configurée': 'REST API configured',
    "Dossier d'installation (ex: D:\\PalworldServer)": 'Install folder (e.g. D:\\PalworldServer)',
    'Dossier SteamCMD': 'SteamCMD folder',
    'Chemin nssm.exe': 'nssm.exe path',
    'Nom du service Windows': 'Windows service name',
    'Nom du serveur': 'Server name',
    'Mot de passe serveur (optionnel)': 'Server password (optional)',
    'Mot de passe admin (6 caractères min., requis pour l\'API REST)': 'Admin password (6 chars min., required for the REST API)',
    'Joueurs max': 'Max players',
    'Port de jeu (UDP)': 'Game port (UDP)',
    'Port API REST': 'REST API port',
    'Dossier de sauvegardes': 'Backups folder',
    'Mot de passe admin requis (6 caractères min.).': 'Admin password required (6 chars min.).',
    'Une installation est déjà en cours.': 'An installation is already in progress.',
    "Échec du lancement de l'installation.": 'Failed to start the installation.',
    'Installation terminée': 'Installation complete',
    // Redémarrage récurrent
    'Redémarrage automatique': 'Automatic restart',
    'Activer le redémarrage récurrent': 'Enable recurring restart',
    'Avertissement aux joueurs': 'Player warning',
    'minutes avant le redémarrage effectif (annonces décroissantes)': 'minutes before the actual restart (countdown announcements)',
    '⏸️ Redémarrage récurrent désactivé.': '⏸️ Recurring restart disabled.',
    // Réglages du monde
    'Réglages du monde (PalWorldSettings.ini)': 'World settings (PalWorldSettings.ini)',
    'Afficher les réglages': 'Show settings',
    'Masquer les réglages': 'Hide settings',
    'Arrêter (avec sauvegarde) pour modifier': 'Stop (with save) to edit',
    'Enregistrer les modifications': 'Save changes',
    'Modifiable uniquement serveur éteint (Palworld ne relit ce fichier qu\'au démarrage).': 'Editable only while the server is stopped (Palworld only reads this file at startup).',
    "🔒 Serveur en cours d'exécution : arrête-le pour modifier les réglages (Palworld ne relit ce fichier qu'au démarrage).": '🔒 Server is running: stop it to edit the settings (Palworld only reads this file at startup).',
    '✏️ Serveur éteint : les réglages sont modifiables. Les champs modifiés sont surlignés.': '✏️ Server stopped: settings are editable. Modified fields are highlighted.',
    'Arrêter le serveur (avec sauvegarde) pour pouvoir modifier les réglages ? Les joueurs connectés seront déconnectés.': 'Stop the server (with a save) to edit the settings? Connected players will be disconnected.',
    'Serveur arrêté — réglages modifiables': 'Server stopped — settings editable',
    "Le serveur met du temps à s'arrêter, réessaie dans un instant": 'The server is taking a while to stop, try again shortly',
    'PalWorldSettings.ini introuvable (serveur pas encore installé ?)': 'PalWorldSettings.ini not found (server not installed yet?)',
    'Impossible de lire les réglages': 'Could not read the settings',
    'Aucune modification à enregistrer': 'No changes to save',
    "Impossible : le serveur tourne, arrête-le d'abord": 'Not possible: the server is running, stop it first',
    'Refusé : la modification aurait corrompu le fichier': 'Refused: the change would have corrupted the file',
    'Oui': 'Yes',
    'Non': 'No',
    // Plugins
    '(mods Lua/Blueprint)': '(Lua/Blueprint mods)',
    '(anti-triche)': '(anti-cheat)',
    'Installer / mettre à jour': 'Install / update',
    'Désinstaller': 'Uninstall',
    'Open source (MIT). Ajoute un dossier': 'Open source (MIT). Adds a',
    'avec quelques mods d\'exemple ; les tiens peuvent être ajoutés par la suite directement dans ce dossier.': 'folder with a few example mods; yours can be added later directly into that folder.',
    '⚠️ Binaire fermé (code non public) fourni par ses auteurs — installé directement depuis leur release GitHub officielle, jamais modifié par ce dashboard. Installe la dernière version préversion (bêta 1.8.0) : c\'est la première à exposer l\'API des Commandes Admin.': '⚠️ Closed binary (non-public code) provided by its authors — installed directly from their official GitHub release, never modified by this dashboard. Installs the latest pre-release (1.8.0 beta): it is the first to expose the Admin Commands API.',
    'Commandes Admin (onglet Tableau de bord)': 'Admin Commands (Dashboard tab)',
    "Entièrement automatique : l'installation active l'API et configure l'accès. Il suffit ensuite de démarrer le serveur.":
      'Fully automatic: installation enables the API and sets up access. Just start the server afterwards.',
    'Installation/désinstallation possibles uniquement serveur éteint (les fichiers sont chargés par le processus en cours d\'exécution).': 'Install/uninstall only possible while the server is stopped (the files are loaded by the running process).',
    '✅ Installé': '✅ Installed',
    '⭕ Non installé': '⭕ Not installed',
    '✅ Prêt — les Commandes Admin fonctionnent': '✅ Ready — Admin Commands work',
    '⭕ Installe PalDefender puis démarre le serveur une fois': '⭕ Install PalDefender then start the server once',
    'IP bannie': 'IP banned',
    'IP débannie': 'IP unbanned',
    'joueur banni': 'player banned',
    // Comptes
    'Mon compte': 'My account',
    'Changer le mot de passe': 'Change password',
    'Mot de passe actuel': 'Current password',
    'Nouveau mot de passe (6 caractères min.)': 'New password (6 chars min.)',
    'Mot de passe changé': 'Password changed',
    'Mot de passe actuel incorrect.': 'Current password is incorrect.',
    'Échec du changement de mot de passe.': 'Failed to change password.',
    'Gestion des utilisateurs': 'User management',
    'Rôle': 'Role',
    'Créer un compte': 'Create an account',
    'Admin (accès complet)': 'Admin (full access)',
    'Utilisateur (actions, sans installation ni comptes admin)': 'User (actions, no installation or admin accounts)',
    'Créer': 'Create',
    'Mot de passe (6 caractères min.)': 'Password (6 chars min.)',
    'toi': 'you',
    'Réinitialiser mdp': 'Reset password',
    'Supprimer': 'Delete',
    'Rôle mis à jour': 'Role updated',
    'Impossible : il doit rester au moins un admin': 'Not possible: at least one admin must remain',
    'Réservé aux admins': 'Admins only',
    'Échec de la mise à jour': 'Update failed',
    '6 caractères minimum': '6 characters minimum',
    'Mot de passe réinitialisé': 'Password reset',
    'Échec de la réinitialisation': 'Reset failed',
    'Compte supprimé': 'Account deleted',
    'Échec de la suppression': 'Deletion failed',
    'Compte créé': 'Account created',
    "Ce nom d'utilisateur existe déjà.": 'This username already exists.',
    'Seul un admin peut créer un compte admin.': 'Only an admin can create an admin account.',
    'Mot de passe : 6 caractères minimum.': 'Password: 6 characters minimum.',
    'Échec de la création du compte.': 'Failed to create the account.',
    // Divers
    'télécharger sur GitHub': 'download on GitHub'
  };

  // ---------- Motifs (textes contenant des variables), appliqués en cascade ----------
  const PATTERNS = [
    [/^— (\d+) joueur\(s\) connecté\(s\)$/, '— $1 player(s) online'],
    [/^(\d+)j (\d+)h (\d+)min$/, '$1d $2h $3min'],
    [/^⏳ Redémarrage programmé dans ~(\d+) min\.$/, '⏳ Restart scheduled in ~$1 min.'],
    [/^Redémarrage programmé dans (\d+) min$/, 'Restart scheduled in $1 min'],
    [/^(UE4SS|PalDefender) (.+) installé — API de commandes prête, plus rien à configurer$/, '$1 $2 installed — Command API ready, nothing left to configure'],
    [/^(UE4SS|PalDefender) (.+) installé$/, '$1 $2 installed'],
    [/^(UE4SS|PalDefender) désinstallé$/, '$1 uninstalled'],
    [/^Échec de l'installation de (.+)$/, 'Failed to install $1'],
    [/^Échec de la désinstallation de (.+)$/, 'Failed to uninstall $1'],
    [/^Installer\/mettre à jour (.+) vers la dernière version \? Le serveur doit être éteint\.$/, 'Install/update $1 to the latest version? The server must be stopped.'],
    [/^Désinstaller (.+) \? Le serveur doit être éteint\.$/, 'Uninstall $1? The server must be stopped.'],
    [/^✅ Installé — (.+)$/, '✅ Installed — $1'],
    [/^Jeton importé \((.+)\)$/, 'Token imported ($1)'],
    [/^Jeton importé \((.+)\) — pense à mettre Enabled: true dans RESTConfig\.json puis à redémarrer le serveur$/, 'Token imported ($1) — remember to set Enabled: true in RESTConfig.json then restart the server'],
    [/^Échec : (.+)$/, 'Failed: $1'],
    [/^Bannir (.+) \? Il sera déconnecté et ne pourra plus se reconnecter\.$/, 'Ban $1? They will be disconnected and unable to reconnect.'],
    [/^Bannir (.+) \? Il sera déconnecté \(s'il est en ligne\) et ne pourra plus se reconnecter\.$/, "Ban $1? They will be disconnected (if online) and unable to reconnect."],
    [/^— banni le (.+)$/, '— banned on $1'],
    [/ — banni le (.+)$/, ' — banned on $1'],
    [/^parti à (.+)$/, 'left at $1'],
    [/^([\d.]+) h au total$/, '$1 h total'],
    [/^Restaurer "(.+)" \? Le monde actuel sera remplacé \(une sauvegarde de sécurité du monde actuel sera prise avant\)\. Le serveur doit être éteint\.$/, 'Restore "$1"? The current world will be replaced (a safety backup of the current world is taken first). The server must be stopped.'],
    [/^Restauré \(ancien monde sauvegardé sous (.+)\)$/, 'Restored (previous world saved as $1)'],
    [/^Import de (.+) en cours…$/, 'Importing $1…'],
    [/^Sauvegarde importée : (.+)$/, 'Backup imported: $1'],
    [/ — ([\d.]+) Mo$/, ' — $1 MB'],
    [/^⚠️ Espace disque faible : (.+)$/, '⚠️ Low disk space: $1'],
    [/([\d.]+) Go libres/g, '$1 GB free'],
    [/(\d+) Mo libres/g, '$1 MB free'],
    [/^Enregistrer (\d+) réglage\(s\) modifié\(s\) \? Ils s'appliqueront au prochain démarrage du serveur\.$/, 'Save $1 modified setting(s)? They will apply at the next server start.'],
    [/^(\d+) réglage\(s\) enregistré\(s\)$/, '$1 setting(s) saved'],
    [/^Échec de l'enregistrement \((.+)\)$/, 'Failed to save ($1)'],
    [/^⬆️ Mise à jour disponible : build (.+) → (.+)\.$/, '⬆️ Update available: build $1 → $2.'],
    [/^✅ Serveur à jour \(build (.+)\)\.$/, '✅ Server up to date (build $1).'],
    [/^Build installé illisible — dernier build Steam : (.+)\.$/, 'Installed build unreadable — latest Steam build: $1.'],
    [/^Échec de la vérification : (.+)$/, 'Check failed: $1'],
    [/^Échec de l'installation : (.*)$/, 'Installation failed: $1'],
    [/^Supprimer le compte "(.+)" \?$/, 'Delete the account "$1"?'],
    [/^Nouveau mot de passe pour (.+) :$/, 'New password for $1:'],
    [/^(.+)\n\nTemps de jeu total : ([\d.]+) h\nSessions récentes trouvées : (\d+)\nDernière connexion : (.+)$/, '$1\n\nTotal playtime: $2 h\nRecent sessions found: $3\nLast seen: $4'],
    [/^⬆️ Nouvelle version du dashboard disponible :$/, '⬆️ New dashboard version available:'],
    [/^\(tu utilises la v([\d.]+)\) —$/, '(you are on v$1) —'],
    [/ — tous les jours — /, ' — every day — '],
    [/(\d+) sauvegardes conservées\.$/, '$1 backups kept.'],
    [/avertissement (\d+) min avant\.$/, 'warning $1 min before.'],
    // Libellés du journal d'activité ("<pseudo> a fait X" [— détails]). Le lookahead (?=$| — )
    // tolère un suffixe "— détails" ajouté par l'UI (userid, nom de fichier, minutes...) sans
    // l'exiger : seul le libellé lui-même est traduit, les détails qui suivent restent tels quels.
    [/ a rejoint le serveur$/, ' joined the server'],
    [/ a quitté le serveur(?=$| — )/, ' left the server'],
    [/ a démarré le serveur(?=$| — )/, ' started the server'],
    [/ a arrêté le serveur(?=$| — )/, ' stopped the server'],
    [/ a forcé l'arrêt du serveur(?=$| — )/, ' force-stopped the server'],
    [/ a redémarré le serveur(?=$| — )/, ' restarted the server'],
    [/ a lancé une sauvegarde(?=$| — )/, ' started a backup'],
    [/ a sauvegardé le monde(?=$| — )/, ' saved the world'],
    [/ a envoyé une annonce(?=$| — )/, ' sent an announcement'],
    [/ a exclu un joueur(?=$| — )/, ' kicked a player'],
    [/ a banni un joueur(?=$| — )/, ' banned a player'],
    [/ a débanni un joueur(?=$| — )/, ' unbanned a player'],
    [/ a programmé un redémarrage(?=$| — )/, ' scheduled a restart'],
    [/ a annulé le redémarrage programmé(?=$| — )/, ' cancelled the scheduled restart'],
    [/ a vérifié les mises à jour(?=$| — )/, ' checked for updates'],
    [/ a lancé une mise à jour du serveur(?=$| — )/, ' started a server update'],
    [/ a modifié les réglages du monde(?=$| — )/, ' changed the world settings'],
    [/ a modifié le planning des sauvegardes(?=$| — )/, ' changed the backup schedule'],
    [/ a modifié le planning de redémarrage(?=$| — )/, ' changed the restart schedule'],
    [/ a restauré une sauvegarde(?=$| — )/, ' restored a backup'],
    [/ a échoué à restaurer une sauvegarde(?=$| — )/, ' failed to restore a backup'],
    [/ a importé une sauvegarde(?=$| — )/, ' imported a backup'],
    [/ a activé la console serveur(?=$| — )/, ' enabled the server console'],
    [/ a installé un plugin(?=$| — )/, ' installed a plugin'],
    [/ a désinstallé un plugin(?=$| — )/, ' uninstalled a plugin'],
    [/ a enregistré le jeton API PalDefender(?=$| — )/, ' saved the PalDefender API token'],
    [/ a exécuté une commande PalDefender(?=$| — )/, ' ran a PalDefender command'],
    [/ alerte espace disque faible(?=$| — )/, ' low disk space alert'],
    [/ redémarrage automatique \(watchdog\)(?=$| — )/, ' automatic restart (watchdog)'],
    [/ annonce de redémarrage planifié(?=$| — )/, ' scheduled restart announcement'],
    [/ redémarrage planifié ignoré \(un autre était en cours\)(?=$| — )/, ' scheduled restart skipped (another was in progress)'],
    [/ a créé un compte(?=$| — )/, ' created an account'],
    [/ a modifié un compte(?=$| — )/, ' updated an account'],
    [/ a supprimé un compte(?=$| — )/, ' deleted an account'],
    [/ a changé son mot de passe(?=$| — )/, ' changed their password'],
    [/ vérification de mise à jour SteamCMD(?=$| — )/, ' SteamCMD update check'],
    // Détails d'activité les plus fréquents (valeurs fixes, pas du texte libre)
    [/mise à jour appliquée$/, 'update applied'],
    [/déjà à jour$/, 'already up to date'],
    [/un redémarrage était déjà en cours$/, 'a restart was already in progress'],
    [/API injoignable alors que le service Windows est actif$/, 'API unreachable while the Windows service is still active'],
    [/(\d+) Mo restants$/, '$1 MB remaining'],
    [/(\d+) min \(récurrent\)$/, '$1 min (recurring)'],
    // Résumés de planning avec jours (ex: "— Lun, Mar, Ven —")
    [/\bLun\b/g, 'Mon'], [/\bMar\b/g, 'Tue'], [/\bMer\b/g, 'Wed'], [/\bJeu\b/g, 'Thu'],
    [/\bVen\b/g, 'Fri'], [/\bSam\b/g, 'Sat'], [/\bDim\b/g, 'Sun']
  ];

  function translate(str) {
    const trimmed = str.trim();
    if (!trimmed) return null;
    if (Object.prototype.hasOwnProperty.call(T, trimmed)) {
      return str.replace(trimmed, T[trimmed]);
    }
    let out = str;
    for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
    return out !== str ? out : null;
  }

  // t() exposé pour un usage explicite éventuel dans app.js
  window.t = s => (LANG === 'en' && translate(String(s))) || s;
  window.I18N_LANG = LANG;

  // ---------- Sélecteur de langue (injecté dans le header / la page de login) ----------
  function injectLangToggle() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'langToggle';
    btn.textContent = LANG === 'fr' ? '🌐 EN' : '🌐 FR';
    btn.title = LANG === 'fr' ? 'Switch to English' : 'Passer en français';
    btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:1000;background:rgba(20,24,31,.85);color:#e7ebf0;border:1px solid rgba(139,150,165,.35);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;';
    btn.addEventListener('click', () => {
      localStorage.setItem('lang', LANG === 'fr' ? 'en' : 'fr');
      location.reload();
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLangToggle);
  } else {
    injectLangToggle();
  }

  if (LANG !== 'en') return; // français : rien d'autre à faire, le contenu est déjà en français

  document.documentElement.lang = 'en';

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
