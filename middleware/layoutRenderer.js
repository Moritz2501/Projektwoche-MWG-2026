import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = path.join(__dirname, '../views');

/**
 * Custom render function that wraps views with layout
 * This function renders the requested view and then wraps it with layout.ejs
 */
export function setupLayoutRenderer(app) {
  // Store the original render function
  const originalRender = app.response.render;

  // Override the render function
  app.response.render = async function(view, options = {}, callback) {
    // If callback is provided, this is the old-style async render
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    try {
      // Render the view first
      const viewPath = path.join(viewsDir, `${view}.ejs`);
      const viewContent = await ejs.renderFile(viewPath, { ...options, user: this.req.user || options.user });

      // If user is authenticated, wrap with layout
      if (options.user || this.req.session?.user) {
        const user = options.user || this.req.session.user;
        const layoutPath = path.join(viewsDir, 'layout.ejs');
        const html = await ejs.renderFile(layoutPath, {
          ...options,
          user,
          body: viewContent
        });
        
        if (callback) {
          callback(null, html);
        } else {
          this.send(html);
        }
      } else {
        // No layout for unauthenticated views
        if (callback) {
          callback(null, viewContent);
        } else {
          this.send(viewContent);
        }
      }
    } catch (err) {
      if (callback) {
        callback(err);
      } else {
        throw err;
      }
    }
  };
}
