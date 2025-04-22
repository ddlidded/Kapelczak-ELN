#!/bin/bash
# Automated build script for Kapelczak Notes
# This script handles the build process for production deployment

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Kapelczak Notes Build Process  ${NC}"
echo -e "${BLUE}=================================${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js before proceeding.${NC}"
    exit 1
fi

# Display Node.js and npm versions
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${BLUE}Using Node.js ${NODE_VERSION} and npm ${NPM_VERSION}${NC}"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}Warning: .env.production file not found!${NC}"
    echo -e "${YELLOW}Creating a basic .env.production file...${NC}"
    
    # Create a basic .env.production file
    cat > .env.production << EOL
# Database Configuration
DATABASE_URL=postgresql://kapelczak_user:your_secure_password@localhost:5432/kapelczak_notes

# Application Configuration
PORT=5000
NODE_ENV=production

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=1073741824  # 1GB limit for file uploads

# Security Configuration
SESSION_SECRET=replace_with_secure_random_string_in_production

# SMTP Configuration (for email features)
SMTP_HOST=your-smtp-host.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
EOL
    
    echo -e "${GREEN}.env.production file created. Please update it with your actual configuration values.${NC}"
    echo -e "${YELLOW}Build process will continue, but the application may not work correctly without proper configuration.${NC}"
    echo ""
    echo -e "${YELLOW}Press Enter to continue or Ctrl+C to abort and edit the .env.production file...${NC}"
    read -r
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm ci
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies. Please check the error messages above.${NC}"
    exit 1
fi
echo -e "${GREEN}Dependencies installed successfully!${NC}"

# Build the application
echo -e "${BLUE}Building the application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed. Please check the error messages above.${NC}"
    exit 1
fi
echo -e "${GREEN}Application built successfully!${NC}"

# Create necessary directories
echo -e "${BLUE}Setting up directory structure...${NC}"
mkdir -p dist/uploads
mkdir -p dist/server/assets

# Copy static assets
echo -e "${BLUE}Copying assets...${NC}"
cp -r server/assets/* dist/server/assets/ 2>/dev/null || :
echo -e "${GREEN}Assets copied successfully!${NC}"

# Verify the build
if [ -f dist/index.js ]; then
    echo -e "${GREEN}Build verification passed!${NC}"
else
    echo -e "${RED}Build verification failed. The dist/index.js file was not created.${NC}"
    exit 1
fi

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Build completed successfully!  ${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "${BLUE}You can now deploy the application using:${NC}"
echo -e "${YELLOW}1. Nixpacks deployment: ./railway-deploy.sh${NC}"
echo -e "${YELLOW}2. Manual deployment: NODE_ENV=production node dist/index.js${NC}"