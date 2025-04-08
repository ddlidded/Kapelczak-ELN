# Kapelczak Notes Deployment Guide

This document outlines how to deploy the Kapelczak Notes application on your own server.

## Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v14 or later)
- npm or yarn package manager
- A Linux-based server (Ubuntu/Debian recommended)

## Setup Instructions

### 1. Database Setup

1. Install PostgreSQL on your server:
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   ```

2. Create a database and user:
   ```bash
   sudo -u postgres psql
   ```

   Inside the PostgreSQL prompt:
   ```sql
   CREATE DATABASE kapelczak_notes;
   CREATE USER kapelczak_user WITH ENCRYPTED PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE kapelczak_notes TO kapelczak_user;
   \q
   ```

### 2. Application Setup

1. Clone the repository to your server:
   ```bash
   git clone <your-repository-url> /path/to/kapelczak-notes
   cd /path/to/kapelczak-notes
   ```

2. Install dependencies:
   ```bash
   npm install
   # Install global dependencies needed for building
   npm install -g tsx vite
   ```

3. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file to include your database connection details:
   ```
   DATABASE_URL=postgresql://kapelczak_user:your_secure_password@localhost:5432/kapelczak_notes
   PORT=5000
   NODE_ENV=production
   ```

5. Build the application:
   ```bash
   npm run build
   ```

6. Push the database schema:
   ```bash
   npm run db:push
   ```

### 3. Running the Application

#### Option 1: Direct Node.js (Not recommended for production)

```bash
npm start
```

#### Option 2: Using PM2 (Recommended for production)

1. Install PM2:
   ```bash
   npm install -g pm2
   ```

2. Start the application:
   ```bash
   pm2 start ecosystem.config.js
   ```

3. Set up PM2 to start on system boot:
   ```bash
   pm2 startup
   pm2 save
   ```

#### Option 3: Using Docker (Alternative production setup)

Use the provided Dockerfile and docker-compose.yml files to containerize the application:

```bash
docker-compose up -d
```

### 4. Reverse Proxy Setup (Nginx)

1. Install Nginx:
   ```bash
   sudo apt install nginx
   ```

2. Create a site configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/kapelczak-notes
   ```

3. Add the following configuration:
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

4. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/kapelczak-notes /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 5. SSL Setup (Optional but recommended)

1. Install Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Obtain and install SSL certificate:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Maintenance

### Database Backups

Set up regular PostgreSQL backups:

```bash
sudo -u postgres pg_dump kapelczak_notes > backup_$(date +\%Y\%m\%d).sql
```

You can set this up as a cron job for automatic backups.

### Application Updates

To update the application:

1. Pull the latest code:
   ```bash
   git pull
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Rebuild the application:
   ```bash
   npm run build
   ```

4. Push any database schema changes:
   ```bash
   npm run db:push
   ```

5. Restart the service:
   ```bash
   pm2 restart all
   ```

## Troubleshooting

### Common Issues

1. **Connection refused to database**:
   - Check the PostgreSQL service is running: `sudo systemctl status postgresql`
   - Verify the database connection string in your `.env` file
   - Ensure PostgreSQL is configured to accept connections

2. **Application not starting**:
   - Check logs: `pm2 logs`
   - Verify Node.js version: `node -v`
   - Ensure all dependencies are installed: `npm install`

3. **Cannot access website**:
   - Check Nginx is running: `sudo systemctl status nginx`
   - Verify the site configuration
   - Check firewall settings: `sudo ufw status`