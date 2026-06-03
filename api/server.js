import serverless from 'serverless-http';
import { app, initializeAdmin } from '../server.js';

let initialized = false;
const handler = serverless(app);

async function ensureInit() {
  if (!initialized) {
    try {
      await initializeAdmin();
      initialized = true;
    } catch (err) {
      console.error('Initialization error in serverless wrapper:', err);
    }
  }
}

export default async function (req, res) {
  await ensureInit();
  return handler(req, res);
}
