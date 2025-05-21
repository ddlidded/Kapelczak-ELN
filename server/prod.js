/**
 * Production server entry point for Kapelczak Notes
 * This file is used when running in production mode
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { registerRoutes } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Setup logging
app.use(morgan('common'));

// Register API routes
const server = await registerRoutes(app);

// Serve static files from the React app
const distPath = path.resolve(__dirname, "public");

if (!fs.existsSync(distPath)) {
  console.error(`Could not find the build directory: ${distPath}`);
  console.error('Make sure to build the client first with: npm run build');
  process.exit(1);
}

app.use(express.static(distPath));

// For any request that doesn't match an API route or static file, serve the React app
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV}`);
});