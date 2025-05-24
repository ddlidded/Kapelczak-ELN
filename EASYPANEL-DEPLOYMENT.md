# Kapelczak Notes - Easypanel Auto-Deployment Guide

This guide provides complete instructions for deploying Kapelczak Notes on Easypanel using Docker Compose with all required components.

## 🚀 Quick Start

### Prerequisites
- Easypanel account with Docker Compose support
- Git repository access to this project

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd kapelczak-notes
```

### 2. Configure Environment Variables
Copy the example environment file and configure your settings:
```bash
cp .env.example .env
```

### 3. Deploy with Docker Compose
```bash
docker-compose up -d
```

## 📋 Environment Configuration

### Required Environment Variables
Create a `.env` file with the following variables:

```env
# Database Configuration
POSTGRES_PASSWORD=your_secure_database_password

# Application Security
SESSION_SECRET=your_secure_session_secret_key

# Optional: SMTP Email Configuration
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password

# Optional: S3 Storage Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET=your_s3_bucket_name
S3_ENDPOINT=your_s3_endpoint_url
```

## 🐳 Docker Compose Services

### Services Included:
1. **PostgreSQL Database** - Persistent data storage
2. **Kapelczak Notes App** - Main application server
3. **Nginx Proxy** - Reverse proxy and load balancer

### Volumes:
- `postgres_data` - Database persistence
- `uploads_data` - File uploads storage
- `logs_data` - Application logs

## 🔧 Easypanel Configuration

### Using Easypanel Web Interface:

1. **Create New Project**
   - Project Name: `kapelczak-notes`
   - Repository: Your Git repository URL

2. **Deploy Type**
   - Select "Docker Compose"
   - Use the provided `docker-compose.yml`

3. **Environment Variables**
   - Add all required environment variables from `.env.example`
   - Set secure passwords for production

4. **Domain Configuration**
   - Set up your custom domain or use Easypanel subdomain
   - Configure SSL certificates if needed

### Using Easypanel CLI:

```bash
# Install Easypanel CLI
npm install -g @easypanel/cli

# Login to Easypanel
easypanel login

# Deploy the project
easypanel deploy --compose docker-compose.yml
```

## 🔐 Security Considerations

### Required Security Settings:
1. **Change Default Passwords**
   - Set strong `POSTGRES_PASSWORD`
   - Set unique `SESSION_SECRET`

2. **Database Security**
   - Database is isolated in Docker network
   - No external database ports exposed in production

3. **File Upload Security**
   - 1GB upload limit configured
   - File type validation in application

## 📊 Health Checks & Monitoring

### Built-in Health Checks:
- **Database**: PostgreSQL ready check every 10 seconds
- **Application**: HTTP health endpoint check every 30 seconds
- **Nginx**: Depends on application health

### Monitoring Endpoints:
- Health Check: `http://your-domain/api/health`
- Database Status: Included in health check response

## 🛠️ Troubleshooting

### Common Issues:

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL logs
   docker-compose logs postgres
   
   # Restart database service
   docker-compose restart postgres
   ```

2. **Application Won't Start**
   ```bash
   # Check application logs
   docker-compose logs kapelczak-notes
   
   # Rebuild and restart
   docker-compose down
   docker-compose up --build -d
   ```

3. **File Upload Issues**
   ```bash
   # Check upload directory permissions
   docker-compose exec kapelczak-notes ls -la /app/uploads
   
   # Reset upload directory
   docker-compose exec kapelczak-notes mkdir -p /app/uploads
   docker-compose exec kapelczak-notes chmod 755 /app/uploads
   ```

### Log Access:
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs kapelczak-notes
docker-compose logs postgres
docker-compose logs nginx

# Follow logs in real-time
docker-compose logs -f kapelczak-notes
```

## 🔄 Updates & Maintenance

### Updating the Application:
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

### Database Backup:
```bash
# Create backup
docker-compose exec postgres pg_dump -U kapelczak_user kapelczak_notes > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U kapelczak_user kapelczak_notes < backup.sql
```

## 📁 Project Structure

```
kapelczak-notes/
├── docker-compose.yml          # Main Docker Compose configuration
├── Dockerfile                  # Application container definition
├── .env.example               # Environment variables template
├── nginx.conf                 # Nginx proxy configuration
├── init-db.sql               # Database initialization
├── docker-entrypoint.sh      # Application startup script
├── client/                    # React frontend application
├── server/                    # Node.js backend application
└── shared/                    # Shared schemas and types
```

## 🎯 Default Admin Access

After successful deployment:
- **URL**: `http://your-domain`
- **Username**: `admin`
- **Password**: `demo`

⚠️ **Important**: Change the default admin password immediately after first login!

## 🌐 Production Recommendations

1. **Use HTTPS**: Configure SSL certificates in Easypanel
2. **Set Strong Passwords**: Use unique, complex passwords for all services
3. **Enable SMTP**: Configure email service for notifications
4. **Configure S3**: Set up S3-compatible storage for file uploads
5. **Monitor Resources**: Keep track of CPU, memory, and storage usage
6. **Regular Backups**: Schedule automated database backups

## 📞 Support

For deployment issues or questions:
1. Check the troubleshooting section above
2. Review Docker Compose logs for error details
3. Ensure all environment variables are properly configured
4. Verify Easypanel service status and resource limits