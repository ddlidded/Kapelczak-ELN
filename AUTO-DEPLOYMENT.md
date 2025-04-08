# Kapelczak Notes Auto-Deployment Guide

This guide provides step-by-step instructions for setting up automatic deployment of the Kapelczak Notes application on a Linux server. Copy and paste the script below into a file named `deploy.sh` on your server, modify the configuration variables as needed, and then run it.

## Deployment Script

```bash
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
```

## Step-by-Step Deployment Instructions

1. **Prerequisites**

   Ensure the following are installed on your server:
   - Node.js (v14 or higher)
   - npm (v6 or higher)
   - PostgreSQL database

2. **Clone the Repository**

   ```bash
   git clone [your-repo-url] /path/to/kapelczak-notes
   cd /path/to/kapelczak-notes
   ```

3. **Create the Deployment Script**

   ```bash
   nano deploy.sh
   ```
   
   Copy and paste the above script into this file.
   
   Make it executable:
   ```bash
   chmod +x deploy.sh
   ```

4. **Edit Configuration Variables**

   Edit the following variables in the script:
   - `DB_USER`: Your PostgreSQL username
   - `DB_PASSWORD`: Your PostgreSQL password
   - `DB_NAME`: Your PostgreSQL database name
   - `DB_HOST`: Your PostgreSQL host (usually localhost)
   - `DOMAIN`: Your domain name (if using Nginx)

5. **Run the Deployment Script**

   ```bash
   ./deploy.sh
   ```

6. **Setup PM2 for Auto-Start on Boot**

   ```bash
   pm2 startup
   ```
   
   Follow the instructions displayed by the command.

7. **Configure Nginx (Optional)**

   If you chose to create an Nginx configuration, follow the instructions displayed in the script output to enable it.

## Auto-Redeployment

The script creates a `redeploy.sh` file which you can use for future updates. Simply run:

```bash
./redeploy.sh
```

This will:
1. Pull the latest changes from git
2. Install any new dependencies
3. Rebuild the frontend
4. Push any database schema changes
5. Restart the application

## Setting Up Continuous Deployment (Optional)

You can set up a GitHub webhook to trigger the redeploy script whenever changes are pushed to your repository.

1. Create a webhook receiver script:

```bash
#!/bin/bash
# github-webhook.sh

# Log directory
LOG_DIR="/path/to/kapelczak-notes/logs"
mkdir -p "$LOG_DIR"

# Log file
LOG_FILE="$LOG_DIR/webhook.log"

# Directory containing your application
APP_DIR="/path/to/kapelczak-notes"

echo "$(date): Webhook received" >> "$LOG_FILE"

# Navigate to application directory
cd "$APP_DIR" || exit 1

# Run redeployment script
./redeploy.sh >> "$LOG_FILE" 2>&1

echo "$(date): Redeployment complete" >> "$LOG_FILE"
```

2. Set up a service to listen for GitHub webhooks and trigger this script.

## Troubleshooting

### Common Issues

**Issue**: `tsx: command not found` or `vite: command not found`

**Solution**: Install these globally:
```bash
npm install -g tsx vite drizzle-kit
```

**Issue**: Application starts but cannot connect to database

**Solution**: Check your database connection string in `.env.production` and ensure the PostgreSQL service is running.

**Issue**: PM2 fails to start on boot

**Solution**: Ensure you've run `pm2 save` after starting your application, then run `pm2 startup` again.

**Issue**: Nginx configuration not working

**Solution**: Check Nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```