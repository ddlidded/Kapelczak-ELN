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

// Enable request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware for JSON parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import database configuration
const { pool } = require('./db');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve upload files statically
app.use('/uploads', express.static(uploadsDir));

// Set up port and start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Initialize API routes first
console.log('Initializing API routes...');
require('./routes')(app, server)
  .then(() => {
    console.log('API routes initialized successfully');
    
    // After API routes are initialized, set up the static file serving
    console.log('Setting up static file serving...');
    
    // Check which dist directory structure exists
    const distDir = fs.existsSync(path.join(__dirname, '../dist/public')) 
      ? path.join(__dirname, '../dist/public') 
      : path.join(__dirname, '../dist');
    
    console.log(`Using static files from: ${distDir}`);
    
    // Serve static files from the detected dist directory
    app.use(express.static(distDir, {
      maxAge: '1d', // Cache static assets for 1 day
    }));
    
    // Serve static files as fallback for client-side routing
    // This must be the last middleware
    app.get('*', (req, res) => {
      console.log(`Serving index.html for path: ${req.path}`);
      const indexPath = fs.existsSync(path.join(distDir, 'index.html'))
        ? path.join(distDir, 'index.html')
        : path.join(__dirname, '../dist/index.html');
      
      console.log(`Using index.html from: ${indexPath}`);
      res.sendFile(indexPath);
    });
    
    console.log('Static file serving configured');
    
    // Add global error handler - must be after all routes and middleware
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred' 
          : err.message
      });
    });
    
    console.log('Error handler configured');
  })
  .catch(err => {
    console.error('Failed to initialize routes:', err);
    process.exit(1);
  });