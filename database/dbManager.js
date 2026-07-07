import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { encryptData, decryptData } from '../utils/encryption.js';
import { hashPassword } from '../utils/passwordHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_DATA_DIR = path.join(__dirname, 'data');
const TEMP_DATA_DIR = path.join('/tmp', 'projektwoche-mwg-2026-data');
const ENCRYPTED_DATA_EXTENSION = '.enc';
const LEGACY_DATA_EXTENSION = '.json';
const isVercelRuntime = process.env.VERCEL === '1';
const allowEphemeralStorage = process.env.ALLOW_EPHEMERAL_STORAGE === '1';

function isValidPostgresUrl(urlValue) {
  if (!urlValue || typeof urlValue !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(urlValue);
    const isPgProtocol = parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
    return isPgProtocol && Boolean(parsed.hostname);
  } catch (err) {
    return false;
  }
}

function resolveConnectionString() {
  const candidates = [
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['NEON_DATABASE_URL', process.env.NEON_DATABASE_URL]
  ];

  for (const [envName, rawValue] of candidates) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!value) {
      continue;
    }

    if (isValidPostgresUrl(value)) {
      return value;
    }

    console.error(`[Config Warning] ${envName} is set but not a valid Postgres URL. Ignoring this value.`);
  }

  return '';
}

const connectionString = resolveConnectionString();
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
  : null;

function ensureDirectory(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}

function copySourceFiles(destDir) {
  if (!fs.existsSync(SOURCE_DATA_DIR)) {
    return;
  }

  const sourceFiles = fs.readdirSync(SOURCE_DATA_DIR).filter(file => file.endsWith(ENCRYPTED_DATA_EXTENSION) || file.endsWith(LEGACY_DATA_EXTENSION));
  for (const file of sourceFiles) {
    const srcPath = path.join(SOURCE_DATA_DIR, file);
    const destPath = path.join(destDir, file);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function chooseDataDir() {
  const preferTemp = isVercelRuntime || process.env.NODE_ENV === 'production';

  if (preferTemp && !connectionString) {
    if (isVercelRuntime && !allowEphemeralStorage) {
      throw new Error(
        'Missing DATABASE_URL/NEON_DATABASE_URL on Vercel. ' +
        'Set a persistent Postgres database to avoid data loss on redeploys. ' +
        'Only for testing, set ALLOW_EPHEMERAL_STORAGE=1 to allow /tmp storage.'
      );
    }

    console.warn('[Persistence Warning] Running without DATABASE_URL/NEON_DATABASE_URL in production.');
    console.warn('[Persistence Warning] JSON files are stored in /tmp and can be reset on redeploy/cold starts.');
    console.warn('[Persistence Warning] Configure a persistent Postgres database for durable data.');
  }

  if (preferTemp && ensureDirectory(TEMP_DATA_DIR)) {
    copySourceFiles(TEMP_DATA_DIR);
    return TEMP_DATA_DIR;
  }

  if (ensureDirectory(SOURCE_DATA_DIR)) {
    return SOURCE_DATA_DIR;
  }

  if (ensureDirectory(TEMP_DATA_DIR)) {
    copySourceFiles(TEMP_DATA_DIR);
    return TEMP_DATA_DIR;
  }

  throw new Error(`Unable to initialize data storage. Tried directories: ${SOURCE_DATA_DIR} and ${TEMP_DATA_DIR}`);
}

const DATA_DIR = chooseDataDir();

function getEncryptedFilePath(filename) {
  return path.join(DATA_DIR, `${filename}${ENCRYPTED_DATA_EXTENSION}`);
}

function getLegacyFilePath(filename) {
  return path.join(DATA_DIR, `${filename}${LEGACY_DATA_EXTENSION}`);
}

function resolveExistingDataFilePath(filename) {
  const encryptedPath = getEncryptedFilePath(filename);
  if (fs.existsSync(encryptedPath)) {
    return encryptedPath;
  }

  const legacyPath = getLegacyFilePath(filename);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return encryptedPath;
}

function readJsonFileSync(filename) {
  const filePath = resolveExistingDataFilePath(filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const encrypted = fs.readFileSync(filePath, 'utf-8');
  return decryptData(encrypted, this.encryptionKey);
}

function writeJsonFileSync(filename, data) {
  const filePath = getEncryptedFilePath(filename);
  const encrypted = encryptData(data, this.encryptionKey);
  fs.writeFileSync(filePath, encrypted, 'utf-8');

  const legacyPath = getLegacyFilePath(filename);
  if (legacyPath !== filePath && fs.existsSync(legacyPath)) {
    fs.rmSync(legacyPath);
  }
}

class DatabaseManager {
  constructor(encryptionKey) {
    this.pool = pool;
    this.useNeon = !!this.pool;

    if (!this.useNeon) {
      if (!encryptionKey || typeof encryptionKey !== 'string') {
        throw new Error('Missing ENCRYPTION_KEY. Set ENCRYPTION_KEY in the environment.');
      }
      const keyBuffer = Buffer.from(encryptionKey, 'hex');
      if (keyBuffer.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 32-byte hex string.');
      }
    }

    this.encryptionKey = encryptionKey;
  }

  assertLocalStorageKey() {
    if (!this.encryptionKey || typeof this.encryptionKey !== 'string') {
      throw new Error('Missing ENCRYPTION_KEY. Set ENCRYPTION_KEY in the environment.');
    }
    const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hex string.');
    }
  }

  async query(text, params = []) {
    if (!this.pool) {
      throw new Error('No database connection configured');
    }
    return this.pool.query(text, params);
  }

  async ensureDefaultUsers() {
    const adminPassword = process.env.ADMIN_PASS || 'Admin123!';
    const userPassword = process.env.USER_PASS || 'User123!';
    const adminPasswordHash = process.env.ADMIN_PASS_HASH;
    const userPasswordHash = process.env.USER_PASS_HASH;

    const resolvePasswordHash = async (password, providedHash) => {
      if (providedHash && /^\$2[aby]\$\d{2}\$/.test(providedHash)) {
        return providedHash;
      }
      return hashPassword(password);
    };

    const desiredUsers = [
      {
        id: 'user-admin',
        email: 'admin@mwg.local',
        role: 'admin',
        password: adminPassword,
        passwordHash: await resolvePasswordHash(adminPassword, adminPasswordHash)
      },
      {
        id: 'user-default',
        email: 'user@mwg.local',
        role: 'user',
        password: userPassword,
        passwordHash: await resolvePasswordHash(userPassword, userPasswordHash)
      }
    ];

    if (this.useNeon) {
      const existing = await this.query(`SELECT id, role FROM users`);
      const existingRows = existing.rows;
      const roles = desiredUsers.map(user => user.role.toLowerCase());
      await this.query(`DELETE FROM users WHERE COALESCE(LOWER(role), '') NOT IN (${roles.map((_, index) => `$${index + 1}`).join(',')})`, roles);

      for (const desired of desiredUsers) {
        const existingUser = existingRows.find(row => row.role?.toLowerCase() === desired.role.toLowerCase());
        const passwordHash = desired.passwordHash;

        if (existingUser) {
          await this.query(`
            UPDATE users
            SET email = $1, role = $2, password_hash = $3, must_change_password = FALSE, updated_at = NOW()
            WHERE id = $4
          `, [desired.email, desired.role, passwordHash, existingUser.id]);
        } else {
          await this.query(`
            INSERT INTO users (id, email, role, password_hash, created_at, updated_at, must_change_password)
            VALUES ($1, $2, $3, $4, NOW(), NOW(), FALSE)
          `, [desired.id, desired.email, desired.role, passwordHash]);
        }
      }

      return;
    }

    const data = this.readFile('users');
    if (!data) {
      writeJsonFileSync.call(this, 'users', { users: [] });
    }

    const usersData = this.readFile('users') || { users: [] };
    const keptUsers = [];

    for (const desired of desiredUsers) {
      const existingUser = usersData.users.find(user => user.role?.toLowerCase() === desired.role.toLowerCase());
      const passwordHash = desired.passwordHash;

      if (existingUser) {
        keptUsers.push({
          id: existingUser.id || desired.id,
          email: desired.email,
          role: desired.role,
          passwordHash,
          createdAt: existingUser.createdAt || new Date().toISOString(),
          mustChangePassword: false,
          updatedAt: new Date().toISOString()
        });
      } else {
        keptUsers.push({
          id: desired.id,
          email: desired.email,
          role: desired.role,
          passwordHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mustChangePassword: false
        });
      }
    }

    usersData.users = keptUsers;
    this.writeFile('users', usersData);
  }

  async initializeDefaults() {
    try {
      if (this.useNeon) {
        try {
          await this.createTables();
        } catch (dbError) {
          if (isVercelRuntime && !allowEphemeralStorage) {
            throw new Error(
              `PostgreSQL initialization failed on Vercel: ${dbError?.message || 'unknown error'}. ` +
              'Fix DATABASE_URL/NEON_DATABASE_URL or set ALLOW_EPHEMERAL_STORAGE=1 only for temporary testing.'
            );
          }

          console.error('PostgreSQL initialization failed, falling back to local encrypted JSON storage:', {
            message: dbError?.message,
            hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL)
          });
          this.assertLocalStorageKey();
          this.useNeon = false;
          this.pool = null;
        }
      }

      if (!this.useNeon) {
        if (!readJsonFileSync.call(this, 'users')) {
          const users = { users: [] };
          writeJsonFileSync.call(this, 'users', users);
        }

        if (!readJsonFileSync.call(this, 'projects')) {
          writeJsonFileSync.call(this, 'projects', { projects: [] });
        }

        if (!readJsonFileSync.call(this, 'schedule')) {
          writeJsonFileSync.call(this, 'schedule', { slots: [] });
        }

        if (!readJsonFileSync.call(this, 'logs')) {
          writeJsonFileSync.call(this, 'logs', { logs: [] });
        }
      }

      await this.ensureDefaultUsers();
    } catch (error) {
      console.error('Error initializing database:', {
        message: error.message,
        useNeon: this.useNeon,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL)
      });
      throw error;
    }
  }

  async createTables() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        password_hash TEXT,
        email TEXT,
        role TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        must_change_password BOOLEAN DEFAULT FALSE
      )
    `);

    // Backward compatibility for older schemas that still enforce username.
    try {
      await this.query(`ALTER TABLE users ALTER COLUMN username DROP NOT NULL`);
    } catch (err) {
      // Column may not exist on new schemas; ignore.
    }

    await this.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        supervisors JSONB,
        presentation_type TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id TEXT PRIMARY KEY,
        time TEXT,
        duration INTEGER DEFAULT 30,
        project_id TEXT,
        order_num INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        action TEXT,
        user_id TEXT,
        details TEXT,
        timestamp TIMESTAMPTZ NOT NULL
      )
    `);
  }

  readFile(filename) {
    if (this.useNeon) {
      throw new Error('readFile is not supported when using Neon DB');
    }
    return readJsonFileSync.call(this, filename);
  }

  writeFile(filename, data) {
    if (this.useNeon) {
      throw new Error('writeFile is not supported when using Neon DB');
    }
    writeJsonFileSync.call(this, filename, data);
  }

  // ==================== USER OPERATIONS ====================

  async getAllUsers() {
    if (this.useNeon) {
      const result = await this.query(`SELECT id, email, role, created_at, updated_at, must_change_password FROM users`);
      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        mustChangePassword: row.must_change_password
      }));
    }

    const data = this.readFile('users');
    if (!data) return [];
    return data.users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      mustChangePassword: user.mustChangePassword
    }));
  }

  async getUserByRole(role) {
    if (this.useNeon) {
      const result = await this.query(`SELECT * FROM users WHERE LOWER(role) = LOWER($1)`, [role]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        passwordHash: row.password_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        mustChangePassword: row.must_change_password
      };
    }

    const data = this.readFile('users');
    if (!data) return null;
    return data.users.find(u => u.role?.toLowerCase() === role.toLowerCase()) || null;
  }

  async getUserById(id) {
    if (this.useNeon) {
      const result = await this.query(`SELECT id, email, role, created_at, updated_at, must_change_password FROM users WHERE id = $1`, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        mustChangePassword: row.must_change_password
      };
    }

    const data = this.readFile('users');
    if (!data) return null;
    const user = data.users.find(u => u.id === id);
    if (!user) return null;
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async createUser(userData) {
    if (this.useNeon) {
      const existing = await this.getUserByRole(userData.role || 'user');
      if (existing) {
        throw new Error('Rolle existiert bereits');
      }

      const passwordHash = await hashPassword(userData.tempPassword);
      const id = `user-${Date.now()}`;
      const now = new Date().toISOString();
      await this.query(`
        INSERT INTO users (id, email, role, password_hash, created_at, updated_at, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, userData.email, userData.role || 'user', passwordHash, now, now, true]);

      return {
        id,
        email: userData.email,
        role: userData.role || 'user',
        createdAt: now,
        updatedAt: now,
        mustChangePassword: true
      };
    }

    const data = this.readFile('users');
    if (data.users.some(u => (u.role || '').toLowerCase() === (userData.role || 'user').toLowerCase())) {
      throw new Error('Rolle existiert bereits');
    }

    const passwordHash = await hashPassword(userData.tempPassword);
    const newUser = {
      id: `user-${Date.now()}`,
      email: userData.email,
      role: userData.role || 'user',
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mustChangePassword: true
    };

    data.users.push(newUser);
    this.writeFile('users', data);

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async updateUser(userId, updateData) {
    if (this.useNeon) {
      const existing = await this.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      if (!existing.rows.length) {
        throw new Error('Benutzer nicht gefunden');
      }

      const user = existing.rows[0];
      const updates = {
        email: updateData.email ?? user.email,
        role: updateData.role ?? user.role,
        password_hash: user.password_hash,
        must_change_password: user.must_change_password,
        updated_at: new Date().toISOString()
      };

      if (updateData.password) {
        updates.password_hash = await hashPassword(updateData.password);
        updates.must_change_password = false;
      }

      await this.query(`
        UPDATE users SET email = $1, role = $2, password_hash = $3, must_change_password = $4, updated_at = $5
        WHERE id = $6
      `, [updates.email, updates.role, updates.password_hash, updates.must_change_password, updates.updated_at, userId]);

      return {
        id: user.id,
        email: updates.email,
        role: updates.role,
        createdAt: user.created_at,
        updatedAt: updates.updated_at,
        mustChangePassword: updates.must_change_password
      };
    }

    const data = this.readFile('users');
    const userIndex = data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('Benutzer nicht gefunden');
    }

    const user = data.users[userIndex];
    if (updateData.email) user.email = updateData.email;
    if (updateData.role) user.role = updateData.role;
    if (updateData.password) {
      user.passwordHash = await hashPassword(updateData.password);
      user.mustChangePassword = false;
    }
    user.updatedAt = new Date().toISOString();
    data.users[userIndex] = user;
    this.writeFile('users', data);

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId) {
    if (this.useNeon) {
      await this.query(`DELETE FROM users WHERE id = $1`, [userId]);
      return;
    }
    const data = this.readFile('users');
    data.users = data.users.filter(u => u.id !== userId);
    this.writeFile('users', data);
  }

  // ==================== PROJECT OPERATIONS ====================

  async getAllProjects() {
    if (this.useNeon) {
      const result = await this.query(`SELECT * FROM projects ORDER BY created_at ASC`);
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        supervisors: row.supervisors || [],
        presentationType: row.presentation_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
    const data = this.readFile('projects');
    return data?.projects || [];
  }

  async getProjectById(id) {
    if (this.useNeon) {
      const result = await this.query(`SELECT * FROM projects WHERE id = $1`, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        supervisors: row.supervisors || [],
        presentationType: row.presentation_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    const projects = await this.getAllProjects();
    return projects.find(p => p.id === id) || null;
  }

  async createProject(projectData) {
    if (this.useNeon) {
      const id = `proj-${Date.now()}`;
      const now = new Date().toISOString();
      await this.query(`
        INSERT INTO projects (id, name, description, supervisors, presentation_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, projectData.name, projectData.description, JSON.stringify(projectData.supervisors || []), projectData.presentationType || 'booth', now, now]);
      return {
        id,
        name: projectData.name,
        description: projectData.description,
        supervisors: projectData.supervisors || [],
        presentationType: projectData.presentationType || 'booth',
        createdAt: now,
        updatedAt: now
      };
    }

    const data = this.readFile('projects');
    const newProject = {
      id: `proj-${Date.now()}`,
      name: projectData.name,
      description: projectData.description,
      supervisors: projectData.supervisors || [],
      presentationType: projectData.presentationType || 'booth',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.projects.push(newProject);
    this.writeFile('projects', data);
    return newProject;
  }

  async updateProject(projectId, updateData) {
    if (this.useNeon) {
      const existing = await this.query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
      if (!existing.rows.length) {
        throw new Error('Projekt nicht gefunden');
      }
      const project = existing.rows[0];
      const updated = {
        name: updateData.name ?? project.name,
        description: updateData.description ?? project.description,
        supervisors: updateData.supervisors ?? project.supervisors,
        presentation_type: updateData.presentationType ?? project.presentation_type,
        updated_at: new Date().toISOString()
      };
      await this.query(`
        UPDATE projects SET name = $1, description = $2, supervisors = $3, presentation_type = $4, updated_at = $5
        WHERE id = $6
      `, [updated.name, updated.description, JSON.stringify(updated.supervisors), updated.presentation_type, updated.updated_at, projectId]);
      return {
        id: project.id,
        name: updated.name,
        description: updated.description,
        supervisors: updated.supervisors,
        presentationType: updated.presentation_type,
        createdAt: project.created_at,
        updatedAt: updated.updated_at
      };
    }
    const data = this.readFile('projects');
    const projectIndex = data.projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
      throw new Error('Projekt nicht gefunden');
    }
    const project = data.projects[projectIndex];
    Object.assign(project, {
      name: updateData.name || project.name,
      description: updateData.description || project.description,
      supervisors: updateData.supervisors || project.supervisors,
      presentationType: updateData.presentationType || project.presentationType,
      updatedAt: new Date().toISOString()
    });
    data.projects[projectIndex] = project;
    this.writeFile('projects', data);
    return project;
  }

  async deleteProject(projectId) {
    if (this.useNeon) {
      await this.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      return;
    }
    const data = this.readFile('projects');
    data.projects = data.projects.filter(p => p.id !== projectId);
    this.writeFile('projects', data);
  }

  // ==================== SCHEDULE OPERATIONS ====================

  async getAllScheduleSlots() {
    if (this.useNeon) {
      const result = await this.query(`SELECT * FROM schedule ORDER BY order_num ASC`);
      return result.rows.map(row => ({
        id: row.id,
        time: row.time,
        duration: row.duration,
        projectId: row.project_id,
        order: row.order_num,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
    const data = this.readFile('schedule');
    return data?.slots || [];
  }

  async createScheduleSlot(slotData) {
    if (this.useNeon) {
      const id = `slot-${Date.now()}`;
      const now = new Date().toISOString();
      const order = slotData.order ?? 0;
      await this.query(`
        INSERT INTO schedule (id, time, duration, project_id, order_num, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, slotData.time, slotData.duration || 30, slotData.projectId || null, order, now, now]);
      return {
        id,
        time: slotData.time,
        duration: slotData.duration || 30,
        projectId: slotData.projectId || null,
        order,
        createdAt: now,
        updatedAt: now
      };
    }
    const data = this.readFile('schedule');
    const newSlot = {
      id: `slot-${Date.now()}`,
      time: slotData.time,
      duration: slotData.duration || 30,
      projectId: slotData.projectId || null,
      order: (data.slots?.length || 0) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!data.slots) data.slots = [];
    data.slots.push(newSlot);
    this.writeFile('schedule', data);
    return newSlot;
  }

  async updateScheduleOrder(orderedSlots) {
    if (this.useNeon) {
      const updates = orderedSlots.map(slot => this.query(`UPDATE schedule SET order_num = $1, updated_at = NOW() WHERE id = $2`, [slot.order, slot.id]));
      await Promise.all(updates);
      return;
    }
    const data = this.readFile('schedule');
    orderedSlots.forEach(({ id, order }) => {
      const slot = data.slots.find(s => s.id === id);
      if (slot) {
        slot.order = order;
        slot.updatedAt = new Date().toISOString();
      }
    });
    this.writeFile('schedule', data);
  }

  async updateScheduleSlot(slotId, updateData) {
    if (this.useNeon) {
      const existing = await this.query(`SELECT * FROM schedule WHERE id = $1`, [slotId]);
      if (!existing.rows.length) {
        throw new Error('Zeitplan-Slot nicht gefunden');
      }
      const slot = existing.rows[0];
      const updated = {
        time: updateData.time ?? slot.time,
        duration: updateData.duration ?? slot.duration,
        project_id: updateData.projectId ?? slot.project_id,
        order_num: updateData.order ?? slot.order_num,
        updated_at: new Date().toISOString()
      };
      await this.query(`
        UPDATE schedule SET time = $1, duration = $2, project_id = $3, order_num = $4, updated_at = $5
        WHERE id = $6
      `, [updated.time, updated.duration, updated.project_id, updated.order_num, updated.updated_at, slotId]);
      return {
        id: slot.id,
        time: updated.time,
        duration: updated.duration,
        projectId: updated.project_id,
        order: updated.order_num,
        createdAt: slot.created_at,
        updatedAt: updated.updated_at
      };
    }
    const data = this.readFile('schedule');
    const slotIndex = data.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) {
      throw new Error('Zeitplan-Slot nicht gefunden');
    }
    const slot = data.slots[slotIndex];
    Object.assign(slot, updateData, { updatedAt: new Date().toISOString() });
    data.slots[slotIndex] = slot;
    this.writeFile('schedule', data);
    return slot;
  }

  async deleteScheduleSlot(slotId) {
    if (this.useNeon) {
      await this.query(`DELETE FROM schedule WHERE id = $1`, [slotId]);
      return;
    }
    const data = this.readFile('schedule');
    data.slots = data.slots.filter(s => s.id !== slotId);
    this.writeFile('schedule', data);
  }

  // ==================== LOGGING OPERATIONS ====================

  async getAllLogs() {
    if (this.useNeon) {
      const result = await this.query(`SELECT * FROM logs ORDER BY timestamp ASC`);
      return result.rows.map(row => ({
        id: row.id,
        action: row.action,
        userId: row.user_id,
        details: row.details,
        timestamp: row.timestamp
      }));
    }
    const data = this.readFile('logs');
    return data?.logs || [];
  }

  async addLog(logData) {
    if (this.useNeon) {
      const id = `log-${Date.now()}`;
      await this.query(`
        INSERT INTO logs (id, action, user_id, details, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, logData.action, logData.userId, logData.details || '', new Date().toISOString()]);
      return;
    }
    const data = this.readFile('logs');
    const logEntry = {
      id: `log-${Date.now()}`,
      action: logData.action,
      userId: logData.userId,
      details: logData.details || '',
      timestamp: new Date().toISOString()
    };
    if (!data.logs) data.logs = [];
    data.logs.push(logEntry);
    if (data.logs.length > 10000) {
      data.logs = data.logs.slice(-10000);
    }
    this.writeFile('logs', data);
  }
}

export default DatabaseManager;
