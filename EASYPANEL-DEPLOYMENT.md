# Kapelczak Notes - Easypanel Deployment Guide

This guide provides step-by-step instructions for deploying Kapelczak Notes on your server using Easypanel, a modern server control panel that simplifies Docker-based application deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Environment Configuration](#environment-configuration)
4. [Post-Installation](#post-installation)
5. [Maintenance](#maintenance)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:

- A server running Easypanel (see [Easypanel Installation](https://easypanel.io/docs/installation) if needed)
- Access to the Easypanel dashboard
- Domain name (optional but recommended)
- SMTP credentials for email functionality (optional)

## Installation Steps

### Option 1: Using Docker Compose Template (Recommended)

1. **Access Easypanel Dashboard**
   - Log in to your Easypanel dashboard

2. **Create a New Project**
   - Click "New Project" in your Easypanel dashboard
   - Select "Docker Compose"
   - Provide a name for your project (e.g., "kapelczak-notes")

3. **Upload or Paste the Docker Compose Configuration**
   - Copy the content of the [docker-compose.yml](docker-compose.yml) file in this repository
   - Paste it into the Docker Compose template field in Easypanel

4. **Configure Environment Variables**
   - Set the following required environment variables:
     - `SESSION_SECRET`: A random secret string for session encryption
     - `POSTGRES_USER`: Username for PostgreSQL (default: kapelczak_user)
     - `POSTGRES_PASSWORD`: A secure password for PostgreSQL 
     - `POSTGRES_DB`: Database name (default: kapelczak_notes)
   
   - Set optional environment variables:
     - `SMTP_HOST`: Your SMTP server host
     - `SMTP_PORT`: Your SMTP server port
     - `SMTP_USER`: Your SMTP username
     - `SMTP_PASSWORD`: Your SMTP password

5. **Configure Networking**
   - Set the public port to 5000 or map it to port 80
   - Enable HTTPS if you have a domain configured

6. **Deploy the Project**
   - Click "Deploy" to start the deployment process
   - Easypanel will pull the necessary images and start the containers

### Option 2: Manual Multi-Container Setup

1. **Create PostgreSQL Database Container**
   - Click "New Project" in your Easypanel dashboard
   - Select "App" from the templates
   - Search for "postgres" and select the official PostgreSQL image
   - Configure environment variables:
     - `POSTGRES_USER`: Username for PostgreSQL (e.g., kapelczak_user)
     - `POSTGRES_PASSWORD`: A secure password
     - `POSTGRES_DB`: Database name (e.g., kapelczak_notes)
   - Create a volume for database persistence
   - Deploy the database container

2. **Create Kapelczak Notes Application Container**
   - Click "New Project" again
   - Select "Dockerfile" template
   - Upload or paste the content of the [Dockerfile](Dockerfile) from this repository
   - Configure environment variables:
     - `NODE_ENV`: Set to "production"
     - `PORT`: Set to 5000
     - `SESSION_SECRET`: A random string for session encryption
     - `DATABASE_URL`: The PostgreSQL connection URL pointing to your database container
     - SMTP settings if needed
   - Create a volume for uploads persistence
   - Deploy the application container

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | Secret key for session encryption | `random_string_here` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://kapelczak_user:password@postgres:5432/kapelczak_notes` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.example.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `user` |
| `SMTP_PASSWORD` | SMTP password | `password` |
| `POSTGRES_USER` | PostgreSQL username | `kapelczak_user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `password` |
| `POSTGRES_DB` | PostgreSQL database name | `kapelczak_notes` |

## Post-Installation

After deployment, follow these steps:

1. **Access Your Application**
   - Open your browser and navigate to your application URL

2. **First Login**
   - Log in with the default admin credentials:
     - Username: `admin`
     - Password: `demo`
   - **IMPORTANT:** Change the default password immediately after login

3. **Configure SMTP Settings**
   - Go to Settings → Email in the application
   - Verify your SMTP configuration is working by sending a test email

## Maintenance

### Backing Up Your Data

Easypanel makes it easy to back up your application data:

1. **Database Backup**
   - In Easypanel, navigate to the PostgreSQL container
   - Click on "Volumes" tab
   - Use the "Backup" option to download a backup of your database

2. **Upload Files Backup**
   - Navigate to the Kapelczak Notes application container
   - Click on "Volumes" tab
   - Backup the uploads volume similarly

### Updating the Application

When a new version is available:

1. In Easypanel, navigate to your Kapelczak Notes project
2. Click "Redeploy" to pull the latest image and restart the containers
3. Verify the application is working correctly after the update

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check if the PostgreSQL container is running
   - Verify the `DATABASE_URL` environment variable is correct
   - Check container networking to ensure the application can reach the database

2. **Email Sending Failure**
   - Verify SMTP credentials in the environment variables
   - Test the SMTP connection in the application settings
   - Check network rules to ensure email ports are not blocked

3. **Container Starting Issues**
   - Check the container logs in Easypanel for error messages
   - Ensure all required environment variables are properly set
   - Verify that volumes are properly mounted and have sufficient permissions

### Checking Logs

To view application logs:

1. In Easypanel, navigate to your Kapelczak Notes project
2. Click on the "Logs" tab to view real-time logs
3. Look for error messages that might indicate the source of any issues

### Reset Admin Password

If you lose access to the admin account:

1. Connect to the application container via Easypanel's terminal
2. Run the following command to reset the admin password:
   ```
   node setup-admin.js
   ```
3. This will create or reset the admin user with default credentials

## Support

If you encounter any issues during deployment or operation:

1. Check the application logs for error messages
2. Review this guide for troubleshooting steps
3. Consult the Easypanel documentation for platform-specific concerns