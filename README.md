# Projektwoche MWG 2026 - Management System

Eine moderne, sichere Verwaltungsanwendung für die Schulprojektwoche MWG 2026 mit Node.js, Express, EJS und Tailwind CSS.

## 🚀 Quick Start

Dieses Projekt läuft lokal und kann direkt auf Vercel deployed werden.

```bash
# Abhängigkeiten installieren
npm install

# .env Datei erstellen und konfigurieren
cp .env .env.backup

# Verschlüsselungsschlüssel generieren
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Server starten
npm run dev
```

Öffne http://localhost:3000

## 📚 Vollständige Dokumentation

Siehe [README_DE.md](./README_DE.md) für vollständige deutsche Dokumentation mit:
- Detaillierte Installation & Setup
- Alle Seiten & Features
- API-Endpoints
- Sicherheitshinweise
- Troubleshooting

## 🔐 Features

- ✅ **AES-256-GCM Verschlüsselung**: Vollständige Verschlüsselung aller JSON-Dateien
- ✅ **Session-basierte Auth**: Sichere Authentifizierung mit Bcrypt
- ✅ **RBAC**: Rollenbasierte Zugriffskontrolle
- ✅ **Dark Mode UI**: "Liquid Glass" Design mit Sharp Edges
- ✅ **Interaktiv**: Drag-and-Drop im Zeitplan
- ✅ **Logging**: Zentrales System-Logging aller Aktionen
- ✅ **JSON-DB**: Keine externe Datenbank erforderlich

## 👥 Benutzerrollen

| Rolle | Berechtigungen |
|-------|---|
| **Admin** | Vollzugriff auf alle Funktionen |
| **User** | Projekte und Zeitplan verwalten |

## 📋 Hauptfunktionen

- 🏠 **Öffentliche Startseite**: Live-Zeitplan und Projekte
- 📊 **Dashboard**: Zentrale Navigation
- 📋 **Projekte**: Übersicht und Verwaltung
- ⏰ **Zeitplan**: Drag-and-Drop Management
- 🔧 **Administration**: Benutzer & Logs verwalten

## 🛠️ Technologie-Stack

- **Backend**: Node.js + Express.js
- **Frontend**: EJS Templates + Tailwind CSS
- **Sicherheit**: Bcrypt + AES-256-GCM
- **Datenspeicherung**: Verschlüsselte JSON-Dateien
- **Session Management**: express-session

## 📂 Projektstruktur

```
├── server.js                    # Hauptanwendung
├── middleware/                  # Auth, RBAC, Session
├── utils/                       # Encryption, Password utilities
├── database/                    # Database Manager
├── views/                       # EJS Templates
│   ├── layout.ejs              # Base Layout
│   ├── index.ejs               # Public page
│   ├── login.ejs               # Login
│   ├── dashboard.ejs           # Dashboard
│   ├── projects/               # Projects pages
│   ├── schedule/               # Schedule pages
│   └── admin/                  # Admin panel
└── public/                      # Static files
```

## 🔑 Umgebungsvariablen

```env
NODE_ENV=development
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=ChangeMe123!
ENCRYPTION_KEY=<32-byte-hex>
ENCRYPTION_IV=<16-byte-hex>
SESSION_SECRET=<random-secret>
```

## 🚀 Deployment

Production-Checklist:
- [ ] NODE_ENV=production
- [ ] Sichere Encryption Keys generieren
- [ ] Admin-Passwort ändern
- [ ] HTTPS aktivieren
- [ ] Regelmäßige Backups
- [ ] Log-Rotation einrichten

## 📝 License

MIT

---

**Version**: 1.0.0  
**Für**: MWG Schulprojektwoche 2026
