import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encryptData, decryptData } from '../utils/encryption.js';
import { hashPassword, comparePassword } from '../utils/passwordHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Database Manager for encrypted JSON storage
 */
class DatabaseManager {
  constructor(encryptionKey) {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Read encrypted JSON file
   * @param {string} filename - Filename (without extension)
   * @returns {Object} Decrypted data
   */
  readFile(filename) {
    try {
      const filePath = path.join(DATA_DIR, `${filename}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const encrypted = fs.readFileSync(filePath, 'utf-8');
      return decryptData(encrypted, this.encryptionKey);
    } catch (error) {
      console.error(`Error reading ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Write encrypted JSON file
   * @param {string} filename - Filename (without extension)
   * @param {Object} data - Data to encrypt and write
   */
  writeFile(filename, data) {
    try {
      const filePath = path.join(DATA_DIR, `${filename}.json`);
      const encrypted = encryptData(data, this.encryptionKey);
      fs.writeFileSync(filePath, encrypted, 'utf-8');
    } catch (error) {
      console.error(`Error writing ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Initialize default data structure
   */
  initializeDefaults() {
    try {
      // Initialize users
      if (!this.readFile('users')) {
        const users = {
          users: [
            {
              id: 'admin-001',
              username: process.env.ADMIN_USER || 'admin',
              passwordHash: null, // Will be set during startup
              email: 'admin@mwg.local',
              role: 'admin',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        };
        this.writeFile('users', users);
      }

      // Initialize projects
      if (!this.readFile('projects')) {
        this.writeFile('projects', { projects: [] });
      }

      // Initialize schedule
      if (!this.readFile('schedule')) {
        this.writeFile('schedule', { slots: [] });
      }

      // Initialize map/grounds
      if (!this.readFile('grounds')) {
        this.writeFile('grounds', {
          booths: [],
          stage: null
        });
      }

      // Initialize kanban tasks
      if (!this.readFile('kanban')) {
        this.writeFile('kanban', {
          tasks: []
        });
      }

      // Initialize logs
      if (!this.readFile('logs')) {
        this.writeFile('logs', { logs: [] });
      }
    } catch (error) {
      console.error('Error initializing database:', error.message);
    }
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Get all users
   * @returns {Array} Array of users (without password hashes)
   */
  getAllUsers() {
    const data = this.readFile('users');
    if (!data) return [];
    
    return data.users.map(u => ({
      ...u,
      passwordHash: undefined
    }));
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Object|null} User object
   */
  getUserByUsername(username) {
    const data = this.readFile('users');
    if (!data) return null;
    
    return data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Object|null} User object
   */
  getUserById(id) {
    const data = this.readFile('users');
    if (!data) return null;
    
    const user = data.users.find(u => u.id === id);
    if (user) {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  }

  /**
   * Create new user
   * @param {Object} userData - User data {username, email, role, tempPassword}
   * @returns {Object} Created user
   */
  async createUser(userData) {
    const data = this.readFile('users');
    
    // Check if username exists
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
    
    return {
      ...newUser,
      passwordHash: undefined
    };
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user
   */
  async updateUser(userId, updateData) {
    const data = this.readFile('users');
    const userIndex = data.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error('Benutzer nicht gefunden');
    }

    const user = data.users[userIndex];
    
    // Update fields
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

  /**
   * Delete user
   * @param {string} userId - User ID
   */
  deleteUser(userId) {
    const data = this.readFile('users');
    data.users = data.users.filter(u => u.id !== userId);
    this.writeFile('users', data);
  }

  // ==================== PROJECT OPERATIONS ====================

  /**
   * Get all projects
   * @returns {Array} Array of projects
   */
  getAllProjects() {
    const data = this.readFile('projects');
    return data?.projects || [];
  }

  /**
   * Get project by ID
   * @param {string} id - Project ID
   * @returns {Object|null} Project object
   */
  getProjectById(id) {
    const projects = this.getAllProjects();
    return projects.find(p => p.id === id) || null;
  }

  /**
   * Create project
   * @param {Object} projectData - Project data
   * @returns {Object} Created project
   */
  createProject(projectData) {
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

  /**
   * Update project
   * @param {string} projectId - Project ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated project
   */
  updateProject(projectId, updateData) {
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

  /**
   * Delete project
   * @param {string} projectId - Project ID
   */
  deleteProject(projectId) {
    const data = this.readFile('projects');
    data.projects = data.projects.filter(p => p.id !== projectId);
    this.writeFile('projects', data);
  }

  // ==================== SCHEDULE OPERATIONS ====================

  /**
   * Get all schedule slots
   * @returns {Array} Array of schedule slots
   */
  getAllScheduleSlots() {
    const data = this.readFile('schedule');
    return data?.slots || [];
  }

  /**
   * Create schedule slot
   * @param {Object} slotData - Slot data
   * @returns {Object} Created slot
   */
  createScheduleSlot(slotData) {
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

  /**
   * Update schedule slot order
   * @param {Array} orderedSlots - Array of {id, order} objects
   */
  updateScheduleOrder(orderedSlots) {
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

  /**
   * Update schedule slot
   * @param {string} slotId - Slot ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated slot
   */
  updateScheduleSlot(slotId, updateData) {
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

  /**
   * Delete schedule slot
   * @param {string} slotId - Slot ID
   */
  deleteScheduleSlot(slotId) {
    const data = this.readFile('schedule');
    data.slots = data.slots.filter(s => s.id !== slotId);
    this.writeFile('schedule', data);
  }

  // ==================== GROUNDS OPERATIONS ====================

  /**
   * Get grounds layout (booths and stage)
   * @returns {Object} Grounds data
   */
  getGrounds() {
    const data = this.readFile('grounds');
    return data || { booths: [], stage: null };
  }

  /**
   * Update grounds layout
   * @param {Array} booths - Array of booth positions/sizes
   * @param {Object} stage - Stage position/size
   */
  updateGrounds(booths, stage) {
    const data = {
      booths: booths || [],
      stage: stage || null,
      updatedAt: new Date().toISOString()
    };
    this.writeFile('grounds', data);
  }

  // ==================== KANBAN OPERATIONS ====================

  /**
   * Get all kanban tasks
   * @returns {Array} Array of tasks
   */
  getAllTasks() {
    const data = this.readFile('kanban');
    return data?.tasks || [];
  }

  /**
   * Create kanban task
   * @param {Object} taskData - Task data {title, description, column}
   * @returns {Object} Created task
   */
  createTask(taskData) {
    const data = this.readFile('kanban');
    
    const newTask = {
      id: `task-${Date.now()}`,
      title: taskData.title,
      description: taskData.description || '',
      column: taskData.column || 'todo', // todo, inprogress, done
      order: (data.tasks?.length || 0) + 1,
      createdAt: new Date().toISOString(),
      createdBy: taskData.createdBy,
      updatedAt: new Date().toISOString()
    };

    if (!data.tasks) data.tasks = [];
    data.tasks.push(newTask);
    this.writeFile('kanban', data);
    
    return newTask;
  }

  /**
   * Update task
   * @param {string} taskId - Task ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated task
   */
  updateTask(taskId, updateData) {
    const data = this.readFile('kanban');
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task nicht gefunden');
    }

    const task = data.tasks[taskIndex];
    Object.assign(task, updateData, { updatedAt: new Date().toISOString() });
    data.tasks[taskIndex] = task;

    this.writeFile('kanban', data);
    return task;
  }

  /**
   * Delete task
   * @param {string} taskId - Task ID
   */
  deleteTask(taskId) {
    const data = this.readFile('kanban');
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    this.writeFile('kanban', data);
  }

  // ==================== LOGGING OPERATIONS ====================

  /**
   * Get all logs
   * @returns {Array} Array of log entries
   */
  getAllLogs() {
    const data = this.readFile('logs');
    return data?.logs || [];
  }

  /**
   * Add log entry
   * @param {Object} logData - Log data {action, userId, details}
   */
  addLog(logData) {
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
    
    // Keep only last 10000 logs
    if (data.logs.length > 10000) {
      data.logs = data.logs.slice(-10000);
    }

    this.writeFile('logs', data);
  }
}

export default DatabaseManager;
