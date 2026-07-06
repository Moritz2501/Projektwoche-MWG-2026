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
  await ensureInitialized();
  return app(req, res);
}
