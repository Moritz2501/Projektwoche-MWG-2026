import { app, initializeAdmin } from '../server.js';

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await initializeAdmin();
    initialized = true;
  }
}

export default async function handler(req, res) {
  try {
    await ensureInit();
    return app(req, res);
  } catch (err) {
    console.error('Vercel handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
