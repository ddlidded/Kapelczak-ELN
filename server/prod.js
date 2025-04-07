/**
 * Production server entry point.
 * This file is used when the application is started in production mode.
 */

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

// Import required modules
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { registerRoutes } from './routes.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the express application
const app = express();

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Register API routes
registerRoutes(app)
  .then(server => {
    console.log(`Server started on port ${process.env.PORT || 5000}`);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

// Serve static files as fallback for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});