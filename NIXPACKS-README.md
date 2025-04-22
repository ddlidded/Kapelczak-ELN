# Kapelczak Notes Deployment with Nixpacks

This guide provides comprehensive instructions for deploying Kapelczak Notes using Nixpacks. Nixpacks is a build system that combines the best parts of Heroku buildpacks with the reproducibility of Nix, making it ideal for deploying Node.js applications on platforms like Railway, Render, and others.

## Table of Contents

1. [Understanding Nixpacks](#understanding-nixpacks)
2. [Available Deployment Scripts](#available-deployment-scripts)
3. [Deployment Options](#deployment-options)
   - [Railway Deployment](#railway-deployment)
   - [Render Deployment](#render-deployment)
   - [Custom Server Deployment](#custom-server-deployment)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Email Configuration](#email-configuration)
7. [File Storage Options](#file-storage-options)
8. [Monitoring and Health Checks](#monitoring-and-health-checks)
9. [Troubleshooting](#troubleshooting)

## Understanding Nixpacks

Nixpacks automatically detects your application type and builds an optimized container without requiring a Dockerfile. The `.nixpacks` and `nixpacks.toml` files in this repository provide the configuration for the build process.

Key benefits include:
- Automatic dependency resolution
- Consistent builds across environments
- Optimized container images

## Available Deployment Scripts

This repository includes several scripts to make deployment easier:

1. **build.sh** - Automates the build process:
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

2. **railway-deploy.sh** - Automates deployment to Railway:
   ```bash
   chmod +x railway-deploy.sh
   ./railway-deploy.sh
   ```

3. **init-db.sh** - Initializes the database schema and creates an admin user if needed:
   ```bash
   chmod +x init-db.sh
   ./init-db.sh
   ```

## Deployment Options

### Railway Deployment

Railway offers the simplest deployment experience. See the detailed guide in [NIXPACKS-RAILWAY-DEPLOYMENT.md](./NIXPACKS-RAILWAY-DEPLOYMENT.md).

#### Quick Steps:

1. Create a Railway account
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`
4. Create a new project: `railway init`
5. Add a PostgreSQL database: `railway add --plugin postgresql`
6. Deploy: `railway up`

### Render Deployment

Render also provides Nixpacks support for easy deployments.

#### Quick Steps:

1. Create a Render account
2. Connect your Git repository
3. Select "Web Service" and choose "Nixpacks" as the build method
4. Set environment variables
5. Deploy

### Custom Server Deployment

For deployment on your own Linux server:

1. Install Nixpacks:
   ```bash
   curl -sSL https://nixpacks.com/install.sh | bash
   ```

2. Build the application:
   ```bash
   nixpacks build . --name kapelczak-notes
   ```

3. Run the container:
   ```bash
   docker run -p 5000:5000 --env-file .env.production kapelczak-notes
   ```

## Environment Variables

The following environment variables are required for deployment:

### Essential Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | - |
| `PORT` | Port for the web server | 5000 |
| `NODE_ENV` | Environment mode | production |
| `SESSION_SECRET` | Secret for session encryption | - |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_FILE_SIZE` | Maximum file upload size in bytes | 1073741824 (1GB) |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |

## Database Setup

The application requires a PostgreSQL database. The `init-db.sh` script will:

1. Create required database tables
2. Set up the schema
3. Create an admin user if one doesn't exist

On first run, the default login credentials are:
- Username: `admin`
- Password: `demo`

**IMPORTANT**: Change the default password immediately after first login!

## Email Configuration

To enable email functionality (password reset, report sharing), configure the SMTP settings:

1. Set the following environment variables:
   ```
   SMTP_HOST=your-smtp-server.com
   SMTP_PORT=587
   SMTP_USER=your-username
   SMTP_PASSWORD=your-password
   ```

2. Alternatively, configure SMTP settings through the admin interface after login.

## File Storage Options

Kapelczak Notes supports two file storage options:

### Local Storage

Files are stored in the local filesystem. However, this is not recommended for production as files will be lost when containers are restarted or redeployed.

### S3 Compatible Storage

For production, configure S3 storage after logging in:

1. Go to your profile settings
2. Navigate to "Storage Settings"
3. Enter your S3 credentials:
   - Endpoint
   - Region
   - Bucket name
   - Access key
   - Secret key
4. Test the connection and save

## Monitoring and Health Checks

The application provides a health check endpoint at `/api/health` that returns:

```json
{
  "status": "ok",
  "timestamp": "2025-04-22T03:45:26.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

Configure your deployment platform to use this endpoint for health monitoring.

## Troubleshooting

If you encounter issues during deployment:

### Database Connection Issues

1. Verify the `DATABASE_URL` format is correct
2. Ensure the database is accessible from your deployment environment
3. Check database logs for connection errors

### Build Failures

1. Review the build logs for specific errors
2. Ensure all dependencies are correctly specified
3. Validate that required environment variables are set

### Runtime Errors

1. Check application logs for error messages
2. Verify environment variables are correctly set
3. Use the health check endpoint to verify the service is running

If you continue to experience issues, please open an issue in the repository with detailed information about the problem.