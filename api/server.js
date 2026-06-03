import serverless from 'serverless-http';
import { app, initializeAdmin } from '../server.js';

let initialized = false;

// Initialize once on cold start
async function ensureInit() {
  if (!initialized) {
    try {
      await initializeAdmin();
      initialized = true;
    } catch (err) {
      console.error('Failed to initialize:', err);
      throw err;
    }
  }
}

// Initialize on import
await ensureInit();

// Wrap Express app for Vercel
export default serverless(app);
