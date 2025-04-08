#!/bin/bash
# Kapelczak Notes Auto-Deployment Script
# ---------------------------------------

set -e  # Exit on any error

# Configuration variables - edit these to match your environment
APP_DIR="$PWD"
LOGS_DIR="$APP_DIR/logs"
UPLOADS_DIR="$APP_DIR/uploads"
PORT=5000
DB_USER="kapelczak_user"
DB_PASSWORD="your_password"
DB_NAME="kapelczak_notes"
DB_HOST="localhost"
DOMAIN="your-domain.com"

# Display header
echo "=========================================================="
echo "    KAPELCZAK NOTES DEPLOYMENT SCRIPT"
echo "=========================================================="
echo "This script will deploy the Kapelczak Notes application."
echo "Make sure you have edited the script configuration section."
echo ""

# Create necessary directories
echo "[INFO] Creating necessary directories..."
mkdir -p "$LOGS_DIR"
mkdir -p "$UPLOADS_DIR"
echo "[SUCCESS] Directories created."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js 14 or higher."
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not installed. Please install npm."
    exit 1
fi

# Install project dependencies
echo "[INFO] Installing project dependencies..."
npm install
echo "[SUCCESS] Project dependencies installed."

# Configure environment
echo "[INFO] Configuring environment..."
cat > .env.production << ENVEND
# Database Configuration
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}

# Application Configuration
PORT=${PORT}
NODE_ENV=production

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ENVEND
echo "[SUCCESS] Environment configured."

# Build the frontend
echo "[INFO] Building the frontend..."
npx vite build
echo "[SUCCESS] Frontend built successfully."

# Push database schema
echo "[INFO] Pushing database schema..."
npx drizzle-kit push
echo "[SUCCESS] Database schema updated."

# Setup PM2 configuration
echo "[INFO] Setting up PM2 configuration..."
if ! command -v pm2 &> /dev/null; then
    echo "[WARNING] PM2 not found. Installing PM2..."
    npm install -g pm2
    echo "[SUCCESS] PM2 installed."
fi

# Start the application with PM2
echo "[INFO] Starting the application with PM2..."
pm2 delete kapelczak-notes 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo "[SUCCESS] Application started with PM2."

# Nginx configuration (if needed)
if command -v nginx &> /dev/null; then
    echo "[INFO] Nginx is installed. Would you like to configure Nginx as a reverse proxy? (y/n)"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        echo "[INFO] Creating Nginx configuration..."
        cat > kapelczak-notes.conf << NGINXEND
server {
    listen 80;
    server_name ${DOMAIN};

    # Logs
    access_log /var/log/nginx/kapelczak-notes.access.log;
    error_log /var/log/nginx/kapelczak-notes.error.log;

    # File upload size limit
    client_max_body_size 10M;

    # Proxy to Node.js application
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

    # Static file caching for improved performance
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        proxy_pass http://localhost:${PORT};
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINXEND
        echo "[SUCCESS] Nginx configuration created at kapelczak-notes.conf"
        echo "[INFO] To use this configuration, run:"
        echo "  sudo cp kapelczak-notes.conf /etc/nginx/sites-available/"
        echo "  sudo ln -s /etc/nginx/sites-available/kapelczak-notes.conf /etc/nginx/sites-enabled/"
        echo "  sudo nginx -t && sudo systemctl reload nginx"
    fi
else
    echo "[INFO] Nginx is not installed. Skipping Nginx configuration."
fi

# Create a helper script for redeployment
echo "[INFO] Creating redeployment script..."
cat > redeploy.sh << 'REDEPLOYEND'
#!/bin/bash
set -e

echo "[INFO] Running git pull to get latest changes..."
git pull

echo "[INFO] Installing dependencies..."
npm install

echo "[INFO] Building the application..."
npx vite build

echo "[INFO] Pushing database schema..."
npx drizzle-kit push

echo "[INFO] Restarting the application with PM2..."
pm2 restart kapelczak-notes

echo "[SUCCESS] Redeployment complete!"
REDEPLOYEND
chmod +x redeploy.sh
echo "[SUCCESS] Created redeploy.sh script for future updates."

echo ""
echo "=========================================================="
echo "    DEPLOYMENT COMPLETE"
echo "=========================================================="
echo ""
echo "[INFO] Your application is deployed and running!"
echo "[INFO] Local URL: http://localhost:$PORT"
echo ""
echo "To ensure the application starts on system boot:"
echo "Run: pm2 startup"
echo "Follow the instructions provided by the command"
echo ""
echo "To redeploy after updates, run: ./redeploy.sh"
echo ""