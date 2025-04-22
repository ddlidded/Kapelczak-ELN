# Deploying Kapelczak Notes on Railway with Nixpacks

This is a simplified step-by-step guide for deploying Kapelczak Notes on Railway using Nixpacks. These instructions are designed to ensure a successful deployment without troubleshooting.

## Automated Deployment

For a fully automated deployment process, we've included two scripts:

1. **build.sh** - Automates the build process
2. **railway-deploy.sh** - Automates deployment to Railway

### Using the Automated Scripts

```bash
# First, make the scripts executable if they aren't already
chmod +x build.sh railway-deploy.sh

# Build the application
./build.sh

# Deploy to Railway (requires Railway CLI)
./railway-deploy.sh
```

The automated deployment script will:
- Install and configure the Railway CLI if needed
- Check for a valid Railway login
- Create a new Railway project or link to an existing one
- Provision a PostgreSQL database
- Upload environment variables from .env.production
- Deploy the application
- Provide instructions for accessing your deployment

## Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

### Prerequisites

- A Railway account (sign up at [railway.app](https://railway.app))
- A GitHub repository with your Kapelczak Notes application

### Step 1: Set Up Your Repository

Ensure your repository includes these essential files:
- `nixpacks.toml` - Configuration for the build process
- `Procfile` - Defines how to run the application
- `.nixpacks` - Additional configuration for Nixpacks
- `.env.production` - Template for environment variables

### Step 2: Create a New Project on Railway

1. Log into [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Find and select your repository
5. Railway will automatically detect the Nixpacks configuration

### Step 3: Add PostgreSQL Database

1. In your project, click "New"
2. Select "Database" → "PostgreSQL"
3. Wait for the database to be provisioned
4. Railway will automatically add the PostgreSQL connection variables to your application

### Step 4: Configure Environment Variables

1. In your project dashboard, go to the "Variables" tab
2. Add the following variables:
   ```
   NODE_ENV=production
   PORT=5000
   MAX_FILE_SIZE=1073741824
   SESSION_SECRET=generate_a_very_long_random_string_here
   ```

3. If you need email functionality, also add:
   ```
   SMTP_HOST=your.smtp.server
   SMTP_PORT=587
   SMTP_USER=your_username
   SMTP_PASSWORD=your_password
   ```

### Step 5: Deploy

1. Go to the "Deployments" tab
2. Click "Deploy Now"
3. Railway will build and deploy your application

## Accessing Your Deployed Application

After deployment is complete:

1. Go to the "Deployments" tab in your Railway dashboard
2. Click on the latest deployment to see details
3. Find and click the generated URL to access your application
4. Log in with the default credentials:
   - Username: `admin`
   - Password: `demo`
5. **IMPORTANT**: Change the admin password immediately after first login

## Setting Up a Custom Domain (Optional)

1. Go to the "Settings" tab of your service
2. Find the "Domains" section
3. Add your custom domain
4. Follow the provided instructions to verify domain ownership

## Troubleshooting

If your deployment doesn't work as expected:

1. Check your deployment logs in the "Deployments" tab
2. Ensure all environment variables are set correctly
3. Verify your database connection is working properly by checking the logs
4. Check that the health check endpoint at `/api/health` is responding properly

## File Storage Considerations

1. Railway provides ephemeral storage. Files uploaded to the local filesystem won't persist across deployments or container restarts.

2. For production use, configure S3 storage using the admin settings after logging in.

## Updating Your Deployment

To update your application:

1. Push changes to your GitHub repository
2. Railway will automatically detect the changes and redeploy your application
3. Alternatively, use `./railway-deploy.sh` for a controlled deployment process

## Monitoring

The application provides a health check endpoint at `/api/health` that returns:
```json
{
  "status": "ok",
  "timestamp": "2025-04-22T03:42:38.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

You can use this endpoint for monitoring the health of your deployment.