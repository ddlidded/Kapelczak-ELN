# Production Deployment Guide for Kapelczak Notes

This guide specifically addresses the "tsx: not found" and "vite: not found" errors that occur when deploying the application.

## Setup Instructions (Avoiding tsx and vite errors)

### 1. Server Preparation

Make sure your server has Node.js and npm installed:

```bash
# Update package lists
sudo apt update

# Install Node.js and npm
sudo apt install nodejs npm

# Verify installation
node -v  # Should show v14.x or higher
npm -v   # Should show v6.x or higher
```

### 2. Database Setup

Set up PostgreSQL database:

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

In the PostgreSQL prompt:
```sql
CREATE DATABASE kapelczak_notes;
CREATE USER kapelczak_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE kapelczak_notes TO kapelczak_user;
\q
```

### 3. Application Deployment

Clone the application to your server:

```bash
git clone <repository-url> /path/to/kapelczak-notes
cd /path/to/kapelczak-notes
```

### 4. Install Dependencies

Install all dependencies, including the global ones that cause the "not found" errors:

```bash
# Install project dependencies
npm install

# Install global dependencies
sudo npm install -g tsx vite drizzle-kit
```

### 5. Environment Configuration

Create the production environment file:

```bash
cp .env.example .env.production
```

Edit the `.env.production` file with your database credentials:
```
DATABASE_URL=postgresql://kapelczak_user:your_secure_password@localhost:5432/kapelczak_notes
PORT=5000
NODE_ENV=production
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### 6. Build the Application

Build the application:

```bash
# Create uploads directory
mkdir -p uploads

# Push database schema
npx drizzle-kit push

# Build frontend
npx vite build
```

### 7. Running the Application

Option 1: Direct Node.js (for testing)
```bash
NODE_ENV=production node server/prod.js
```

Option 2: Using PM2 (recommended for production)
```bash
# Install PM2
sudo npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Configure PM2 to start on system boot
pm2 startup
```

### 8. Nginx Configuration (Optional)

Install and configure Nginx as a reverse proxy:

```bash
# Install Nginx
sudo apt install nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/kapelczak-notes
```

Add the following configuration:
```
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/kapelczak-notes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Troubleshooting Common Errors

### Error: tsx: not found

Solution:
```bash
sudo npm install -g tsx
```

### Error: vite: not found

Solution:
```bash
sudo npm install -g vite
```

### Error: Unable to connect to PostgreSQL

Check the PostgreSQL service status:
```bash
sudo systemctl status postgresql
```

Verify your database connection string in `.env.production`.

### Error: EACCES: permission denied

Ensure proper permissions for project directories:
```bash
sudo chown -R $USER:$USER /path/to/kapelczak-notes
chmod -R 755 /path/to/kapelczak-notes
```

## Maintenance

### Database Backups

Schedule regular database backups:
```bash
sudo -u postgres pg_dump kapelczak_notes > /backup/location/kapelczak_$(date +\%Y\%m\%d).sql
```

### Updating the Application

To update the application:
```bash
cd /path/to/kapelczak-notes
git pull
npm install
npx vite build
npx drizzle-kit push
pm2 restart all
```