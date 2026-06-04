# Quick Start Guide

Diese Anwendung ist jetzt komplett lokalisiert und läuft ohne Cloud-Services!

## Schnelstart (lokal oder Raspberry Pi)

### 1. Dependencies installieren
```bash
npm install
```

### 2. Umgebung konfigurieren
```bash
# Kopiere die .env.example (falls nicht vorhanden)
cp .env.example .env

# Bearbeite .env mit deinen Werten
nano .env
```

### 3. Starten

**Entwicklung** (mit Auto-Reload bei Dateiänderungen):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

### 4. Öffne im Browser
```
http://localhost:3000
```

## Standard Anmeldedaten
- **Benutzer**: admin
- **Passwort**: (siehe .env - Standard: admin123)

## Struktur

- **server.js** - Hauptanwendungseinstiegspunkt (Express.js)
- **database/dbManager.js** - JSON-basierte Datenverwaltung
- **routes/** - API-Endpoints (falls vorhanden)
- **middleware/** - Express Middleware (Auth, RBAC, Sessions)
- **public/** - Statische Dateien (CSS, JS, Bilder)
- **views/** - EJS Templates für UI
- **utils/** - Utility-Funktionen

## Vercel-Abhängigkeiten entfernt ✓

Die folgenden Dateien wurden entfernt (nicht mehr nötig):
- ✓ `vercel.json` - Vercel-Konfiguration
- ✓ `api/server.js` - Serverless Wrapper
- ✓ `serverless-http` Dependency

Das Projekt ist jetzt vollständig lokal betriebsfähig!

## Für Raspberry Pi

Siehe [SETUP_RASPBERRY_PI.md](SETUP_RASPBERRY_PI.md) für detaillierte Anweisungen zur Installation und zum Autostart.

---

**Entwicklung**: Nutze `npm run dev` für schnelle Iterationen  
**Produktion**: Nutze `npm start` oder systemd Service auf Raspberry Pi
