# Projektwoche MWG 2026 - Management System

Eine moderne, sichere Verwaltungsanwendung für die Schulprojektwoche MWG 2026 mit Node.js, Express, EJS und Tailwind CSS.

## 🚀 Features

- **Sichere Authentifizierung**: Session-basiert mit Bcrypt-Passwort-Hashing
- **AES-256-GCM Verschlüsselung**: Alle JSON-Daten werden vollständig verschlüsselt
- **Rollenbasierte Zugriffskontrolle (RBAC)**: 4 Rollen mit unterschiedlichen Berechtigungen
  - **Admin**: Vollzugriff auf alle Funktionen
  - **Projekt Verwaltung**: Verwaltet Projekte und Zeitplan
  - **Bühnentechnik**: Verwaltet Zeitplan und Gelände-Layout
  - **User**: Nur Lesezugriff auf Daten
- **Responsive UI**: Liquid Glass Design mit Dark Mode und Sharp Edges
- **Interaktive Features**:
  - Drag-and-Drop Zeitplan-Verwaltung
  - Interaktives Gelände-Layout mit Stände und Bühne
  - Kanban Board für Aufgabenmanagement
- **Zentrales Logging**: Alle Systemaktionen werden protokolliert

## 📋 Systemanforderungen

- Node.js >= 18.0.0
- npm >= 9.0.0
- Moderne Webbrowser (Chrome, Firefox, Safari, Edge)

## ⚙️ Installation

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
- Verknüpfung mit Bühnen-Projekten
- **Alle rollen** können Slots erstellen/bearbeiten

#### 🗺️ Gelände
- Interaktive Canvas-basierte Visualisierung
- Drag-and-Drop Stände aus Projektliste
- Positionierbare Bühne
- Größen-Anpassung
- Persistierung im Dateisystem

#### 📌 Kanban Board
- 3 Spalten: "Zu erledigen" (Rot), "In Bearbeitung" (Gelb), "Erledigt" (Grün)
- Drag-and-Drop zwischen Spalten
- **Alle Benutzer** können Tasks erstellen

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
│   ├── map/index.ejs            # Gelände-Visualisierung
│   ├── kanban/index.ejs         # Kanban Board
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

### Farb-Schema für Kanban
- **Zu erledigen (Red)**: `#dc2626`
- **In Bearbeitung (Yellow)**: `#ca8a04`
- **Erledigt (Green)**: `#22c55e`

## 🗄️ Datenspeicherung

### Verschlüsselte JSON-Dateien
Alle Daten werden in `database/data/` als verschlüsselte JSON-Dateien gespeichert:

- `users.json`: Benutzer und Authentifizierung
- `projects.json`: Projekt-Informationen
- `schedule.json`: Zeitplan-Slots
- `grounds.json`: Gelände-Layout (Stände & Bühne)
- `kanban.json`: Kanban Board Tasks
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

### Gelände
- `GET /gelande` - Gelände-Visualisierung
- `POST /api/grounds` - Layout speichern

### Kanban
- `GET /kanban` - Kanban Board
- `POST /api/kanban/tasks` - Task erstellen
- `PUT /api/kanban/tasks/:taskId` - Task aktualisieren
- `DELETE /api/kanban/tasks/:taskId` - Task löschen

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
