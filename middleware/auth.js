/**
 * Authentication Middleware
 * Handles session validation and user authentication
 */

export function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

export function isNotAuthenticated(req, res, next) {
  if (!req.session || !req.session.user) {
    return next();
  }
  res.redirect('/dashboard');
}

export function attachUser(req, res, next) {
  res.locals.user = req.session?.user || null;
  res.locals.isAuthenticated = !!req.session?.user;
  next();
}
