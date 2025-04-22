# Deploying Kapelczak Notes on Railway with Nixpacks

This is a simplified step-by-step guide for deploying Kapelczak Notes on Railway using Nixpacks. These instructions are designed to ensure a successful deployment without troubleshooting.

## Prerequisites

- A Railway account (sign up at [railway.app](https://railway.app))
- A GitHub repository with your Kapelczak Notes application

## Step 1: Set Up Your Repository

Ensure your repository includes these essential files:
- `nixpacks.toml` - Configuration for the build process
- `Procfile` - Defines how to run the application
- `.nixpacks` - Additional configuration for Nixpacks
- `.env.production` - Template for environment variables

## Step 2: Create a New Project on Railway

1. Log into [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Find and select your repository
5. Railway will automatically detect the Nixpacks configuration

## Step 3: Add PostgreSQL Database

1. In your project, click "New"
2. Select "Database" → "PostgreSQL"
3. Wait for the database to be provisioned
4. Railway will automatically add the PostgreSQL connection variables to your application

## Step 4: Configure Environment Variables

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

## Step 5: Deploy

1. Go to the "Deployments" tab
2. Click "Deploy Now"
3. Railway will build and deploy your application

## Step 6: Set Up Custom Domain (Optional)

1. Go to the "Settings" tab of your service
2. Find the "Domains" section
3. Add your custom domain
4. Follow the provided instructions to verify domain ownership

## Step 7: Initial Login

1. After deployment completes, open your application URL
2. Log in with the default credentials:
   - Username: `admin`
   - Password: `demo`
3. **IMPORTANT**: Change the admin password immediately after first login

## Troubleshooting

If your deployment doesn't work as expected:

1. Check your deployment logs in the "Deployments" tab
2. Ensure all environment variables are set correctly
3. Verify your database connection is working properly by checking the logs

## Notes About File Storage

1. Railway provides ephemeral storage. Files uploaded to the local filesystem won't persist across deployments or container restarts.

2. For production use, configure S3 storage using the admin settings after logging in.

## Updating Your Deployment

To update your application:

1. Push changes to your GitHub repository
2. Railway will automatically detect the changes and redeploy your application

That's it! Your Kapelczak Notes application should be successfully deployed on Railway.