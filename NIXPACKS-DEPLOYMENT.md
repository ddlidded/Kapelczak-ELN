# Kapelczak Notes - Nixpacks Deployment Guide

This guide provides detailed instructions for deploying Kapelczak Notes using Nixpacks, which allows for automated deployment on various platforms including Railway, Render, and other Nixpacks-compatible services.

## What is Nixpacks?

Nixpacks is a build system that combines the best parts of Heroku buildpacks with the reproducibility of Nix. It automatically detects your application's dependencies and creates optimized Docker images.

## Prerequisites

- A Nixpacks-compatible deployment platform (Railway, Render, etc.)
- Git repository with your Kapelczak Notes application code
- PostgreSQL database (can be provisioned on the same platform)

## Deployment Files

The following files have been included to make Nixpacks deployment smooth:

- `nixpacks.toml` - Configuration for the Nixpacks build process
- `Procfile` - Defines the command to run the application
- `.env.production` - Template for environment variables (do not include secrets here)

## Step-by-Step Deployment Instructions

### 1. Prepare Your Repository

Ensure your repository includes:
- All application code
- The `nixpacks.toml` file
- The `Procfile` file

### 2. Deploy on Railway

1. **Create a new project**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Add a PostgreSQL database**
   - In your project, click "New"
   - Select "Database" → "PostgreSQL"
   - Wait for the database to be provisioned

3. **Configure environment variables**
   - In your project settings, go to "Variables"
   - Add the following variables:
     ```
     NODE_ENV=production
     PORT=5000
     MAX_FILE_SIZE=1073741824
     SESSION_SECRET=<generate-a-long-random-string>
     SMTP_HOST=<your-smtp-host>
     SMTP_PORT=<your-smtp-port>
     SMTP_USER=<your-smtp-username>
     SMTP_PASSWORD=<your-smtp-password>
     ```
   - Railway will automatically add the DATABASE_URL variable

4. **Deploy the application**
   - Railway will automatically detect Nixpacks configuration
   - Click "Deploy" in the Deployments tab

### 3. Deploy on Render

1. **Create a new Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Web Service"
   - Connect to your GitHub repository

2. **Configure the service**
   - Name: "kapelczak-notes"
   - Build Command: Leave empty (Nixpacks will handle this)
   - Start Command: Leave empty (Procfile will be used)
   - Select "Advanced" and choose "nixpacks" as the build method

3. **Add a PostgreSQL database**
   - In your Render dashboard, go to "New" → "PostgreSQL"
   - Set up a new database and note the connection details

4. **Configure environment variables**
   - In your Web Service settings, go to "Environment"
   - Add the same environment variables as listed for Railway, plus:
     ```
     DATABASE_URL=<your-render-postgresql-connection-url>
     ```

5. **Deploy the service**
   - Click "Create Web Service"
   - Render will build and deploy your application

## Post-Deployment Configuration

### Initial Login

After deployment, access the application using the default credentials:
- Username: `admin`
- Password: `demo`

**Important**: Change the admin password immediately after first login!

### Persistent Storage

For file uploads to persist, you need a permanent storage solution:

1. **Configure S3 storage** (recommended)
   - After logging in as admin, go to your profile settings
   - Configure S3-compatible storage with your credentials
   - All file uploads will be stored in S3

2. **Alternative: Use local storage**
   - Note that with Nixpacks deployments, local file storage may not persist between deployments
   - Use this only for testing or if you have configured a persistent volume

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | Yes | - |
| `PORT` | Port for the web server | No | 5000 |
| `NODE_ENV` | Environment mode | No | production |
| `MAX_FILE_SIZE` | Maximum file upload size in bytes | No | 1073741824 (1GB) |
| `SESSION_SECRET` | Secret for session encryption | Yes | - |
| `SMTP_HOST` | SMTP server hostname | For email | - |
| `SMTP_PORT` | SMTP server port | For email | 587 |
| `SMTP_USER` | SMTP username | For email | - |
| `SMTP_PASSWORD` | SMTP password | For email | - |

## Troubleshooting

If you encounter issues, check:

1. **Database Connection**
   - Verify the `DATABASE_URL` is correctly formatted
   - Ensure the database is accessible from your deployment service

2. **Build Failures**
   - Check the build logs provided by your deployment platform
   - Verify that Nixpacks is properly detecting your Node.js application

3. **Runtime Errors**
   - Check application logs on your deployment platform
   - Verify all required environment variables are set

## Updating the Application

To update your deployed application:

1. Push changes to your GitHub repository
2. Your deployment platform will automatically rebuild and redeploy
3. No additional steps are required

## Health Checks

The application provides a health check endpoint at `/api/health` that returns:
```json
{
  "status": "ok",
  "timestamp": "2025-04-21T19:00:00.000Z"
}
```

Configure your deployment platform to use this endpoint for health monitoring.