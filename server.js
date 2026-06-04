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

    const adminUser = await db.getUserByUsername(process.env.ADMIN_USER);
    if (!adminUser) {
      const created = await db.createUser({
        username: process.env.ADMIN_USER,
        email: 'admin@mwg.local',
        role: 'admin',
        tempPassword: process.env.ADMIN_PASS
      });
      await db.updateUser(created.id, { password: process.env.ADMIN_PASS, role: 'admin' });
      console.log('✓ Admin user initialized');
      return;
    }

    if (!adminUser.passwordHash) {
      await db.updateUser(adminUser.id, { password: process.env.ADMIN_PASS, role: 'admin' });
      console.log('✓ Admin password initialized');
    }
  } catch (error) {
    console.error('Failed to initialize admin:', error);
    process.exit(1);
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

    const { time, duration, projectId } = req.body;

    if (!time) {
      return res.status(400).json({ error: 'Zeit erforderlich' });
    }

    const slot = await db.createScheduleSlot({
      time,
      duration: parseInt(duration) || 30,
      projectId: projectId || null
    });

    await db.addLog({
      action: 'schedule_slot_created',
      userId: req.session.user.id,
      details: `Created schedule slot: ${time}`
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

// Map/Grounds routes
app.get('/gelande', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const grounds = await db.getGrounds();
  const projects = await db.getAllProjects();
  
  res.render('map/index', { grounds, projects });
});

app.post('/api/grounds', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { booths, stage } = req.body;

    await db.updateGrounds(booths, stage);

    await db.addLog({
      action: 'grounds_updated',
      userId: req.session.user.id,
      details: `Updated grounds layout`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Grounds update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kanban routes
app.get('/kanban', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const tasks = await db.getAllTasks();
  const todoTasks = tasks.filter(t => t.column === 'todo');
  const inProgressTasks = tasks.filter(t => t.column === 'inprogress');
  const doneTasks = tasks.filter(t => t.column === 'done');
  
  res.render('kanban/index', { todoTasks, inProgressTasks, doneTasks });
});

app.post('/api/kanban/tasks', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { title, description, column } = req.body;

    if (!title || !column) {
      return res.status(400).json({ error: 'Titel und Spalte erforderlich' });
    }

    const task = await db.createTask({
      title,
      description,
      column,
      createdBy: req.session.user.id
    });

    await db.addLog({
      action: 'task_created',
      userId: req.session.user.id,
      details: `Created task: ${title}`
    });

    res.json(task);
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/kanban/tasks/:taskId', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { taskId } = req.params;
    const { column, title, description } = req.body;

    const task = await db.updateTask(taskId, {
      column,
      title,
      description
    });

    await db.addLog({
      action: 'task_updated',
      userId: req.session.user.id,
      details: `Updated task: ${taskId}`
    });

    res.json(task);
  } catch (error) {
    console.error('Task update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/kanban/tasks/:taskId', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { taskId } = req.params;

    await db.deleteTask(taskId);

    await db.addLog({
      action: 'task_deleted',
      userId: req.session.user.id,
      details: `Deleted task: ${taskId}`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Task deletion error:', error);
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

app.post('/api/admin/users', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { hasPermission } = await import('./middleware/rbac.js');
    if (!hasPermission(req.session.user.role, 'admin:create_user')) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { username, email, role } = req.body;
    const { generateTemporaryPassword } = await import('./utils/passwordHelper.js');

    if (!username || !email || !role) {
      return res.status(400).json({ error: 'Alle Felder erforderlich' });
    }

    const tempPassword = generateTemporaryPassword();
    const user = await db.createUser({
      username,
      email,
      role,
      tempPassword
    });

    db.addLog({
      action: 'user_created',
      userId: req.session.user.id,
      details: `Created user: ${username}`
    });

    res.json({ ...user, tempPassword });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: error.message });
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

// Start the server and initialize admin
(async () => {
  try {
    await initializeAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
