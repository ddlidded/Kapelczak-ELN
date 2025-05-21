/**
 * Production server entry point for Kapelczak Notes
 * This file is specifically designed for ESM environments
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema.js';

// Get current file and directory info for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Basic logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${req.method} ${req.url}`);
  next();
});

// Check database connection
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set!');
  console.error('Please set this environment variable and restart the application');
  process.exit(1);
}

// Setup database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Setup API routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Import routes dynamically
try {
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app, httpServer);
  console.log('✅ API routes registered successfully');
} catch (error) {
  console.error('❌ Failed to register API routes:', error);
  process.exit(1);
}

// Serve static files from the React app
const distPath = path.resolve(__dirname, "../dist/public");

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
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV}`);
});