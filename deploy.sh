#!/bin/bash
# Kapelczak Notes Auto-Deployment Script
# ---------------------------------------

set -e  # Exit on any error

# Configuration variables - edit these to match your environment
APP_DIR="$PWD"                 # Application directory
LOGS_DIR="$APP_DIR/logs"       # Logs directory
UPLOADS_DIR="$APP_DIR/uploads" # Uploads directory
NODE_VERSION="20"              # Node.js version to use
PORT=5000                      # Application port
DB_USER="kapelczak_user"       # Database user
DB_PASSWORD="your_password"    # Database password (change this!)
DB_NAME="kapelczak_notes"      # Database name
DB_HOST="localhost"            # Database host
DOMAIN="your-domain.com"       # Domain name (for Nginx config)
USE_PM2=true                   # Whether to use PM2

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
  if ! command -v $1 &> /dev/null; then
    log_error "$1 is not installed. Installing..."
    return 1
  else
    return 0
  fi
}

# Display header
echo "=========================================================="
echo "    KAPELCZAK NOTES DEPLOYMENT SCRIPT"
echo "=========================================================="
echo "This script will deploy the Kapelczak Notes application."
echo "Make sure you have edited the script configuration section."
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  log_warning "Running as root is not recommended. Continue? (y/n)"
  read -r confirm
  if [[ $confirm != "y" ]]; then
    log_info "Deployment aborted."
    exit 0
  fi
fi

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p "$LOGS_DIR"
mkdir -p "$UPLOADS_DIR"
log_success "Directories created."

# Check for required software
log_info "Checking for required software..."

# Check for Node.js
if ! check_command node; then
  log_info "Installing Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
  log_success "Node.js installed."
else
  node_version=$(node -v)
  log_info "Node.js $node_version is already installed."
fi

# Check for npm
if ! check_command npm; then
  log_error "npm is not installed. This should have been installed with Node.js."
  exit 1
else
  npm_version=$(npm -v)
  log_info "npm $npm_version is already installed."
fi

# Install global dependencies
log_info "Installing global dependencies..."
sudo npm install -g npm@latest
sudo npm install -g drizzle-kit vite tsx
if [ "$USE_PM2" = true ]; then
  sudo npm install -g pm2
fi
log_success "Global dependencies installed."

# Install project dependencies
log_info "Installing project dependencies..."
npm ci || npm install
log_success "Project dependencies installed."

# Configure environment
log_info "Configuring environment..."
cat > .env.production << EOF
# Database Configuration
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=${DB_NAME}
PGHOST=${DB_HOST}
PGPORT=5432

# Application Configuration
PORT=${PORT}
NODE_ENV=production

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF
log_success "Environment configured."
log_success "Environment configured."

# Build the frontend
log_info "Building the frontend..."
npm run build
log_success "Frontend built successfully."

# Check for PostgreSQL
if ! check_command psql; then
  log_warning "PostgreSQL is not installed. Would you like to install it? (y/n)"
  read -r confirm
  if [[ $confirm == "y" ]]; then
    log_info "Installing PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    log_success "PostgreSQL installed."
    
    log_info "Setting up PostgreSQL database..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || log_warning "Database may already exist."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" || log_warning "User may already exist."
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || log_warning "Privileges may already be granted."
    log_success "PostgreSQL database setup complete."
  else
    log_warning "Skipping PostgreSQL installation. Make sure your database is properly configured."
  fi
else
  log_info "PostgreSQL is already installed."
fi

# Push database schema
log_info "Pushing database schema..."
npm run db:push

# Setup Nginx (if requested)
log_info "Would you like to configure Nginx as a reverse proxy? (y/n)"
read -r configure_nginx
if [[ $configure_nginx == "y" ]]; then
  if ! check_command nginx; then
    log_info "Installing Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    log_success "Nginx installed."
  else
    log_info "Nginx is already installed."
  fi
  
  log_info "Configuring Nginx..."
  sudo tee /etc/nginx/sites-available/kapelczak-notes << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    access_log /var/log/nginx/kapelczak-notes.access.log;
    error_log /var/log/nginx/kapelczak-notes.error.log;
    
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        proxy_pass http://localhost:${PORT};
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF
  sudo ln -sf /etc/nginx/sites-available/kapelczak-notes /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  log_success "Nginx configured successfully."
  
  log_info "Would you like to set up SSL with Let's Encrypt? (y/n)"
  read -r setup_ssl
  if [[ $setup_ssl == "y" ]]; then
    if ! check_command certbot; then
      log_info "Installing Certbot..."
      sudo apt-get update
      sudo apt-get install -y certbot python3-certbot-nginx
      log_success "Certbot installed."
    else
      log_info "Certbot is already installed."
    fi
    
    log_info "Setting up SSL with Let's Encrypt..."
    sudo certbot --nginx -d $DOMAIN
    log_success "SSL configured successfully."
  fi
fi

# Start the application
if [ "$USE_PM2" = true ]; then
  log_info "Starting the application with PM2..."
  pm2 delete kapelczak-notes 2>/dev/null || true
  pm2 start ecosystem.config.js --env production
  pm2 save
  log_info "Setting up PM2 to start on system boot..."
  pm2 startup | tail -n 1 | sh
  log_success "Application started with PM2."
else
  log_info "Starting the application with Node.js..."
  nohup node server/prod.js > "$LOGS_DIR/app.log" 2>&1 &
  echo $! > "$APP_DIR/app.pid"
  log_success "Application started."
fi

# Create a helper script for redeployment
cat > redeploy.sh << 'EOF'
#!/bin/bash
set -e

echo "Running git pull to get latest changes..."
git pull

echo "Installing dependencies..."
npm ci

echo "Building the application..."
npm run build

echo "Pushing database schema..."
npm run db:push

if command -v pm2 &> /dev/null; then
  echo "Restarting the application with PM2..."
  pm2 restart kapelczak-notes
else
  echo "Restarting the application..."
  kill $(cat app.pid)
  nohup node server/prod.js > logs/app.log 2>&1 &
  echo $! > app.pid
fi

echo "Redeployment complete!"
EOF
chmod +x redeploy.sh
log_success "Created redeploy.sh script for future updates."

# Final check
log_info "Checking if the application is running..."
if curl -s http://localhost:$PORT > /dev/null; then
  log_success "Application is running successfully!"
else
  log_warning "Application may not be running. Check logs for errors."
fi

echo ""
echo "=========================================================="
echo "    DEPLOYMENT COMPLETE"
echo "=========================================================="
echo ""
log_info "Your application is deployed and running!"
log_info "Access it at: http://$DOMAIN"
log_info "Local URL: http://localhost:$PORT"
log_info "To redeploy after updates, run: ./redeploy.sh"
echo ""