# Palworld Dashboard

Petit dashboard web pour piloter ton serveur Palworld dédié (Windows) : start/stop/restart,
sauvegardes manuelles + planifiées, joueurs connectés, annonces, kick. Accessible à tes amis
directement via **l'IP publique fixe de ta box** (redirection de port), en HTTP simple — pas de
nom de domaine ni de certificat nécessaire.

## 0. Le plus simple : l'application de lancement (installeur)

Pour ne rien avoir à installer ni à taper en ligne de commande, utilise l'application desktop
**`PalworldDashboardLauncher-Setup.exe`** (disponible dans les *Releases* GitHub). C'est un
installeur classique (pas un exécutable portable) : les fichiers sont extraits **une seule fois**
à l'installation, donc les lancements suivants sont quasi instantanés.

1. Double-clique le Setup : Windows demande l'élévation (UAC) automatiquement (nécessaire pour
   créer les services Windows et la règle de pare-feu).
2. Suis l'assistant d'installation (dossier d'installation modifiable, raccourcis Bureau/menu
   Démarrer créés).
3. Une fois installé, lance **« Palworld Dashboard »** depuis le menu Démarrer (plus besoin de
   relancer le Setup) :
   - **Étape 1** : une checklist montre l'état actuel (droits admin, SteamCMD, serveur, services…).
   - **Étape 2 – Installer le serveur** : remplis les réglages essentiels (dossiers, mots de passe,
     ports) et clique sur *Lancer l'installation*. L'appli télécharge NSSM automatiquement, installe
     SteamCMD + le serveur Palworld, configure `PalWorldSettings.ini`, crée **les deux services
     Windows** (serveur de jeu + dashboard) et la règle de pare-feu — tout en direct sous forme de log.
   - **Étape 3 – Lancer** : crée un compte admin, démarre le dashboard, et ouvre-le dans le
     navigateur. L'appli affiche l'URL locale à partager après redirection de port.

Aucun prérequis : Node.js et les dépendances sont embarqués. La config et les données sont
stockées dans `C:\ProgramData\PalworldDashboard` (indépendant du dossier d'installation de
l'appli), et le service dashboard redémarre tout seul au boot de la machine.

> SmartScreen peut afficher un avertissement au 1er lancement (`.exe` non signé) : *Informations
> complémentaires → Exécuter quand même*.

Le reste de ce README décrit l'**installation manuelle** (équivalente), utile si tu préfères tout
contrôler ou déployer sans l'interface graphique.

## 1. Installer le dashboard

Le dashboard peut désormais **créer le serveur Palworld lui-même** (section 2) — pas besoin
d'avoir déjà un serveur Palworld installé avant de commencer.

Prérequis sur le serveur Windows qui va héberger le tout :
- Node.js LTS (https://nodejs.org).
- NSSM téléchargé et décompressé quelque part (https://nssm.cc/download, ex : `C:\nssm\nssm.exe`)
  — sert à la fois à faire tourner le dashboard en service Windows (ci-dessous) et à faire créer
  par l'assistant d'installation le service du serveur Palworld (section 2).

```powershell
cd C:\PalworldDashboard   # ou l'emplacement de ton choix, copie-y ce dossier
npm install
copy .env.example .env
notepad .env              # renseigne au moins SESSION_SECRET et NSSM_PATH
```

Les autres valeurs (`PALWORLD_API_PASSWORD`, `SAVE_PATH`, `BACKUP_DIR`, `STEAMCMD_PATH`,
`PALWORLD_INSTALL_DIR`...) peuvent rester vides pour l'instant : l'assistant d'installation de la
section 2 les renseigne automatiquement à la fin de l'installation, sans redémarrage du dashboard
nécessaire. Le dashboard affiche un avertissement au démarrage tant qu'elles manquent — normal
avant d'avoir fait tourner l'assistant.

Crée un compte pour toi et un pour chaque ami. Le troisième argument est le rôle :
`admin` (par défaut, accès complet) ou `viewer` (lecture seule : statut, joueurs, historique,
journal, téléchargement des sauvegardes — mais pas de start/stop/restart/kick/annonce).

```powershell
npm run create-user -- vincent motdepasse-fort admin
npm run create-user -- copain1 autre-motdepasse admin
npm run create-user -- copain2 encore-un-motdepasse viewer
```

(Les mots de passe sont hashés avec bcrypt et stockés dans `data/users.json`, jamais en clair.)

Teste en local :

```powershell
node server.js
```

Va sur `http://localhost:3000` pour vérifier que tout fonctionne avant de passer à l'exposition internet.

### Faire tourner le dashboard en service (avec NSSM)

```powershell
nssm install PalworldDashboard "C:\Program Files\nodejs\node.exe" "C:\PalworldDashboard\server.js"
nssm set PalworldDashboard AppDirectory "C:\PalworldDashboard"
nssm start PalworldDashboard
```

Un service NSSM tourne par défaut avec le compte **LocalSystem** (droits administrateur locaux)
— c'est ce qui permet à l'assistant d'installation (section 2) de créer le service Windows du
serveur Palworld et la règle de pare-feu. Si tu testes avec `node server.js` directement plutôt
qu'en service, lance ta console PowerShell **en administrateur** pour que l'assistant fonctionne ;
sinon un bandeau d'avertissement s'affiche dans le dashboard et l'installation échouera.

## 2. Créer le serveur Palworld depuis le dashboard

Connecte-toi au dashboard avec un compte admin : un panneau **"Installation du serveur Palworld"**
est visible en haut de la page, avec une checklist de l'état actuel (SteamCMD, serveur installé,
service Windows, API REST configurée).

Clique sur **"Configurer / réinstaller"** pour ouvrir le formulaire (réglages essentiels : dossier
d'installation, dossier SteamCMD, chemin NSSM, nom du service, nom du serveur, mot de passe
serveur optionnel, mot de passe admin — obligatoire, il sert aussi de mot de passe pour l'API
REST —, joueurs max, port de jeu, port API REST, dossier de sauvegardes), puis **"Lancer
l'installation"**. Le dashboard, en direct sous forme de log :
1. télécharge SteamCMD si besoin ;
2. télécharge/valide le serveur Palworld (12-15 Go, peut prendre du temps selon ta connexion) ;
3. génère et configure `PalWorldSettings.ini` (nom, mots de passe, API REST activée) ;
4. crée le service Windows et la règle de pare-feu (port de jeu en UDP) ;
5. met à jour automatiquement le `.env` du dashboard.

Aucune édition manuelle de fichier ni redémarrage du dashboard n'est nécessaire : dès
l'installation terminée, le panneau "Contrôle du serveur" plus bas fonctionne.

Les réglages plus avancés (difficulté, PvP, taux de drop, etc.) continuent de se régler à la main
dans `PalWorldSettings.ini` — l'assistant ne touche qu'aux réglages essentiels listés ci-dessus.

Si tu préfères tout faire à la main (ou que le dashboard ne peut pas tourner en administrateur), le
script `server-setup/install-palworld-server.ps1` reste disponible en secours : à lancer une fois
en PowerShell administrateur (voir son en-tête pour les paramètres), puis renseigner le `.env` à
la main comme décrit dans les commentaires de `.env.example`.

⚠️ **Ne jamais forward le port de l'API REST (8212 par défaut) sur ta box**, quelle que soit la
méthode d'installation utilisée. Elle n'a pas de HTTPS natif et utilise du Basic Auth en clair —
elle doit rester joignable uniquement en local (127.0.0.1). C'est le dashboard qui l'appelle en
interne, jamais tes amis directement.

## 3. Exposer le dashboard sur internet via ton IP fixe (Freebox)

Comme tu utilises directement ton IP publique fixe (pas de nom de domaine), pas de HTTPS
possible (les certificats SSL gratuits type Let's Encrypt ne se délivrent que pour un nom de
domaine, pas pour une IP brute). Le trafic passera donc en HTTP simple — c'est un choix
raisonnable ici puisqu'il n'y a rien de sensible en jeu (juste la gestion d'un serveur de jeu),
mais garde en tête que les mots de passe circulent en clair sur le trajet.

### Redirection de port sur la Freebox

1. Récupère l'IP locale de ton serveur Windows (`ipconfig` → IPv4, généralement du style
   `192.168.1.x`).
2. Va dans **Freebox OS → Paramètres de la Freebox → Gestion des ports**.
3. Ajoute une redirection :
   - Port externe : un port au choix, idéalement **non standard** pour limiter le bruit des
     scans automatiques (ex : `51234`) plutôt que `3000` ou `80`.
   - Protocole : TCP
   - IP de destination : l'IP locale de ton serveur Windows
   - Port de destination : `3000` (ou la valeur de `PORT` dans ton `.env`)

### Autoriser le port dans le pare-feu Windows

```powershell
New-NetFirewallRule -DisplayName "Palworld Dashboard" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### Accès pour tes amis

Ils se connectent simplement sur `http://TON.IP.PUBLIQUE.FIXE:51234` (remplace par ton port
externe choisi). Rien à installer, juste l'URL + leurs identifiants.

Tu peux retrouver ton IP publique fixe dans Freebox OS ou sur un site comme
`https://www.whatismyip.com`.

## 4. Nouvelles fonctionnalités

### Rôles : admin / user / viewer

Chaque compte a un rôle défini à la création (`npm run create-user -- user pass admin|user|viewer`) :
- **admin** : accès complet, y compris l'installation du serveur et la gestion des comptes admin.
- **user** : toutes les actions serveur (start/stop, sauvegardes, annonces, kick/ban, réglages,
  mises à jour) et la gestion des comptes `user`/`viewer`, mais **pas** l'installation du serveur
  ni la modification des comptes admin.
- **viewer** : lecture seule (statut, joueurs, carte, historique, journal, sauvegardes).

Toutes les routes sensibles sont vérifiées côté serveur (pas juste masquées côté navigateur), donc
un rôle ne peut pas être contourné en bidouillant les requêtes.

### Édition des réglages du monde depuis le web

Onglet "Réglages" (admin/user) : lecture et **édition directe** de `PalWorldSettings.ini`
(difficulté, taux, PvP…) — les booléens en menus Oui/Non, mots de passe masqués. L'édition n'est
autorisée que **serveur éteint** (Palworld ne relit ce fichier qu'au démarrage) ; un bouton
"Arrêter (avec sauvegarde) pour modifier" s'en charge au besoin (sauvegarde puis arrêt propre,
comme le bouton "Arrêter" du tableau de bord). La détection "serveur éteint" combine l'état du
service Windows ET la joignabilité de l'API REST Palworld, pour ne jamais laisser passer une
édition si l'un des deux signaux indique une activité. Un contrôle d'intégrité refuse par ailleurs
toute modification qui casserait le format du fichier (ce qui ferait régénérer les valeurs par
défaut par Palworld).

### Sauvegardes automatiques configurables

Onglet "Sauvegardes" : planning éditable depuis le web — activation, **plusieurs horaires par jour**,
choix des **jours de la semaine**, et nombre de sauvegardes conservées. Stocké dans
`data/backup-schedule.json`, appliqué immédiatement (sans redémarrage).

### Redémarrage automatique récurrent configurable

Onglet "Réglages" : même principe que les sauvegardes automatiques — activation, plusieurs
horaires par jour, jours de la semaine, et délai d'avertissement aux joueurs (annonces
décroissantes avant le redémarrage effectif, annulable comme un redémarrage programmé ponctuel).
Remplace le `RESTART_CRON` figé dans le `.env` (repris comme valeur de départ au premier lancement
si déjà configuré). Stocké dans `data/restart-schedule.json`.

### Restauration de sauvegarde depuis le web

Onglet "Sauvegardes" : bouton "Restaurer" sur chaque sauvegarde (admin/user, **serveur éteint
uniquement**). Une sauvegarde de sécurité du monde actuel est prise automatiquement avant
d'écraser `SAVE_PATH`, pour pouvoir revenir en arrière en cas d'erreur.

### Alerte espace disque

Le dashboard vérifie l'espace disque libre sur `BACKUP_DIR`/`SAVE_PATH` au démarrage puis toutes
les 30 minutes ; sous le seuil `DISK_SPACE_WARN_MB` (2 Go par défaut), une alerte Discord et une
bannière dans l'onglet "Sauvegardes" s'affichent (avec notification de retour à la normale).

### Console serveur

Onglet "Activité" (admin/user) : dernières lignes de la sortie console du serveur Palworld
(stdout/stderr), redirigées vers un fichier `console.log` par le service NSSM (avec rotation à
10 Mo). Disponible dès que le service a été (ré)installé avec cette version — sur une installation
plus ancienne, clique "(Ré)installer les services" dans l'onglet Réglages pour l'activer.

### Journal d'activité

Chaque action admin (start/stop/restart/backup/announce/kick) est enregistrée avec l'auteur et
l'horodatage dans `data/activity-log.json`, consultable dans le panneau "Journal d'activité" du
dashboard (les 500 dernières entrées sont conservées).

### Historique des joueurs

Un suivi tourne en tâche de fond (indépendamment du dashboard ouvert ou non) : il interroge
l'API Palworld toutes les 60 secondes et enregistre les connexions/déconnexions dans
`data/player-history.json`, avec le temps de jeu cumulé par joueur. Visible dans le panneau
"Historique des joueurs".

### Watchdog anti-crash

Toutes les 60 secondes (réglable via `WATCHDOG_INTERVAL_MS`), le dashboard vérifie que l'API
Palworld répond bien alors que le service Windows est marqué actif. Après 3 échecs consécutifs
(réglable via `WATCHDOG_FAIL_THRESHOLD`, soit ~3 minutes par défaut), il déclenche un redémarrage
automatique via NSSM. Un arrêt volontaire (bouton "Arrêter") n'est pas considéré comme un crash —
le watchdog ne redémarre pas un serveur que tu as arrêté exprès.

### Redémarrage planifié

Optionnel, activé en renseignant `RESTART_CRON` dans `.env` (syntaxe cron classique, ex :
`0 5 * * *` pour tous les jours à 5h). Une annonce est envoyée aux joueurs `RESTART_WARNING_MINUTES`
avant (5 min par défaut), puis le serveur redémarre proprement (sauvegarde + arrêt + relance).
Laisse `RESTART_CRON` vide pour désactiver.

### Opérations serveur avancées

- **Informations serveur** : version, uptime, FPS serveur, jours en jeu (via `/v1/api/metrics`).
- **Réglages du monde** en lecture (difficulté, taux d'XP, PvP…).
- **Ban / déban** : bouton "Bannir" à côté du kick ; la liste des bannis est conservée dans
  `data/bans.json` (l'API Palworld ne sait pas la lister) avec débannissement en un clic.
- **Sauvegarde du monde** immédiate (sans zip) et **arrêt forcé** (immédiat, sans sauvegarde).
- **Redémarrage programmé à la demande** : choisis un délai, les joueurs reçoivent des annonces
  décroissantes (30/15/10/5/3/1 min), annulable jusqu'au dernier moment.
- **Messages préréglés** : annonces en un clic sous le champ d'annonce.

### Mise à jour du serveur

Panneau "Mise à jour du serveur" : **Vérifier** compare le build installé (manifeste Steam local)
au dernier build publié (via SteamCMD, ~30-60 s), et **Appliquer** lance la mise à jour — avec
redémarrage propre si le serveur tourne, ou sans le relancer s'il était arrêté.

### Carte en direct

Positions des joueurs en temps réel (60 s max de latence), marqueurs voyage rapide et tours de
boss (désactivables), zoom à la molette, déplacement à la souris, regroupement automatique des
joueurs proches. Par défaut le fond est une grille de coordonnées : place une image de la carte
de Palpagos dans `public/map.png` (couvrant les coordonnées -1000..1000) pour l'utiliser en fond.
Les marqueurs et la conversion de coordonnées sont éditables dans `public/map-markers.json`.

### Sessions persistantes

Les connexions survivent aux redémarrages du dashboard (stockées dans `data/sessions.json`),
tant que `SESSION_SECRET` est renseigné dans le `.env`.

### Notifications Discord

Optionnel, renseigne `DISCORD_WEBHOOK_URL` dans `.env` (crée un webhook dans Discord via
**Paramètres du salon → Intégrations → Webhooks → Nouveau webhook**, copie l'URL). Une fois
configuré, le dashboard notifie automatiquement : démarrage/arrêt/redémarrage manuel, kick,
sauvegarde (réussie ou échouée), connexions/déconnexions des joueurs, et surtout les redémarrages
automatiques du watchdog — pratique pour savoir que le serveur a eu un souci sans avoir à checker
le dashboard.

## 5. Sécurité — points à ne pas zapper

- Le port 8212 (API Palworld) et le port 25575 (RCON, si activé) **ne doivent jamais être
  accessibles depuis internet**. Seul le port du dashboard (redirigé sur la Freebox) doit être ouvert.
- Ton serveur Windows est maintenant directement exposé sur internet via ta box (pas de Cloudflare
  devant pour filtrer/masquer) — les protections reposent entièrement sur le dashboard lui-même :
  - Limite anti brute-force déjà en place sur le login (8 tentatives / 15 min par IP)
  - Utilise un port externe non standard (voir section 3) pour réduire le bruit des scans automatiques
  - Mets un mot de passe fort et différent pour chaque ami (`npm run create-user`)
  - Comme c'est en HTTP, évite de réutiliser un mot de passe que tu utilises ailleurs pour ces comptes
- Le bouton "Arrêter" et "Redémarrer" demandent une confirmation côté navigateur — mais rien
  n'empêche un ami mal réveillé de cliquer trop vite, à toi de voir si tu veux limiter qui a accès
  au démarrage/arrêt vs juste au monitoring (facile à séparer en ajoutant un rôle `admin`/`viewer`
  dans `data/users.json` si besoin, je peux te faire l'ajout).
- Les sessions sont en mémoire (redémarrer le dashboard déconnecte tout le monde) — largement
  suffisant pour un usage entre amis, mais à savoir.
- Si ton IP publique change un jour (changement d'offre, panne, etc.), il faudra redonner la
  nouvelle IP à tes amis manuellement — pas d'IP fixe garantie à 100% dans le temps même si elle
  l'est aujourd'hui.

## 6. Fonctionnement des sauvegardes

- Bouton "Sauvegarder maintenant" : déclenche une sauvegarde propre côté Palworld
  (`POST /v1/api/save`) puis zippe le dossier `SAVE_PATH` dans `BACKUP_DIR`.
- Sauvegarde planifiée automatique selon `BACKUP_CRON` dans `.env` (par défaut tous les jours à
  4h du matin).
- `BACKUP_KEEP_COUNT` (défaut 14) : le dashboard supprime automatiquement les sauvegardes les plus
  anciennes au-delà de ce nombre, pour ne pas remplir le disque.
- Chaque sauvegarde est téléchargeable directement depuis la page.

## 7. Développement / tests

- `npm test` : lance les tests automatisés (runner intégré de Node, aucune dépendance en plus).
  Ils couvrent la logique sensible : comptes et rôles (protection "dernier admin"), journal
  d'activité, reprise des sessions joueurs après redémarrage du dashboard, écriture JSON
  sérialisée, édition de `PalWorldSettings.ini`.
- `npm run mock` : lance une fausse API Palworld sur le port 8212 pour tester le dashboard
  sans vrai serveur de jeu (lance ensuite `node server.js` normalement).

### Application desktop (lanceur .exe)

- `npm install` récupère aussi Electron (devDependency).
- `npm run electron:dev` : lance l'assistant desktop en mode développement (tourne sur le projet
  sur place, sans copier de fichiers ; utilise le Node du PATH pour le service).
- `npm run dist` : télécharge un `node.exe` autonome dans `runtime/` (via `scripts/fetch-node.js`)
  puis construit l'`.exe` portable dans `dist/` avec electron-builder. À lancer sur Windows.
- Le code du lanceur est dans `electron/` (processus principal + IPC + interface). Toute la logique
  d'installation est réutilisée telle quelle depuis `lib/` (notamment `lib/serverSetup.js`), donc le
  dashboard web et l'application desktop partagent exactement le même moteur.

## Référence API Palworld utilisée

Toutes les routes utilisées (`/v1/api/info`, `/players`, `/save`, `/shutdown`, `/announce`,
`/kick`) sont documentées officiellement ici : https://docs.palworldgame.com/api/rest-api/palwold-rest-api/
