/**
 * Production build script for Kapelczak Notes
 * This script builds both the client and server for production deployment
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for better console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m"
};

// Helper function to log messages with colors
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.blue + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
  console.log(colors.bright + colors.cyan + ' ' + title + colors.reset);
  console.log(colors.bright + colors.blue + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset + '\n');
}

// Create necessary directories
function createDirectories() {
  const dirs = ['dist', 'logs', 'uploads'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log(`Created directory: ${dir}`, colors.green);
    }
  });
}

// Main build process
async function build() {
  try {
    logSection('Starting Production Build Process');
    
    // Create necessary directories
    log('Creating necessary directories...', colors.cyan);
    createDirectories();
    
    // Build frontend
    logSection('Building Frontend (React + Vite)');
    log('Running Vite build...', colors.yellow);
    execSync('npx vite build', { stdio: 'inherit' });
    log('Frontend build complete', colors.green);
    
    // Build backend
    logSection('Building Backend (Node.js)');
    log('Transpiling TypeScript to JavaScript...', colors.yellow);
    
    // Use tsc to compile TypeScript files
    execSync('npx tsc --project tsconfig.json', { stdio: 'inherit' });
    
    // Ensure CommonJS files are copied over
    log('Copying existing JS files...', colors.yellow);
    execSync('cp -R server/*.js dist/server/', { stdio: 'inherit' });
    
    log('Backend build complete', colors.green);
    
    logSection('Build Process Complete');
    log('The application has been built for production.', colors.bright);
    log('Run in production using: NODE_ENV=production node server/prod.js', colors.dim);
    
  } catch (error) {
    log('Build failed with error:', colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the build process
build();
