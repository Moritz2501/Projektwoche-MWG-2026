import { app, initializeAdmin } from '../server.js';

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    try {
      await initializeAdmin();
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize app on Vercel cold start:', error);
      throw error;
    }
  }
}

export default async function handler(req, res) {
  try {
    await ensureInitialized();
    return app(req, res);
  } catch (error) {
    console.error('Fatal request handling error:', {
      message: error?.message,
      stack: error?.stack,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL),
      environment: process.env.NODE_ENV,
      vercel: process.env.VERCEL
    });

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Server-Initialisierung fehlgeschlagen',
        hint: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL
          ? 'Pruefe DATABASE_URL/NEON_DATABASE_URL und DB-Erreichbarkeit.'
          : 'Setze NEON_DATABASE_URL oder DATABASE_URL in Vercel Environment Variables.'
      });
    }
  }
}
