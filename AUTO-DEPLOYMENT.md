# Kapelczak Notes Auto-Deployment Guide

This guide provides step-by-step instructions for setting up automatic deployment of the Kapelczak Notes application on a Linux server.

## Server Requirements

- Node.js v20 or higher
- npm v8 or higher 
- PostgreSQL database
- Optional: Nginx for reverse proxy
- Optional: PM2 for process management (will be automatically installed if not present)

## Quick Deployment

1. Clone this repository to your server
2. Run the included `deploy.sh` script after editing the configuration variables
3. Follow the prompts to complete installation

## Step-by-Step Deployment Instructions

1. **Clone the Repository**

   ```bash
   git clone [your-repo-url] /path/to/kapelczak-notes
   cd /path/to/kapelczak-notes
   ```

2. **Edit the Deployment Script** 

   Edit the following variables at the top of `deploy.sh`:
   - `DB_USER`: Your PostgreSQL username
   - `DB_PASSWORD`: Your PostgreSQL password (use a secure password!)
   - `DB_NAME`: Your PostgreSQL database name
   - `DB_HOST`: Your PostgreSQL host (usually localhost)
   - `DOMAIN`: Your domain name if using Nginx
   - `PORT`: The port to run the application on (default: 5000)
   - `USE_PM2`: Whether to use PM2 for process management (true/false)

3. **Make the Script Executable**

   ```bash
   chmod +x deploy.sh
   ```

4. **Run the Deployment Script**

   ```bash
   ./deploy.sh
   ```

5. **Follow Interactive Prompts**

   The script will guide you through:
   - Installing required dependencies
   - Setting up the PostgreSQL database (if not already present)
   - Building the application
   - Configuring Nginx (optional)
   - Setting up Let's Encrypt SSL certificates (optional)
   - Starting the application with PM2

## Production Environment

The deployment script sets up the following directory structure:

```
/path/to/kapelczak-notes/
├── dist/            # Production build files
├── logs/            # Application and PM2 logs  
├── uploads/         # File uploads storage
├── .env.production  # Production environment variables
├── ecosystem.config.js  # PM2 configuration
└── redeploy.sh      # Script for future updates
```

## Manual Redeployment

For future updates, you can use the automatically generated `redeploy.sh` script:

```bash
./redeploy.sh
```

This will:
1. Pull the latest changes from git
2. Install any new dependencies
3. Rebuild the application
4. Push any database schema changes
5. Restart the application with PM2

## Production Debugging

### Checking Logs

**Application Logs**:
```bash
pm2 logs kapelczak-notes
```

**Nginx Logs** (if using Nginx):
```bash
sudo tail -f /var/log/nginx/kapelczak-notes.access.log
sudo tail -f /var/log/nginx/kapelczak-notes.error.log
```

### Checking Application Status

```bash
pm2 status
```

### Restarting the Application

```bash
pm2 restart kapelczak-notes
```

## Troubleshooting

### Common Issues and Solutions

**Issue**: Blank page in browser but application seems to be running

**Solution**: Check the Nginx configuration and make sure it's correctly set up to serve the static files and proxy API requests. Also verify the application is running on the expected port with `pm2 status`.

**Issue**: Application fails to start with database connection errors

**Solution**: Verify PostgreSQL is running and the connection details in `.env.production` are correct:
```bash
sudo systemctl status postgresql
cat .env.production
```

**Issue**: File uploads not working

**Solution**: Ensure the uploads directory exists and has proper permissions:
```bash
mkdir -p uploads
chmod 755 uploads
```

**Issue**: "Not Found" errors for static assets

**Solution**: This can happen if the build process didn't complete correctly. Check the build logs and try rebuilding:
```bash
npm run build
```

**Issue**: PM2 not restarting on server reboot

**Solution**: Set up PM2 to start on boot:
```bash
pm2 startup
pm2 save
```

## Security Recommendations

1. **Setup a Firewall**
   ```bash
   sudo ufw allow 22/tcp  # SSH
   sudo ufw allow 80/tcp  # HTTP
   sudo ufw allow 443/tcp # HTTPS
   sudo ufw enable
   ```

2. **Use SSL/TLS** with Let's Encrypt
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Database Security**
   - Use a strong password for the database
   - Don't expose the PostgreSQL port to the internet
   - Consider setting up database backups

## Performance Optimization

1. **Enable Gzip Compression** in Nginx:
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
   ```

2. **Implement Browser Caching** (already included in the Nginx config)

3. **Configure PM2 Clustering** (already set up in ecosystem.config.js)

4. **Consider Adding a CDN** for global deployments

---

For further assistance or questions, please refer to the project documentation or contact the development team.