# 🐾 Pal Launcher Server Manager

**The free, unlimited Palworld dedicated server manager for Windows — no command line, no
config-file editing, no monthly fee.**

[🇫🇷 Version française plus bas](#-version-française) · **[Website / Site](https://nothinx-44.github.io/pal-launcher-server-manager/)**

Pal Launcher installs the Palworld dedicated server for you, lets you change every world setting
from a clean web interface, restarts the server if it crashes, takes automatic backups, shows a
**live map of your players**, sends Discord notifications, and much more.

**100% free. No server limit. No Pro tier.**

## ⬇️ Download

**[Latest release](../../releases/latest)** — `PalLauncherServerManager-Setup.exe`

1. Download and double-click the installer. Windows asks for elevation (UAC) automatically —
   required to create the Windows services and the firewall rule.
2. Follow the setup wizard (install folder is configurable, Desktop/Start-menu shortcuts created).
3. Launch **“Pal Launcher Server Manager”** from the Start menu: it installs SteamCMD + the
   Palworld server, configures everything, and gives you a web dashboard to manage your server —
   accessible from any browser, even remotely.

> **Windows SmartScreen warning?** The installer is not code-signed yet. Click
> *More info* → *Run anyway*. The full source is auditable behavior — nothing leaves your machine.

## ✨ Features

- **Guided server installation** — zero prerequisites, everything is downloaded for you
- **Web dashboard** usable from any browser on your network or remotely (friends can have
  their own read-only or moderator accounts)
- **Live map** — see every player's position in real time
- Start / stop / restart, with schedulable recurring restarts (with in-game countdown warnings)
- Manual & scheduled backups (multiple times per day, per-weekday), one-click restore, zip import
- Edit world settings (`PalWorldSettings.ini`) from the browser
- Connected players, kick/ban, announcements, quick preset messages
- **Plugin manager** — install UE4SS and PalDefender (anti-cheat) in one click, plus
  PalDefender admin commands from the dashboard
- One-click server updates via SteamCMD, with update-available detection
- Multiple accounts with roles (admin / user / read-only)
- Discord notifications, activity log, player history & playtime, disk-space alert,
  anti-crash watchdog, server console viewer
- **Bilingual UI** — English & French, auto-detected

## 🔒 Security

- The admin password you set at install time is also the Palworld REST API password — it is
  never exposed publicly (the game API stays local to your machine).
- Every sensitive action is checked server-side against the account's role.

---

## 🇫🇷 Version française

**Le gestionnaire de serveur dédié Palworld gratuit et illimité pour Windows — pas de ligne de
commande, pas d'édition de fichiers de config, pas d'abonnement.**

Pal Launcher installe le serveur Palworld pour toi, te laisse changer les réglages depuis une
interface web claire, redémarre le serveur s'il plante, prend des sauvegardes automatiques,
affiche une **carte en direct des joueurs**, envoie des notifications Discord, et bien plus.

**100 % gratuit. Aucune limite de serveurs. Pas de version « Pro ».**

### Télécharger

**[Dernière version](../../releases/latest)** — `PalLauncherServerManager-Setup.exe`

1. Télécharge et double-clique le Setup : Windows demande l'élévation (UAC) automatiquement.
2. Suis l'assistant d'installation.
3. Lance **« Pal Launcher Server Manager »** depuis le menu Démarrer : il installe SteamCMD + le
   serveur Palworld, configure les services, et te donne un dashboard web accessible depuis
   n'importe quel navigateur, même à distance.

### Fonctionnalités

- Installation guidée du serveur (aucun prérequis)
- Dashboard web accessible à distance, comptes multiples avec rôles (admin / utilisateur / lecture seule)
- Carte en direct des joueurs
- Démarrage / arrêt / redémarrage, redémarrages récurrents programmables avec avertissements en jeu
- Sauvegardes manuelles et planifiées, restauration en un clic, import de zip
- Édition des réglages du monde depuis le navigateur
- Kick/ban, annonces, gestionnaire de plugins (UE4SS, PalDefender) et commandes admin PalDefender
- Mises à jour du serveur en un clic, notifications Discord, historique des joueurs, console serveur,
  alerte espace disque, watchdog anti-crash
- Interface bilingue français/anglais (détection automatique)

---

*Pal Launcher Server Manager is an independent tool, not affiliated with Pocketpair, Inc.
“Palworld” is a trademark of its respective owner.*
