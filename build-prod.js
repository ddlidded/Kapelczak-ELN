const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Set colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n');
  log(`${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`);
}

function createDirectories() {
  log('Creating dist and public directories...', colors.yellow);
  
  // Create dist directory if it doesn't exist
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }
  
  // Create dist/public directory if it doesn't exist
  if (!fs.existsSync('dist/public')) {
    fs.mkdirSync('dist/public', { recursive: true });
  }
}

// Create a production-compatible entrypoint
function createProductionEntrypoint() {
  logSection('Creating production entrypoint');
  log('Creating production-ready server entry point...', colors.yellow);
  
  const prodServerContent = `
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
  console.error(\`Could not find the build directory: \${distPath}\`);
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
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`⚡ Environment: \${process.env.NODE_ENV}\`);
});`;

  fs.writeFileSync('dist/index.js', prodServerContent);
  log('Production entrypoint created successfully', colors.green);
}

async function build() {
  try {
    logSection('Building Kapelczak Notes for Production');
    log('Starting build process...', colors.yellow);
    
    // Create directories
    createDirectories();
    
    // Build client with Vite
    logSection('Building client');
    log('Building client with Vite...', colors.yellow);
    execSync('npm run build:client', { stdio: 'inherit' });
    log('Client build completed', colors.green);
    
    // Build server
    logSection('Building server');
    log('Building server...', colors.yellow);
    execSync('npm run build:server', { stdio: 'inherit' });
    log('Server build completed', colors.green);
    
    // Create production entrypoint
    createProductionEntrypoint();
    
    // Create a package.json for production with type: module
    logSection('Creating production package.json');
    log('Adding type: module to package.json for ESM compatibility...', colors.yellow);
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      type: "module",
      engines: packageJson.engines || { "node": ">=16.0.0" },
      dependencies: packageJson.dependencies
    };
    
    fs.writeFileSync('dist/package.json', JSON.stringify(prodPackageJson, null, 2));
    log('Production package.json created', colors.green);
    
    // Copy other necessary files
    logSection('Copying additional files');
    log('Copying drizzle.config.ts...', colors.yellow);
    fs.copyFileSync('drizzle.config.ts', 'dist/drizzle.config.ts');
    
    // Create drizzle.config.json for production
    log('Creating drizzle.config.json...', colors.yellow);
    const drizzleConfig = {
      out: "./migrations",
      schema: "./shared/schema.ts",
      dialect: "postgresql",
      dbCredentials: {
        url: "DATABASE_URL_PLACEHOLDER" // Will be replaced at runtime
      }
    };
    fs.writeFileSync('dist/drizzle.config.json', JSON.stringify(drizzleConfig, null, 2));
    
    // Success message
    logSection('Build Complete');
    log('✅ Kapelczak Notes has been built successfully for production!', colors.green);
    log('The production build is available in the dist/ directory', colors.white);
    
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run the build process
build();