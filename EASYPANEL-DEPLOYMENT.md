# Kapelczak Notes - Easypanel Deployment Guide

This guide provides detailed instructions for deploying Kapelczak Notes on an Easypanel instance using Docker Compose.

## Prerequisites

- An Easypanel instance running on a server with at least 2GB RAM
- Git access to the Kapelczak Notes repository
- A domain name pointed to your server (optional, but recommended)

## Deployment Files

The following files are used for Docker-based deployment:

- `Dockerfile` - Defines how the application is packaged
- `docker-compose.yml` - Configures the application and database services
- `.env.production` - Contains environment variables (do not commit secrets to this file)

## Deployment Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd kapelczak-notes
```

### 2. Configure Environment Variables

Create a `.env` file with your specific configuration values:

```bash
# Database Configuration
POSTGRES_USER=kapelczak_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=kapelczak_notes

# Application Configuration
PORT=5000
NODE_ENV=production
MAX_FILE_SIZE=1073741824  # 1GB in bytes

# SMTP Configuration (for email features)
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password

# Security
SESSION_SECRET=generate_a_long_random_string
```

### 3. Deploy with Easypanel

1. **Log in to your Easypanel dashboard**

2. **Create a new project**
   - Click "New Project"
   - Select "Docker Compose"
   - Name your project (e.g., "kapelczak-notes")

3. **Configure the project**
   - Upload the repository or point to a Git repo URL
   - Ensure Easypanel recognizes the docker-compose.yml file
   - Configure environment variables based on your .env file

4. **Deploy the project**
   - Click "Deploy"
   - Monitor the build logs for any errors

5. **Set up domain and SSL**
   - In project settings, configure your domain
   - Enable SSL using Let's Encrypt for secure connections

### 4. Post-Deployment Configuration

#### Initial Login

After deployment, access the application using the default credentials:
- Username: `admin`
- Password: `demo`

**Important**: Change the admin password immediately after first login!

#### Database Migration

The application will automatically create the database schema on first startup. No additional migration steps are required.

#### Persistent Storage

The following data is persisted:
- PostgreSQL database (`postgres-data` volume)
- Uploaded files (`app-uploads` volume)

## Easypanel-Specific Configuration

### Resource Allocation

Recommended minimum resources:
- CPU: 1 core
- RAM: 2GB
- Disk: 20GB

### Network Configuration

The application exposes:
- Web interface on port 5000 (HTTP)
- PostgreSQL on port 5432 (internal network only)

### Health Checks

Health checks are configured in the docker-compose.yml file:
- The application service is checked at `/api/health`
- The PostgreSQL service is checked using `pg_isready`

## Backup and Restore

### Database Backup

To backup the PostgreSQL database:

```bash
docker-compose exec postgres pg_dump -U kapelczak_user kapelczak_notes > backup.sql
```

### Database Restore

To restore from a backup:

```bash
cat backup.sql | docker-compose exec -T postgres psql -U kapelczak_user kapelczak_notes
```

### File Backup

Upload files are stored in the `app-uploads` Docker volume. Back up this directory periodically:

```bash
docker run --rm -v kapelczak-notes_app-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz /data
```

## Troubleshooting

### Common Issues

1. **Database Connection Failures**
   - Check database credentials in environment variables
   - Ensure PostgreSQL service is running (`docker-compose ps`)

2. **Email Sending Issues**
   - Verify SMTP settings in environment variables
   - Test email configuration in application settings

3. **File Upload Problems**
   - Check MAX_FILE_SIZE environment variable
   - Ensure app-uploads volume is properly mounted

### Viewing Logs

```bash
# View all logs
docker-compose logs

# View app logs only
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app
```

## Upgrading

To upgrade to a new version:

1. Pull the latest changes:
   ```bash
   git pull
   ```

2. Rebuild and restart the containers:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

## Advanced Configuration

### S3 Storage Integration

The application supports S3-compatible storage for file uploads. Configure through the admin interface after deployment.

### External PostgreSQL

To use an external PostgreSQL database instead of the included container:

1. Update the `DATABASE_URL` environment variable
2. Remove the PostgreSQL service from docker-compose.yml