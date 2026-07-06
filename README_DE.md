# Projektwoche MWG 2026 - Management System

Eine moderne, sichere Verwaltungsanwendung für die Schulprojektwoche MWG 2026 mit Node.js, Express, EJS und Tailwind CSS.

## 🚀 Features

- **Sichere Authentifizierung**: Session-basiert mit Bcrypt-Passwort-Hashing
- **AES-256-GCM Verschlüsselung**: Alle JSON-Daten werden vollständig verschlüsselt
- **Rollenbasierte Zugriffskontrolle (RBAC)**: Rollen mit unterschiedlichen Berechtigungen
  - **Admin**: Vollzugriff auf alle Funktionen
  - **User**: Projekte und Zeitplan verwalten
- **Responsive UI**: Liquid Glass Design mit Dark Mode und Sharp Edges
- **Interaktive Features**:
  - Drag-and-Drop Zeitplan-Verwaltung
  - Pfeil-Steuerung im Zeitplan zum Verschieben von Slots
- **Zentrales Logging**: Alle Systemaktionen werden protokolliert

## 📋 Systemanforderungen

- Node.js >= 18.0.0
- npm >= 9.0.0
- Moderne Webbrowser (Chrome, Firefox, Safari, Edge)

## ⚙️ Installation

Für Vercel reicht ein Deployment über den Ordner mit [api/index.js](api/index.js).

### 1. Abhängigkeiten installieren
```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren

Erstelle eine `.env`-Datei im Wurzelverzeichnis:

```env
# Application
NODE_ENV=development
PORT=3000

# Admin Credentials (ÄNDERN!)
ADMIN_USER=admin
ADMIN_PASS=ChangeMe123!

# Encryption Keys (Generiere mit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=<32-byte-hex-schlüssel>
ENCRYPTION_IV=<16-byte-hex-schlüssel>

# Session Secret
SESSION_SECRET=<sichere-zufallszeichenkette>
```

### 3. Verschlüsselungsschlüssel generieren

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex')); console.log('ENCRYPTION_IV=' + require('crypto').randomBytes(16).toString('hex'));"
```

### 4. Server starten

**Entwicklung (mit Auto-Reload):**
```bash
npm run dev
```

**Produktion:**
```bash
npm start
```

Der Server läuft dann unter `http://localhost:3000`

## Persistenz auf Vercel

Wichtig: Ohne externe Datenbank sind Daten nach Redeploys auf Vercel nicht dauerhaft.

- Lokal: JSON-Dateien funktionieren dauerhaft in `database/data/`.
- Vercel ohne DB-URL: Standardmaessig startet die App nicht mehr, um stillen Datenverlust zu verhindern.
- Dauerhafte Lösung: PostgreSQL (z. B. Neon) anbinden.

Nur fuer temporaere Tests kannst du auf Vercel `ALLOW_EPHEMERAL_STORAGE=1` setzen.
Dann wird in `/tmp` gespeichert, aber Daten gehen bei Redeploy/Cold Start verloren.

### Erforderliche Vercel Environment Variables für Persistenz

- `NEON_DATABASE_URL` oder `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `ADMIN_USER`, `ADMIN_PASS_HASH`
- `USER_USER`, `USER_PASS_HASH`

Sobald `NEON_DATABASE_URL` oder `DATABASE_URL` gesetzt ist, nutzt die App automatisch PostgreSQL und die Daten bleiben über Deployments hinweg erhalten.

## 🔐 Sicherheit

### Admin-Benutzer
Der Admin-Benutzer wird automatisch beim ersten Start erstellt basierend auf den Umgebungsvariablen `ADMIN_USER` und `ADMIN_PASS`.

### Passwort-Anforderungen
- Mindestens 8 Zeichen
- Mindestens ein Großbuchstabe
- Mindestens ein Kleinbuchstabe
- Mindestens eine Ziffer
- Mindestens ein Sonderzeichen (!@#$%&*)

### Encryption
- **At Rest**: AES-256-GCM für alle JSON-Datenbank-Dateien
- **In Transit**: HTTPS (in Produktion empfohlen)
- **Sessions**: HttpOnly Cookies mit SameSite=Strict

### Temporary Passwords
Neue Benutzer erhalten automatisch generierte temporäre Passwörter im Format: `MWG!<12-zeichen-zufallsstring>`

## 📊 Seiten & Funktionen

### Öffentliche Bereich (ohne Login)
- **Startseite** (`/`): Live-Zeitplan und Projekte-Übersicht
- **Auto-Refresh**: Alle 30 Sekunden
- **Login-Link** zur internen Verwaltung

### Benutzer-Bereich (nach Login)

#### Dashboard
- Schneller Zugriff auf alle Funktionen
- Rollenspezifische Informationen

#### 📋 Projekte
- Tabellen-Ansicht aller Projekte
- Spalten: Name, Beschreibung, Betreuer, Teilnehmer, Präsentationsart
- **RBAC**: Nur Admin/Projekt Verwaltung können erstellen/bearbeiten

#### ⏰ Zeitplan
- Verwaltung von Zeitplan-Slots
- HTML5 Drag-and-Drop zum Sortieren
- Pfeil-Buttons zum Verschieben nach oben/unten
- Verknüpfung mit Bühnen-Projekten
- **Alle rollen** können Slots erstellen/bearbeiten

#### 🔧 Verwaltung (nur Admin/Projekt Verwaltung)
- **Benutzer-Verwaltung**:
  - Neuen Benutzer mit Rolle erstellen
  - Automatische temporäre Passwort-Generierung
  - Benutzer-Liste mit Rollen
- **Systemlogs**:
  - Protokoll aller Systemaktionen
  - Logins, Logouts, Änderungen
  - Letzte 100 Einträge angezeigt
  - Gefiltert nach Aktion

## 🗂️ Projektstruktur

```
Projektwoche-MWG-2026/
├── server.js                      # Hauptanwendung
├── package.json                   # Dependencies
├── .env                          # Umgebungsvariablen
├── middleware/
│   ├── auth.js                   # Authentication Middleware
│   ├── rbac.js                   # Role-Based Access Control
│   └── sessionHandler.js         # Session Management
├── utils/
│   ├── encryption.js             # AES-256-GCM Verschlüsselung
│   └── passwordHelper.js         # Passwort & Bcrypt
├── database/
│   ├── dbManager.js              # Datenbank-Manager
│   └── data/                     # Verschlüsselte JSON-Dateien
├── routes/                       # (in server.js integriert)
├── views/
│   ├── layout.ejs               # Basis-Layout mit Sidebar
│   ├── index.ejs                # Öffentliche Startseite
│   ├── login.ejs                # Login-Formular
│   ├── dashboard.ejs            # Dashboard
│   ├── projects/
│   │   ├── index.ejs            # Projekte-Liste
│   │   └── form.ejs             # Projekt-Formular
│   ├── schedule/index.ejs       # Zeitplan-Verwaltung
│   ├── admin/index.ejs          # Administration
│   └── error.ejs                # Error-Seite
├── public/
│   ├── css/                     # Statische CSS
│   ├── js/                      # Statische JavaScript
│   └── images/                  # Statische Bilder
└── README.md                    # Diese Datei
```

## 🎨 Design System

### "Liquid Glass" Ästhetik
- **Dark Mode** nur
- **Basis-Farbe**: Dark Blue (`#0a0f1e`)
- **Akzent-Farbe**: Deep Purple (`#2d0a4e`)
- **Primär**: Purple (`#7c3aed`)
- **Backdrop Blur**: 10px
- **Semi-transparente Hintergründe**: `rgba(255, 255, 255, 0.05)` - `0.1`
- **Sharp Edges**: Keine Rounded Corners (border-radius: 0)
- **Neon Glow**: Aktive Zustände mit box-shadow

## 🗄️ Datenspeicherung

### Verschlüsselte JSON-Dateien
Alle Daten werden in `database/data/` als verschlüsselte JSON-Dateien gespeichert:

- `users.json`: Benutzer und Authentifizierung
- `projects.json`: Projekt-Informationen
- `schedule.json`: Zeitplan-Slots
- `logs.json`: System-Logs

### Daten-Format
Jede Datei wird mit AES-256-GCM verschlüsselt und als Base64-String gespeichert.

## 🔄 API-Endpoints

### Authentifizierung
- `GET /login` - Login-Seite
- `POST /login` - Authentifizierung
- `GET /logout` - Abmelden

### Öffentlich
- `GET /` - Öffentliche Startseite

### Dashboard & Navigation
- `GET /dashboard` - Dashboard (erfordert Login)

### Projekte
- `GET /projekte` - Projekte-Liste
- `GET /projekte/neu` - Projekt-Formular
- `POST /api/projects` - Projekt erstellen

### Zeitplan
- `GET /zeitplan` - Zeitplan-Verwaltung
- `POST /api/schedule/slots` - Neuen Slot erstellen
- `PUT /api/schedule/reorder` - Slots sortieren

### Administration
- `GET /verwaltung` - Admin-Panel
- `POST /api/admin/users` - Benutzer erstellen

## 🛠️ Troubleshooting

### Verschlüsselungsschlüssel verloren
Wenn die Verschlüsselungsschlüssel verloren gehen, können die JSON-Dateien in `database/data/` nicht mehr entschlüsselt werden. Löschen Sie die Dateien, um die Anwendung zurückzusetzen:

```bash
rm -rf database/data/*.json
```

### Sessions funktionieren nicht
Überprüfen Sie, dass `SESSION_SECRET` in der `.env`-Datei korrekt gesetzt ist und der Server neu gestartet wurde.

### Admin-Benutzer kann sich nicht anmelden
Überprüfen Sie die Anmeldedaten in der `.env`-Datei und starten Sie den Server neu. Der Admin-Benutzer wird beim Start initialisiert.

## 📝 Development

### Projekt-Struktur erweitern
1. Neue Routes in `server.js` hinzufügen
2. EJS Templates in entsprechenden `views/` Ordnern erstellen
3. Middleware nach Bedarf in `middleware/` erweitern
4. Datenbank-Operationen in `database/dbManager.js` hinzufügen

### Styling
Das Projekt nutzt Tailwind CSS mit eigenen CSS-Variablen und Klassen. Siehe `views/layout.ejs` für Style-Definitionen.

## 🚀 Deployment

### Production-Checklist
- [ ] NODE_ENV=production setzen
- [ ] Sichere, zufällige Encryption Keys generieren
- [ ] Admin-Passwort ändern
- [ ] SESSION_SECRET ändern
- [ ] HTTPS aktivieren
- [ ] Regelmäßige Backups einrichten
- [ ] Log-Rotation konfigurieren

### Vercel Deployment

1. Repository zu GitHub pushen oder lokal mit Vercel CLI deployen.

2. Setze in den Vercel Project Settings die folgenden Umgebungsvariablen (Environment Variables):

- `ADMIN_USER` — Admin-Benutzername
- `ADMIN_PASS` — Admin-Passwort
- `ENCRYPTION_KEY` — 32-Byte Hex-String
- `ENCRYPTION_IV` — 16-Byte Hex-String
- `SESSION_SECRET` — Sichere Zufallszeichenkette
- `NODE_ENV` — `production`

3. Verbinde das Git-Repository in Vercel oder nutze die CLI:

```bash
npm i -g vercel
vercel login
vercel --prod
```

Hinweis: Das Projekt nutzt eine Serverless-Function unter `/api/server.js` (konfiguriert in `vercel.json`), die alle Routen behandelt und die EJS-Templates rendert. Statische Assets liegen im `public/`-Ordner.


### Mit Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "server.js"]
```

## 📄 Lizenz

MIT

## 👥 Support

Bei Problemen oder Fragen bitte ein Issue erstellen oder den Administrator kontaktieren.

---

**Version**: 1.0.0  
**Zuletzt aktualisiert**: Juni 2026  
**Entwickelt für**: MWG Schulprojektwoche 2026
