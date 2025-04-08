#!/bin/bash
set -e

# Production deployment script for Kapelczak Notes
echo "Starting deployment process for Kapelczak Notes..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm."
    exit 1
fi

# Install global dependencies
echo "Installing global dependencies..."
npm install -g tsx vite

# Install project dependencies
echo "Installing project dependencies..."
npm ci

# Build the frontend with Vite
echo "Building frontend with Vite..."
npx vite build

# Create directories
echo "Ensuring uploads directory exists..."
mkdir -p uploads

# Set environment variables if not present
if [ ! -f .env.production ]; then
    echo "Creating default .env.production..."
    cat > .env.production << EOF
# Database Configuration
DATABASE_URL=postgresql://kapelczak_user:your_secure_password@localhost:5432/kapelczak_notes

# Application Configuration
PORT=5000
NODE_ENV=production

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF
    echo "Please update .env.production with your database credentials."
fi

# Setup the database schema
echo "Pushing database schema..."
npx drizzle-kit push

# Start the server using the production script
echo "Starting server..."
NODE_ENV=production node server/prod.js