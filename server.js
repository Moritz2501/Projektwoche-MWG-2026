import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseManager from './database/dbManager.js';
import { sessionConfig } from './middleware/sessionHandler.js';
import { attachUser } from './middleware/auth.js';
import { hashPassword } from './utils/passwordHelper.js';

// Load environment variables
dotenv.config();

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (!process.env.ENCRYPTION_KEY && !process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
  process.env.ENCRYPTION_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
}

// Initialize database
const db = new DatabaseManager(process.env.ENCRYPTION_KEY);

// ==================== MIDDLEWARE ====================

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session management
app.use(session(sessionConfig));

// View engine setup
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Attach user to locals
app.use(attachUser);

// ==================== INITIALIZATION ====================

/**
 * Initialize admin user on startup
 */
async function initializeAdmin() {
  try {
    await db.initializeDefaults();
    console.log('✓ Standard user accounts initialized');
  } catch (error) {
    console.error('Failed to initialize users:', error);
    throw error;
  }
}

// ==================== ROUTES ====================

// Public routes
app.get('/', async (req, res) => {
  const slots = (await db.getAllScheduleSlots()).sort((a, b) => a.order - b.order);
  const projects = await db.getAllProjects();
  res.render('index', { slots, projects });
});

// Auth routes
app.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.render('login', { error: 'Benutzername und Passwort erforderlich' });
    }

    const user = await db.getUserByUsername(username);
    
    if (!user) {
      db.addLog({
        action: 'login_failed',
        userId: 'unknown',
        details: `Failed login attempt for username: ${username}`
      });
      return res.render('login', { error: 'Ungültige Anmeldedaten' });
    }

    const { comparePassword } = await import('./utils/passwordHelper.js');
    const passwordMatch = await comparePassword(password, user.passwordHash);

    if (!passwordMatch) {
      db.addLog({
        action: 'login_failed',
        userId: user.id,
        details: `Failed login attempt`
      });
      return res.render('login', { error: 'Ungültige Anmeldedaten' });
    }

    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    };

    db.addLog({
      action: 'login_success',
      userId: user.id,
      details: `User logged in`
    });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Ein Fehler ist aufgetreten' });
  }
});

app.get('/logout', (req, res) => {
  const userId = req.session?.user?.id;
  
  if (userId) {
    db.addLog({
      action: 'logout',
      userId,
      details: 'User logged out'
    });
  }

  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  res.render('dashboard', { user: req.session.user });
});

// Projects routes
app.get('/projekte', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const projects = await db.getAllProjects();
  res.render('projects/index', { projects });
});

app.get('/projekte/neu', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const { requirePermission } = await import('./middleware/rbac.js');
  const canCreate = requirePermission('projects:create');
  
  res.render('projects/form', { project: null });
});

app.get('/projekte/batch', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const { hasPermission } = await import('./middleware/rbac.js');
  if (!hasPermission(req.session.user.role, 'projects:create')) {
    return res.status(403).render('error', { message: 'Zugriff verweigert' });
  }

  res.render('projects/batch');
});

app.post('/api/projects', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { hasPermission } = await import('./middleware/rbac.js');
    if (!hasPermission(req.session.user.role, 'projects:create')) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { name, description, supervisors, memberCount, presentationType } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name und Beschreibung erforderlich' });
    }

    const project = db.createProject({
      name,
      description,
      supervisors: supervisors ? supervisors.split(',').map(s => s.trim()) : [],
      memberCount: parseInt(memberCount) || 0,
      presentationType: presentationType || 'booth'
    });

    db.addLog({
      action: 'project_created',
      userId: req.session.user.id,
      details: `Created project: ${name}`
    });

    res.json(project);
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch project creation
app.post('/api/projects/batch', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { hasPermission } = await import('./middleware/rbac.js');
    if (!hasPermission(req.session.user.role, 'projects:create')) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { projects } = req.body;

    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ error: 'Keine Projekte zum Erstellen vorhanden' });
    }

    let createdCount = 0;
    const errors = [];

    for (const projectData of projects) {
      try {
        const { name, description, supervisors, memberCount, presentationType } = projectData;

        if (!name || !description) {
          errors.push(`Projekt "${name || 'unnamed'}": Name und Beschreibung erforderlich`);
          continue;
        }

        const project = db.createProject({
          name,
          description,
          supervisors: supervisors ? (typeof supervisors === 'string' ? supervisors.split(',').map(s => s.trim()) : supervisors) : [],
          memberCount: parseInt(memberCount) || 0,
          presentationType: presentationType || 'booth'
        });

        db.addLog({
          action: 'project_created',
          userId: req.session.user.id,
          details: `Created project (batch): ${name}`
        });

        createdCount++;
      } catch (err) {
        errors.push(`Fehler bei Projekt: ${err.message}`);
      }
    }

    res.json({ 
      created: createdCount, 
      total: projects.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Batch project creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule routes
app.get('/zeitplan', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const slots = (await db.getAllScheduleSlots()).sort((a, b) => a.order - b.order);
  const projects = (await db.getAllProjects()).filter(p => p.presentationType === 'stage-time-slot');
  
  res.render('schedule/index', { slots, projects });
});

app.post('/api/schedule/slots', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { duration, projectId } = req.body;

    const slot = await db.createScheduleSlot({
      time: null,
      duration: duration ? parseInt(duration) : null,
      projectId: projectId || null
    });

    await db.addLog({
      action: 'schedule_slot_created',
      userId: req.session.user.id,
      details: `Created schedule slot with duration: ${duration || 'none'}`
    });

    res.json(slot);
  } catch (error) {
    console.error('Schedule creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/schedule/reorder', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { slots } = req.body;

    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: 'Slots müssen ein Array sein' });
    }

    await db.updateScheduleOrder(slots);

    await db.addLog({
      action: 'schedule_reordered',
      userId: req.session.user.id,
      details: `Reordered ${slots.length} schedule slots`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Schedule reorder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin routes
app.get('/verwaltung', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }

    const { hasPermission } = await import('./middleware/rbac.js');
    if (!hasPermission(req.session.user.role, 'admin:view_logs')) {
      return res.status(403).render('error', { message: 'Zugriff verweigert' });
    }

    const users = await db.getAllUsers();
    const logs = (await db.getAllLogs()).reverse().slice(0, 100);
    
    res.render('admin/index', { users, logs });
  } catch (error) {
    console.error('Admin page error:', error);
    res.status(500).render('error', { message: 'Ein Fehler ist aufgetreten' });
  }
});

// Error handling
app.use((req, res) => {
  res.status(404).render('error', { message: 'Seite nicht gefunden' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', { message: 'Ein Fehler ist aufgetreten' });
});

// ==================== EXPORTS ====================

export { app, initializeAdmin };

async function startServer() {
  try {
    await initializeAdmin();

    if (!isVercel) {
      app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    if (!isVercel) {
      process.exit(1);
    }
  }
}

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  startServer();
}

export { startServer };
