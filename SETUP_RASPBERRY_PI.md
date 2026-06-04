# Raspberry Pi Setup Guide

Dieses Projekt kann vollständig auf einem Raspberry Pi ausgeführt werden. Hier ist eine Schritt-für-Schritt-Anleitung.

## Voraussetzungen

- Raspberry Pi 4 oder neuer (mind. 2GB RAM empfohlen)
- Raspberry Pi OS (Bullseye oder neuer)
- Internetverbindung

## Installation

### 1. Node.js installieren

```bash
# Update package manager
sudo apt-get update
sudo apt-get upgrade -y

# Installiere Node.js (LTS Version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Projekt klonen/vorbereiten

```bash
# Navigiere zum Projektverzeichnis oder klone das Repository
git clone <repository-url>
cd Projektwoche-MWG-2026
```

### 3. Abhängigkeiten installieren

```bash
npm install
```

### 4. Umgebungsvariablen konfigurieren

```bash
# Kopiere .env.example zu .env
cp .env.example .env

# Bearbeite .env mit deinem Editor
nano .env
```

Wichtige Einstellungen für Raspberry Pi:
- `PORT=3000` - Der Port, auf dem die Anwendung läuft
- `NODE_ENV=production` - Für Production
- `ADMIN_USER` und `ADMIN_PASS` - Sichere Admin-Anmeldedaten ändern
- Encryption Keys generieren (falls noch nicht geschehen)

### 5. Encryption Keys generieren (falls nötig)

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_IV=' + require('crypto').randomBytes(16).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Füge die generierten Werte in deine `.env` ein.

### 6. Starten der Anwendung

```bash
# Development-Modus (mit Auto-Reload)
npm run dev

# Production-Modus
npm start
```

Die Anwendung sollte auf `http://raspberrypi.local:3000` oder `http://<deine-ip>:3000` erreichbar sein.

## Systemd Service einrichten (für Autostart)

Um die Anwendung automatisch beim Booten zu starten:

### 1. Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/mwg-project.service
```

### 2. Folgende Inhalte einfügen

```ini
[Unit]
Description=MWG Project Week 2026 App
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Projektwoche-MWG-2026
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 3. Service aktivieren

```bash
# Service laden
sudo systemctl daemon-reload

# Service aktivieren
sudo systemctl enable mwg-project.service

# Service starten
sudo systemctl start mwg-project.service

# Status überprüfen
sudo systemctl status mwg-project.service

# Logs anzeigen
sudo journalctl -u mwg-project.service -f
```

## Netzwerkzugriff

Die Anwendung ist im lokalen Netzwerk unter folgenden Adressen erreichbar:

- `http://raspberrypi.local:3000` (falls mDNS aktiviert ist)
- `http://<raspberry-pi-ip>:3000` (direkter IP-Zugriff)

## Performance-Tipps für Raspberry Pi

1. **Verwende Production-Modus**
   ```bash
   NODE_ENV=production npm start
   ```

2. **RAM-Nutzung optimieren** - Erhöhe die Swap-Größe bei Bedarf:
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile
   # Ändere CONF_SWAPSIZE=100 zu CONF_SWAPSIZE=512 oder mehr
   sudo dphys-swapfile swapon
   ```

3. **Monitor-Prozesse überwachen**
   ```bash
   top
   # oder
   htop
   ```

## Datenbank

Die JSON-Dateien werden gespeichert in:
```
/database/data/
```

Diese Dateien sollten regelmäßig gesichert werden.

## Sicherheit

- ✅ Ändere standardmäßige Admin-Anmeldedaten
- ✅ Verwende starke Verschlüsselungsschlüssel
- ✅ Halte Node.js und npm aktuell
- ✅ Nutze eine Firewall oder beschränke Netzwerkzugriff
- ✅ Regelmäßige Backups von Datenbankdateien

## Troubleshooting

### Port 3000 bereits in Verwendung

```bash
# Finde den Prozess
lsof -i :3000

# Oder verwende einen anderen Port
PORT=3001 npm start
```

### Memory-Fehler

```bash
# Überprüfe verfügbaren Speicher
free -h

# Erhöhe Swap (siehe oben)
```

### Node-Module fehlen

```bash
rm -rf node_modules package-lock.json
npm install
```

## Aktualisierungen

```bash
# Hole die neuesten Änderungen
git pull origin main

# Installiere eventuell neue Dependencies
npm install

# Starte die Anwendung neu
sudo systemctl restart mwg-project.service
```

---

**Viel Erfolg mit deinem MWG-Projekt auf dem Raspberry Pi! 🚀**
