/**
 * Production server entry point.
 * This file is used when the application is started in production mode.
 */

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

// Import required modules
const path = require('path');
const express = require('express');
const fs = require('fs');

// Create the express application
const app = express();

// Middleware for JSON parsing
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Import database configuration
const { pool } = require('./db');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve upload files statically
app.use('/uploads', express.static(uploadsDir));

// Import and register API routes
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// Require routes and initialize them
require('./routes')(app, server)
  .then(() => {
    console.log('Routes initialized successfully');
  })
  .catch(err => {
    console.error('Failed to initialize routes:', err);
    process.exit(1);
  });

// Serve static files as fallback for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});