#!/bin/bash
# Comprehensive deployment script for Kapelczak Notes
# Handles PostgreSQL provisioning and app deployment on bare metal servers

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Define default database settings
DB_USER="kapelczak_user"
DB_PASSWORD=$(openssl rand -hex 12) # Generate secure random password
DB_NAME="kapelczak_notes"
DB_PORT=5432
SESSION_SECRET=$(openssl rand -hex 16) # Generate secure random session secret

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
echo -e "${PURPLE}          KAPELCZAK NOTES DEPLOYMENT          ${NC}"
echo -e "${PURPLE}===============================================${NC}"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  handle_error "This script must be run as root to install system packages and configure PostgreSQL."
fi

# Check for required tools
section_header "Checking prerequisites"
for cmd in curl wget npm node openssl; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${YELLOW}$cmd not found. Installing...${NC}"
    apt-get update && apt-get install -y $cmd || handle_error "Failed to install $cmd"
  fi
  echo -e "${GREEN}✓ $cmd is installed${NC}"
done

# Install PostgreSQL if not already installed
section_header "Setting up PostgreSQL"
if ! command -v psql &> /dev/null; then
  echo -e "${YELLOW}PostgreSQL not found. Installing...${NC}"
  
  # Add PostgreSQL repository
  echo -e "${BLUE}Adding PostgreSQL repository...${NC}"
  apt-get install -y gnupg2 lsb-release
  
  # Import the repository signing key
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  
  # Add PostgreSQL apt repository
  echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  
  # Install PostgreSQL
  apt-get update
  apt-get install -y postgresql-14 postgresql-contrib
  
  if [ $? -ne 0 ]; then
    handle_error "Failed to install PostgreSQL"
  fi
  
  echo -e "${GREEN}✓ PostgreSQL installed successfully${NC}"
else
  echo -e "${GREEN}✓ PostgreSQL is already installed${NC}"
fi

# Ensure PostgreSQL is running
systemctl is-active --quiet postgresql || systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}✓ PostgreSQL service is running${NC}"

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

# Configure connection
DB_HOST="localhost"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo -e "${GREEN}✓ Database connection URL generated${NC}"

# Update the environment configuration
section_header "Configuring environment variables"
if [ -f .env.production ]; then
  echo -e "${YELLOW}Backing up existing .env.production to .env.production.bak${NC}"
  cp .env.production .env.production.bak
fi

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
SESSION_SECRET=${SESSION_SECRET}

# SMTP Configuration (for email features)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
EOL

echo -e "${GREEN}✓ Environment configuration created${NC}"
echo -e "${YELLOW}NOTE: You may need to update SMTP settings in .env.production${NC}"

# Install node dependencies
section_header "Installing dependencies"
npm ci || handle_error "Failed to install Node.js dependencies"
echo -e "${GREEN}✓ Node.js dependencies installed${NC}"

# Build the application
section_header "Building the application"
npm run build || handle_error "Failed to build the application"
echo -e "${GREEN}✓ Application built successfully${NC}"

# Create required directories
mkdir -p uploads
chmod 755 uploads
echo -e "${GREEN}✓ Upload directory created${NC}"

# Push database schema
section_header "Setting up database schema"
export DATABASE_URL="$DATABASE_URL"
echo -e "${BLUE}Database URL: $DATABASE_URL${NC}"
npm run db:push || handle_error "Failed to push database schema"
echo -e "${GREEN}✓ Database schema created${NC}"

# Create admin user
section_header "Creating admin user"

# Try our universal admin setup script first
if [ -f setup-admin.js ]; then
  echo -e "${BLUE}Using universal admin setup script...${NC}"
  node setup-admin.js || {
    echo -e "${YELLOW}Universal script failed, trying fallback methods...${NC}"
    
    # Try CommonJS version as first fallback
    if [ -f server/scripts/create-admin.cjs ]; then
      node server/scripts/create-admin.cjs || {
        # Try ESM module as second fallback with proper flags
        if [ -f server/scripts/create-admin.js ]; then
          NODE_OPTIONS="--experimental-specifier-resolution=node" node server/scripts/create-admin.js || handle_error "Failed to create admin user with all available methods"
        else
          handle_error "Failed to create admin user with CommonJS script and ESM script not found"
        fi
      }
    elif [ -f server/scripts/create-admin.js ]; then
      # If CommonJS script not found, try ESM version
      NODE_OPTIONS="--experimental-specifier-resolution=node" node server/scripts/create-admin.js || handle_error "Failed to create admin user with ESM script"
    else
      handle_error "No admin user creation scripts found"
    fi
  }
else
  # If universal script not found, try CommonJS and ESM scripts
  echo -e "${YELLOW}Universal admin setup script not found, trying specific versions...${NC}"
  
  # Check if package.json has type: module
  if grep -q '"type": "module"' package.json; then
    echo -e "${BLUE}Detected ESM project...${NC}"
    # Try ESM module first
    if [ -f server/scripts/create-admin.js ]; then
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
      node server/scripts/create-admin.cjs || handle_error "Failed to create admin user"
    else
      handle_error "Admin user creation script not found"
    fi
  else
    echo -e "${BLUE}Detected CommonJS project...${NC}"
    # For CommonJS projects
    if [ -f server/scripts/create-admin.cjs ]; then
      node server/scripts/create-admin.cjs || handle_error "Failed to create admin user"
    elif [ -f server/scripts/create-admin.js ]; then
      node server/scripts/create-admin.js || handle_error "Failed to create admin user"
    else
      handle_error "Admin user creation script not found"
    fi
  fi
fi

echo -e "${GREEN}✓ Admin user setup complete${NC}"

# Setup systemd service for the application
section_header "Setting up systemd service"
SERVICE_FILE="/etc/systemd/system/kapelczak-notes.service"

cat > $SERVICE_FILE << EOL
[Unit]
Description=Kapelczak Notes Laboratory Documentation Platform
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
Environment="NODE_ENV=production"
Environment="PORT=5000"
Environment="DATABASE_URL=${DATABASE_URL}"
Environment="SESSION_SECRET=${SESSION_SECRET}"
ExecStart=$(which node) dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd to recognize the new service
systemctl daemon-reload
systemctl enable kapelczak-notes
echo -e "${GREEN}✓ Systemd service created and enabled${NC}"

# Start the application
section_header "Starting the application"
systemctl start kapelczak-notes || handle_error "Failed to start the application"
echo -e "${GREEN}✓ Application started successfully${NC}"

# Configure firewall if ufw is installed
if command -v ufw &> /dev/null; then
  section_header "Configuring firewall"
  ufw allow 5000/tcp
  echo -e "${GREEN}✓ Firewall configured to allow traffic on port 5000${NC}"
fi

# Final steps and instructions
section_header "Deployment Summary"
echo -e "${GREEN}Kapelczak Notes has been successfully deployed!${NC}"
echo -e "${YELLOW}Database Information:${NC}"
echo -e "  Host:     ${DB_HOST}"
echo -e "  Port:     ${DB_PORT}"
echo -e "  Database: ${DB_NAME}"
echo -e "  Username: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo -e "${YELLOW}Application URL:${NC}"
echo -e "  http://$(hostname -I | awk '{print $1}'):5000"
echo -e "${YELLOW}Default Admin Credentials:${NC}"
echo -e "  Username: admin"
echo -e "  Password: demo"
echo -e "${RED}IMPORTANT: Change the default admin password immediately after first login!${NC}"
echo -e "${YELLOW}Service Management Commands:${NC}"
echo -e "  Start:   systemctl start kapelczak-notes"
echo -e "  Stop:    systemctl stop kapelczak-notes"
echo -e "  Restart: systemctl restart kapelczak-notes"
echo -e "  Status:  systemctl status kapelczak-notes"
echo -e "  Logs:    journalctl -u kapelczak-notes -f"

# Save deployment info to a file for reference
cat > deployment-info.txt << EOL
Kapelczak Notes Deployment Information
=====================================
Deployment Date: $(date)
Server: $(hostname)

Database Information:
- Host: ${DB_HOST}
- Port: ${DB_PORT}
- Database: ${DB_NAME}
- Username: ${DB_USER}
- Password: ${DB_PASSWORD}

Application URL:
http://$(hostname -I | awk '{print $1}'):5000

Default Admin Credentials:
- Username: admin
- Password: demo

IMPORTANT: Change the default admin password immediately after first login!

Service Management Commands:
- Start:   systemctl start kapelczak-notes
- Stop:    systemctl stop kapelczak-notes
- Restart: systemctl restart kapelczak-notes
- Status:  systemctl status kapelczak-notes
- Logs:    journalctl -u kapelczak-notes -f
EOL

echo -e "${GREEN}Deployment information saved to deployment-info.txt${NC}"
echo -e "${PURPLE}===============================================${NC}"
echo -e "${PURPLE}          DEPLOYMENT COMPLETE                 ${NC}"
echo -e "${PURPLE}===============================================${NC}"