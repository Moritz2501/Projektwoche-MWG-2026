/**
 * Session Handler Middleware
 * Configures secure session settings
 */

export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secure-random-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

/**
 * Middleware to clear session on logout
 */
export function clearSession(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout fehlgeschlagen' });
    }
    res.clearCookie('connect.sid');
    next();
  });
}
