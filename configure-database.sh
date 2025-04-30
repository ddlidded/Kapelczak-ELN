#!/bin/bash
# PostgreSQL configuration script for Kapelczak Notes
# Use this script to set up the database without full deployment

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default database settings
DB_USER="kapelczak_user"
DB_PASSWORD=$(openssl rand -hex 12) # Generate secure random password
DB_NAME="kapelczak_notes"
DB_PORT=5432
DB_HOST="localhost"

# Function to display section headers
function section_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to handle errors
function handle_error() {
  echo -e "\n${RED}ERROR: $1${NC}"
  exit 1
}

# Display welcome banner
echo -e "${PURPLE}===============================================${NC}"
echo -e "${PURPLE}    KAPELCZAK NOTES DATABASE CONFIGURATION    ${NC}"
echo -e "${PURPLE}===============================================${NC}"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  handle_error "This script must be run as root to configure PostgreSQL."
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
  handle_error "PostgreSQL is not installed. Please run the full deploy.sh script instead."
fi

# Ensure PostgreSQL is running
section_header "Checking PostgreSQL service"
systemctl is-active --quiet postgresql || systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}✓ PostgreSQL service is running${NC}"

# Interactive or automatic configuration
section_header "Database Configuration"
echo -e "${YELLOW}Do you want to use default database settings or configure manually? (default/manual)${NC}"
read -r CONFIG_CHOICE

if [[ "$CONFIG_CHOICE" == "manual" ]]; then
  # Get database configuration from user
  echo -e "${YELLOW}Enter database username (default: $DB_USER):${NC}"
  read -r USER_INPUT
  DB_USER=${USER_INPUT:-$DB_USER}

  echo -e "${YELLOW}Generate random password? (Y/n):${NC}"
  read -r RANDOM_PASS
  if [[ "$RANDOM_PASS" =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Enter database password:${NC}"
    read -rs DB_PASSWORD
  fi

  echo -e "${YELLOW}Enter database name (default: $DB_NAME):${NC}"
  read -r USER_INPUT
  DB_NAME=${USER_INPUT:-$DB_NAME}

  echo -e "${YELLOW}Enter database host (default: $DB_HOST):${NC}"
  read -r USER_INPUT
  DB_HOST=${USER_INPUT:-$DB_HOST}

  echo -e "${YELLOW}Enter database port (default: $DB_PORT):${NC}"
  read -r USER_INPUT
  DB_PORT=${USER_INPUT:-$DB_PORT}
fi

echo -e "${BLUE}Using the following database configuration:${NC}"
echo -e "  Host:     ${DB_HOST}"
echo -e "  Port:     ${DB_PORT}"
echo -e "  Database: ${DB_NAME}"
echo -e "  Username: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"

echo -e "${YELLOW}Continue with these settings? (Y/n)${NC}"
read -r CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
  echo -e "${YELLOW}Configuration cancelled.${NC}"
  exit 0
fi

# Create database user and database
section_header "Creating database user and database"
# Check if user already exists
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  echo -e "${YELLOW}User $DB_USER already exists. Resetting password...${NC}"
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
else
  echo -e "${BLUE}Creating database user $DB_USER...${NC}"
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
fi

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo -e "${YELLOW}Database $DB_NAME already exists${NC}"
else
  echo -e "${BLUE}Creating database $DB_NAME...${NC}"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
fi

# Additional permissions needed for schema creation
sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;"

echo -e "${GREEN}✓ Database configuration complete${NC}"

# Generate connection URL
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo -e "${GREEN}✓ Database connection URL generated${NC}"

# Update .env.production file if it exists, or create it
section_header "Updating environment configuration"
if [ -f .env.production ]; then
  # Check if DATABASE_URL exists in the file
  if grep -q "DATABASE_URL" .env.production; then
    # Replace the existing DATABASE_URL line
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|g" .env.production
  else
    # Add DATABASE_URL to the file
    echo "DATABASE_URL=${DATABASE_URL}" >> .env.production
  fi
  echo -e "${GREEN}✓ Updated DATABASE_URL in .env.production${NC}"
else
  echo -e "${YELLOW}No .env.production file found. Creating with basic configuration...${NC}"
  cat > .env.production << EOL
# Database Configuration
DATABASE_URL=${DATABASE_URL}

# Application Configuration
PORT=5000
NODE_ENV=production

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=1073741824  # 1GB limit for file uploads

# Security Configuration
SESSION_SECRET=$(openssl rand -hex 16)

# SMTP Configuration (for email features)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
EOL
  echo -e "${GREEN}✓ Created .env.production with database configuration${NC}"
fi

# Display database information
section_header "Database Setup Complete"
echo -e "${GREEN}✓ PostgreSQL database has been configured for Kapelczak Notes${NC}"
echo -e "${YELLOW}Database Information:${NC}"
echo -e "  Host:     ${DB_HOST}"
echo -e "  Port:     ${DB_PORT}"
echo -e "  Database: ${DB_NAME}"
echo -e "  Username: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo -e "${YELLOW}Connection URL:${NC}"
echo -e "  ${DATABASE_URL}"

# Next steps
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Run 'npm run db:push' to create the database schema"
echo -e "2. Create admin user with one of these commands:"
echo -e "   - For ESM projects: NODE_OPTIONS=\"--experimental-specifier-resolution=node\" node server/scripts/create-admin.js"
echo -e "   - For CommonJS projects: node server/scripts/create-admin.cjs"
echo -e "3. Build and start the application"

echo -e "${PURPLE}===============================================${NC}"
echo -e "${PURPLE}      DATABASE CONFIGURATION COMPLETE         ${NC}"
echo -e "${PURPLE}===============================================${NC}"