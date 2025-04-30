#!/bin/bash
# Standalone script to create the admin user for Kapelczak Notes
# This script handles both ESM and CommonJS module systems

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to handle errors
function handle_error() {
  echo -e "\n${RED}ERROR: $1${NC}"
  exit 1
}

# Function to display section headers
function section_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  # Check if .env.production exists and source it
  if [ -f .env.production ]; then
    echo -e "${YELLOW}Loading DATABASE_URL from .env.production file...${NC}"
    export $(grep -v '^#' .env.production | grep DATABASE_URL)
  fi
  
  # If still not set, prompt for it
  if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}DATABASE_URL environment variable not found.${NC}"
    echo -e "${YELLOW}Please enter your PostgreSQL connection string:${NC}"
    echo -e "${YELLOW}(format: postgresql://username:password@hostname:port/database)${NC}"
    read -r DATABASE_URL
    export DATABASE_URL
  fi
fi

# Verify DATABASE_URL format
if [[ ! "$DATABASE_URL" =~ ^postgresql://.*$ ]]; then
  handle_error "Invalid DATABASE_URL format. Expected: postgresql://username:password@hostname:port/database"
fi

section_header "Creating admin user"

# Check if package.json has type: module
if grep -q '"type": "module"' package.json; then
  echo -e "${YELLOW}Detected ESM project (type: module in package.json)${NC}"
  
  # Try ESM version first
  if [ -f server/scripts/create-admin.js ]; then
    echo -e "${YELLOW}Trying ESM module version...${NC}"
    NODE_OPTIONS="--experimental-specifier-resolution=node" node server/scripts/create-admin.js || {
      echo -e "${YELLOW}ESM module import failed, trying CommonJS version...${NC}"
      # Try CommonJS version as fallback
      if [ -f server/scripts/create-admin.cjs ]; then
        node server/scripts/create-admin.cjs || handle_error "Failed to create admin user with both ESM and CommonJS scripts"
      else
        handle_error "Failed to create admin user and CommonJS script not found"
      fi
    }
  elif [ -f server/scripts/create-admin.cjs ]; then
    # If ESM script not found, try CommonJS version
    echo -e "${YELLOW}ESM script not found, trying CommonJS version...${NC}"
    node server/scripts/create-admin.cjs || handle_error "Failed to create admin user"
  else
    handle_error "Admin user creation script not found in server/scripts/"
  fi
else
  echo -e "${YELLOW}Detected CommonJS project${NC}"
  # For CommonJS projects
  if [ -f server/scripts/create-admin.cjs ]; then
    echo -e "${YELLOW}Using CommonJS script...${NC}"
    node server/scripts/create-admin.cjs || handle_error "Failed to create admin user"
  elif [ -f server/scripts/create-admin.js ]; then
    echo -e "${YELLOW}Using .js script in CommonJS mode...${NC}"
    node server/scripts/create-admin.js || handle_error "Failed to create admin user"
  else
    handle_error "Admin user creation script not found in server/scripts/"
  fi
fi

echo -e "${GREEN}✓ Admin user setup complete${NC}"
echo -e "${YELLOW}Default admin credentials:${NC}"
echo -e "  Username: admin"
echo -e "  Password: demo"
echo -e "${RED}IMPORTANT: Change the default admin password immediately after first login!${NC}"