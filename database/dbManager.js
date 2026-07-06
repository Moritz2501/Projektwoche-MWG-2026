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
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';
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

  const sourceFiles = fs.readdirSync(SOURCE_DATA_DIR).filter(file => file.endsWith('.json'));
  for (const file of sourceFiles) {
    const srcPath = path.join(SOURCE_DATA_DIR, file);
    const destPath = path.join(destDir, file);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function chooseDataDir() {
  const preferTemp = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

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

function readJsonFileSync(filename) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const encrypted = fs.readFileSync(filePath, 'utf-8');
  return decryptData(encrypted, this.encryptionKey);
}

function writeJsonFileSync(filename, data) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  const encrypted = encryptData(data, this.encryptionKey);
  fs.writeFileSync(filePath, encrypted, 'utf-8');
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

  async query(text, params = []) {
    if (!this.pool) {
      throw new Error('No database connection configured');
    }
    return this.pool.query(text, params);
  }

  async ensureDefaultUsers() {
    const adminUsername = process.env.ADMIN_USER || 'admin';
    const userUsername = process.env.USER_USER || 'user';
    const adminPassword = process.env.ADMIN_PASS || 'Admin123!';
    const userPassword = process.env.USER_PASS || 'User123!';
    const desiredUsers = [
      { username: adminUsername, email: 'admin@mwg.local', role: 'admin', password: adminPassword },
      { username: userUsername, email: 'user@mwg.local', role: 'user', password: userPassword }
    ];

    if (this.useNeon) {
      const existing = await this.query(`SELECT id, username FROM users`);
      const existingRows = existing.rows;
      const usernames = desiredUsers.map(user => user.username.toLowerCase());
      await this.query(`DELETE FROM users WHERE LOWER(username) NOT IN (${usernames.map((_, index) => `$${index + 1}`).join(',')})`, usernames);

      for (const desired of desiredUsers) {
        const existingUser = existingRows.find(row => row.username?.toLowerCase() === desired.username.toLowerCase());
        const passwordHash = await hashPassword(desired.password);

        if (existingUser) {
          await this.query(`
            UPDATE users
            SET email = $1, role = $2, password_hash = $3, must_change_password = FALSE, updated_at = NOW()
            WHERE id = $4
          `, [desired.email, desired.role, passwordHash, existingUser.id]);
        } else {
          const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await this.query(`
            INSERT INTO users (id, username, email, role, password_hash, created_at, updated_at, must_change_password)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), FALSE)
          `, [id, desired.username, desired.email, desired.role, passwordHash]);
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
      const existingUser = usersData.users.find(user => user.username.toLowerCase() === desired.username.toLowerCase());
      const passwordHash = await hashPassword(desired.password);

      if (existingUser) {
        keptUsers.push({
          ...existingUser,
          email: desired.email,
          role: desired.role,
          passwordHash,
          mustChangePassword: false,
          updatedAt: new Date().toISOString()
        });
      } else {
        keptUsers.push({
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          username: desired.username,
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
    if (this.useNeon) {
      await this.createTables();
    }

    try {
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

      await this.ensureDefaultUsers();
    } catch (error) {
      console.error('Error initializing database:', error.message);
    }
  }

  async createTables() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        email TEXT,
        role TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        must_change_password BOOLEAN DEFAULT FALSE
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        supervisors JSONB,
        member_count INTEGER DEFAULT 0,
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
      const result = await this.query(`SELECT id, username, email, role, created_at, updated_at, must_change_password FROM users`);
      return result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        mustChangePassword: row.must_change_password
      }));
    }

    const data = this.readFile('users');
    if (!data) return [];
    return data.users.map(u => ({ ...u, passwordHash: undefined }));
  }

  async getUserByUsername(username) {
    if (this.useNeon) {
      const result = await this.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        username: row.username,
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
    return data.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async getUserById(id) {
    if (this.useNeon) {
      const result = await this.query(`SELECT id, username, email, role, created_at, updated_at, must_change_password FROM users WHERE id = $1`, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        username: row.username,
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
      const existing = await this.getUserByUsername(userData.username);
      if (existing) {
        throw new Error('Benutzer existiert bereits');
      }

      const passwordHash = await hashPassword(userData.tempPassword);
      const id = `user-${Date.now()}`;
      const now = new Date().toISOString();
      await this.query(`
        INSERT INTO users (id, username, email, role, password_hash, created_at, updated_at, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, userData.username, userData.email, userData.role || 'user', passwordHash, now, now, true]);

      return {
        id,
        username: userData.username,
        email: userData.email,
        role: userData.role || 'user',
        createdAt: now,
        updatedAt: now,
        mustChangePassword: true
      };
    }

    const data = this.readFile('users');
    if (data.users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      throw new Error('Benutzer existiert bereits');
    }

    const passwordHash = await hashPassword(userData.tempPassword);
    const newUser = {
      id: `user-${Date.now()}`,
      username: userData.username,
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
        username: user.username,
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
        memberCount: row.member_count,
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
        memberCount: row.member_count,
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
        INSERT INTO projects (id, name, description, supervisors, member_count, presentation_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, projectData.name, projectData.description, JSON.stringify(projectData.supervisors || []), projectData.memberCount || 0, projectData.presentationType || 'booth', now, now]);
      return {
        id,
        name: projectData.name,
        description: projectData.description,
        supervisors: projectData.supervisors || [],
        memberCount: projectData.memberCount || 0,
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
      memberCount: projectData.memberCount || 0,
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
        member_count: updateData.memberCount ?? project.member_count,
        presentation_type: updateData.presentationType ?? project.presentation_type,
        updated_at: new Date().toISOString()
      };
      await this.query(`
        UPDATE projects SET name = $1, description = $2, supervisors = $3, member_count = $4, presentation_type = $5, updated_at = $6
        WHERE id = $7
      `, [updated.name, updated.description, JSON.stringify(updated.supervisors), updated.member_count, updated.presentation_type, updated.updated_at, projectId]);
      return {
        id: project.id,
        name: updated.name,
        description: updated.description,
        supervisors: updated.supervisors,
        memberCount: updated.member_count,
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
      memberCount: updateData.memberCount || project.memberCount,
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
