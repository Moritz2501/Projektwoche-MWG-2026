import session from 'express-session';

// Create a simple in-memory store with warning suppression for serverless
class SimpleSessionStore extends session.Store {
  constructor() {
    super();
    this.sessions = {};
    if (process.env.NODE_ENV === 'production') {
      console.warn('Using in-memory session store on Vercel. Sessions may be lost on redeployment.');
    }
  }

  get(sid, callback) {
    const sess = this.sessions[sid];
    if (sess) {
      callback(null, sess);
    } else {
      callback(null, null);
    }
  }

  set(sid, sess, callback) {
    this.sessions[sid] = sess;
    callback(null);
  }

  destroy(sid, callback) {
    delete this.sessions[sid];
    callback(null);
  }
}

export const sessionConfig = {
  store: process.env.NODE_ENV === 'production' 
    ? new SimpleSessionStore()
    : undefined,
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
