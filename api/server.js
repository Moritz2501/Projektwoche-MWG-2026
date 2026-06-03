import serverless from 'serverless-http';
import { app, initializeAdmin } from '../server.js';

let initialized = false;
let initPromise = null;

// Initialize once with timeout protection
async function ensureInit() {
  if (initialized) {
    return; // Already done
  }

  if (initPromise) {
    return await Promise.race([
      initPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Init timeout')), 5000)
      )
    ]);
  }

  initPromise = initializeAdmin();
  
  try {
    await Promise.race([
      initPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Init timeout')), 5000)
      )
    ]);
    initialized = true;
  } catch (err) {
    console.error('Initialization error:', err.message);
    // Don't throw - allow app to continue
  }
}

// Create wrapped handler that initializes on first request
export default async (req, res) => {
  try {
    await ensureInit();
    return serverless(app)(req, res);
  } catch (err) {
    console.error('Handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
