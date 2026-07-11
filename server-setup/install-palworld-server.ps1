<#
.SYNOPSIS
    Installe un serveur Palworld dédié complet : SteamCMD, téléchargement du serveur,
    génération de la config, service Windows via NSSM, règles de pare-feu.

.DESCRIPTION
    À exécuter en PowerShell en tant qu'administrateur, une seule fois pour l'installation initiale.
    Idempotent : peut être relancé sans casser une install existante (steamcmd validate ne
    retélécharge que ce qui manque/diffère).

.EXAMPLE
    .\install-palworld-server.ps1 -InstallDir "D:\PalworldServer" -NssmPath "C:\nssm\nssm.exe"
#>

param(
    [string]$InstallDir = "D:\PalworldServer",
    [string]$SteamCmdDir = "D:\PalworldServer\SteamCMD",
    [string]$NssmPath = "C:\nssm\nssm.exe",
    [string]$ServiceName = "PalworldServer",
    [string]$ServerName = "Serveur de Vincent",
    [int]$MaxPlayers = 8,
    [int]$Port = 8211,
    [int]$QueryPort = 27015
)

$ErrorActionPreference = "Stop"
$AppId = "2394010"
$ServerDir = Join-Path $InstallDir "Server"
$BackupDir = Join-Path $InstallDir "Backups"
$SteamCmdExe = Join-Path $SteamCmdDir "steamcmd.exe"

Write-Host "=== Installation du serveur Palworld dédié ===" -ForegroundColor Cyan
Write-Host "Dossier d'installation : $InstallDir"
Write-Host ""

# ---------- 1. Vérifier / installer SteamCMD ----------
if (-not (Test-Path $SteamCmdExe)) {
    Write-Host "[1/6] SteamCMD introuvable, téléchargement..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $SteamCmdDir | Out-Null
    $zipPath = Join-Path $SteamCmdDir "steamcmd.zip"
    Invoke-WebRequest -Uri "https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip" -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $SteamCmdDir -Force
    Remove-Item $zipPath
    Write-Host "SteamCMD installé." -ForegroundColor Green
} else {
    Write-Host "[1/6] SteamCMD déjà présent, ok." -ForegroundColor Green
}

# ---------- 2. Télécharger / mettre à jour le serveur Palworld ----------
Write-Host "[2/6] Téléchargement du serveur Palworld (App ID $AppId)..." -ForegroundColor Yellow
Write-Host "      (12-15 Go, ça peut prendre un moment selon ta connexion)"
& $SteamCmdExe +force_install_dir $ServerDir +login anonymous +app_update $AppId validate +quit
if (-not (Test-Path (Join-Path $ServerDir "PalServer.exe"))) {
    throw "Échec : PalServer.exe introuvable après l'installation SteamCMD."
}
Write-Host "Serveur Palworld installé/à jour." -ForegroundColor Green

# ---------- 3. Premier lancement pour générer l'arborescence de config ----------
$ConfigDir = Join-Path $ServerDir "Pal\Saved\Config\WindowsServer"
$SettingsFile = Join-Path $ConfigDir "PalWorldSettings.ini"
$DefaultSettingsFile = Join-Path $ServerDir "DefaultPalWorldSettings.ini"

if (-not (Test-Path $ConfigDir)) {
    Write-Host "[3/6] Premier lancement pour générer la config (30s)..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath (Join-Path $ServerDir "PalServer.exe") -PassThru -WindowStyle Minimized
    Start-Sleep -Seconds 30
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
} else {
    Write-Host "[3/6] Config déjà générée, ok." -ForegroundColor Green
}

# ---------- 4. Copier la config par défaut si PalWorldSettings.ini est vide ----------
if ((Test-Path $DefaultSettingsFile) -and ((Get-Item $SettingsFile -ErrorAction SilentlyContinue).Length -in 0..10)) {
    Write-Host "[4/6] PalWorldSettings.ini vide, copie de la config par défaut..." -ForegroundColor Yellow
    Copy-Item $DefaultSettingsFile $SettingsFile -Force
    Write-Host "Pense à éditer $SettingsFile pour :" -ForegroundColor Cyan
    Write-Host "  - ServerName, AdminPassword"
    Write-Host "  - RESTAPIEnabled=True, RESTAPIPort=8212 (nécessaire pour le dashboard)"
} else {
    Write-Host "[4/6] PalWorldSettings.ini déjà configuré, ok." -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# ---------- 5. Service Windows via NSSM ----------
if (-not (Test-Path $NssmPath)) {
    Write-Host "[5/6] NSSM introuvable à $NssmPath" -ForegroundColor Red
    Write-Host "      Télécharge-le sur https://nssm.cc/download et adapte -NssmPath." -ForegroundColor Red
} else {
    $existing = & $NssmPath status $ServiceName 2>$null
    if (-not $existing) {
        Write-Host "[5/6] Création du service Windows '$ServiceName'..." -ForegroundColor Yellow
        & $NssmPath install $ServiceName (Join-Path $ServerDir "PalServer.exe")
        & $NssmPath set $ServiceName AppParameters "-ServerName=""$ServerName"" -port=$Port -queryport=$QueryPort -players=$MaxPlayers -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS EpicApp=PalServer"
        & $NssmPath set $ServiceName AppDirectory $ServerDir
        & $NssmPath set $ServiceName Start SERVICE_DEMAND_START
        & $NssmPath set $ServiceName AppExit Default Restart
        & $NssmPath set $ServiceName AppRestartDelay 5000
        Write-Host "Service créé (démarrage manuel, à contrôler depuis le dashboard)." -ForegroundColor Green
    } else {
        Write-Host "[5/6] Service '$ServiceName' déjà existant, ok." -ForegroundColor Green
    }
}

# ---------- 6. Pare-feu ----------
Write-Host "[6/6] Règles de pare-feu (port $Port UDP pour les joueurs)..." -ForegroundColor Yellow
if (-not (Get-NetFirewallRule -DisplayName "Palworld Server" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Palworld Server" -Direction Inbound -LocalPort $Port -Protocol UDP -Action Allow | Out-Null
    Write-Host "Règle ajoutée." -ForegroundColor Green
} else {
    Write-Host "Règle déjà présente, ok." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Installation terminée ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Valeurs à mettre dans le .env du dashboard :" -ForegroundColor Cyan
Write-Host "  NSSM_PATH=$NssmPath"
Write-Host "  SERVICE_NAME=$ServiceName"
Write-Host "  SAVE_PATH=$ServerDir\Pal\Saved\SaveGames"
Write-Host "  STEAMCMD_PATH=$SteamCmdExe"
Write-Host "  PALWORLD_INSTALL_DIR=$ServerDir"
Write-Host ""
Write-Host "N'oublie pas :" -ForegroundColor Yellow
Write-Host "  1. Éditer $SettingsFile (AdminPassword, RESTAPIEnabled=True, RESTAPIPort=8212)"
Write-Host "  2. Ouvrir le port $Port/UDP sur ta Freebox vers l'IP locale de cette machine"
Write-Host "  3. Démarrer le serveur une première fois depuis le dashboard pour vérifier"
