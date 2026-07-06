# Quick Start Guide

Diese Anwendung läuft lokal und kann direkt auf Vercel deployed werden.

## Schnelstart

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

## Deployment

- Für Vercel: Der Einstiegspunkt ist [api/index.js](api/index.js).
- Für lokale Entwicklung: Nutze `npm run dev`.
- Für Produktion: Nutze `npm start`.

### Wichtig für Vercel

Ohne `NEON_DATABASE_URL` oder `DATABASE_URL` werden Daten in einer temporären Umgebung gespeichert und können nach Redeploy verloren gehen.

Für dauerhafte Daten auf Vercel:

1. PostgreSQL (z. B. Neon) anlegen.
2. In Vercel Project Settings setzen: `NEON_DATABASE_URL` (oder `DATABASE_URL`).
3. Deployment neu ausführen.

---

**Entwicklung**: Nutze `npm run dev` für schnelle Iterationen  
**Produktion**: Nutze `npm start`
