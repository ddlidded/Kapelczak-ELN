#!/bin/bash
# Automated deployment script for Kapelczak Notes on Railway using Nixpacks
# This script handles the deployment process to Railway.app

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Kapelczak Notes Railway Deployment  ${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}Railway CLI not found. Installing...${NC}"
    npm i -g @railway/cli
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install Railway CLI. Please install it manually with 'npm i -g @railway/cli'${NC}"
        exit 1
    fi
    echo -e "${GREEN}Railway CLI installed successfully!${NC}"
fi

# Check if user is logged in to Railway
echo -e "${BLUE}Checking Railway authentication...${NC}"
railway whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Not logged in to Railway. Please login:${NC}"
    railway login
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to login to Railway.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Successfully logged in to Railway!${NC}"
fi

# Ensure .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo -e "${YELLOW}Please create .env.production with required environment variables.${NC}"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo -e "${RED}Not in a git repository. Please run this script from your project root.${NC}"
    exit 1
fi

# Ensure all changes are committed
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}You have uncommitted changes. Committing them now...${NC}"
    git add .
    git commit -m "Auto-commit for Railway deployment"
    echo -e "${GREEN}Changes committed successfully!${NC}"
fi

# Check if the current project is linked to Railway
echo -e "${BLUE}Checking Railway project link...${NC}"
railway status &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}This directory is not linked to a Railway project.${NC}"
    echo -e "${YELLOW}Do you want to create a new project or link to an existing one? (new/link)${NC}"
    read project_choice
    
    if [ "$project_choice" = "new" ]; then
        echo -e "${BLUE}Creating new Railway project...${NC}"
        railway init
    else
        echo -e "${BLUE}Linking to existing Railway project...${NC}"
        railway link
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to set up Railway project.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Railway project setup complete!${NC}"
fi

# Ensure PostgreSQL database is provisioned
echo -e "${BLUE}Checking PostgreSQL database...${NC}"
if ! railway variables | grep -q "DATABASE_URL"; then
    echo -e "${YELLOW}PostgreSQL database not detected. Creating a new one...${NC}"
    railway add --plugin postgresql
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to provision PostgreSQL. Please add it manually in the Railway dashboard.${NC}"
        echo -e "${YELLOW}After adding, run this script again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}PostgreSQL successfully provisioned!${NC}"
fi

# Upload essential environment variables from .env.production
echo -e "${BLUE}Setting up environment variables...${NC}"
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ $line == \#* ]] || [[ -z $line ]]; then
        continue
    fi
    
    # Extract variable name and value
    var_name=$(echo "$line" | cut -d= -f1)
    var_value=$(echo "$line" | cut -d= -f2-)
    
    # Skip DATABASE_URL as it's automatically set by the PostgreSQL plugin
    if [ "$var_name" = "DATABASE_URL" ]; then
        continue
    fi
    
    # Skip sensitive credentials that should be set manually
    if [[ "$var_name" == *PASSWORD* ]] || [[ "$var_name" == *SECRET* ]]; then
        echo -e "${YELLOW}Skipping sensitive variable: $var_name (please set this manually in Railway dashboard)${NC}"
        continue
    fi
    
    echo -e "${BLUE}Setting $var_name...${NC}"
    railway variables set "$var_name=$var_value" --quiet
done < .env.production

echo -e "${GREEN}Environment variables uploaded!${NC}"

# Deploy to Railway
echo -e "${BLUE}Starting deployment to Railway...${NC}"
railway up
if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed. Please check the logs above for errors.${NC}"
    exit 1
fi

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}  Deployment completed successfully!${NC}"
echo -e "${GREEN}==================================${NC}"
echo -e "${BLUE}To access your deployed application:${NC}"
echo -e "${YELLOW}1. Go to your Railway dashboard: https://railway.app/dashboard${NC}"
echo -e "${YELLOW}2. Select your project${NC}"
echo -e "${YELLOW}3. Click on the 'Deployments' tab${NC}"
echo -e "${YELLOW}4. Click on the latest deployment to see the live URL${NC}"
echo ""
echo -e "${BLUE}Remember to set these sensitive variables manually in the Railway dashboard:${NC}"
echo -e "${YELLOW}- SESSION_SECRET (generate a secure random string)${NC}"
echo -e "${YELLOW}- SMTP_PASSWORD (if email functionality is needed)${NC}"
echo ""
echo -e "${BLUE}Default login credentials:${NC}"
echo -e "${YELLOW}- Username: admin${NC}"
echo -e "${YELLOW}- Password: demo${NC}"
echo -e "${RED}IMPORTANT: Change the default password immediately after first login!${NC}"