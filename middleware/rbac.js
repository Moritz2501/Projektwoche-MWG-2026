/**
 * Role-Based Access Control (RBAC) Middleware
 * Defines permissions for different user roles
 */

const rolePermissions = {
  admin: [
    'admin:create_user',
    'admin:edit_user',
    'admin:delete_user',
    'admin:view_logs',
    'projects:create',
    'projects:edit',
    'projects:delete',
    'schedule:create',
    'schedule:edit',
    'schedule:delete',
    'map:edit',
    'kanban:create',
    'kanban:edit',
    'kanban:delete'
  ],
  'projekt-verwaltung': [
    'projects:create',
    'projects:edit',
    'projects:delete',
    'projects:read',
    'schedule:read',
    'schedule:create',
    'schedule:edit',
    'kanban:create',
    'kanban:edit'
  ],
  'bühnentechnik': [
    'schedule:read',
    'schedule:create',
    'schedule:edit',
    'map:read',
    'kanban:create',
    'kanban:edit'
  ],
  user: [
    'projects:read',
    'schedule:read',
    'map:read',
    'kanban:create',
    'kanban:read'
  ]
};

/**
 * Middleware factory to require specific roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} Middleware function
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const userRole = req.session.user.role.toLowerCase();
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    next();
  };
}

/**
 * Middleware to check specific permissions
 * @param {...string} permissions - Required permissions
 * @returns {Function} Middleware function
 */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const userRole = req.session.user.role.toLowerCase();
    const userPermissions = rolePermissions[userRole] || [];

    const hasPermission = permissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Unzureichende Berechtigung' });
    }

    next();
  };
}

/**
 * Get permissions for a specific role
 * @param {string} role - User role
 * @returns {Array<string>} Array of permissions
 */
export function getRolePermissions(role) {
  return rolePermissions[role.toLowerCase()] || [];
}

/**
 * Check if user has specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export function hasPermission(role, permission) {
  const permissions = rolePermissions[role.toLowerCase()] || [];
  return permissions.includes(permission);
}

export const ROLES = {
  ADMIN: 'admin',
  PROJEKT_VERWALTUNG: 'projekt-verwaltung',
  BÜHNENTECHNIK: 'bühnentechnik',
  USER: 'user'
};
