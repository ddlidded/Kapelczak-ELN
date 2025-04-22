#!/bin/bash
# Verification script for Dokploy deployment of Kapelczak Notes
# This script helps verify that all components are working properly

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display header
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Kapelczak Notes Deployment Verification  ${NC}"
echo -e "${BLUE}==========================================${NC}"

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed. Please install curl before proceeding.${NC}"
    exit 1
fi

# Get the deployment URL from user
echo -e "${YELLOW}Enter your Kapelczak Notes deployment URL (e.g., https://notes.example.com):${NC}"
read -r DEPLOYMENT_URL

# Remove trailing slash if present
DEPLOYMENT_URL=${DEPLOYMENT_URL%/}

echo -e "${BLUE}Testing deployment at: ${DEPLOYMENT_URL}${NC}\n"

# 1. Check if the site is accessible
echo -e "${BLUE}1. Checking site accessibility...${NC}"
if curl -s -f -o /dev/null "${DEPLOYMENT_URL}"; then
    echo -e "${GREEN}✓ Site is accessible${NC}"
else
    echo -e "${RED}✗ Site is not accessible. Please check your deployment.${NC}"
    echo -e "${YELLOW}Hint: Verify that the deployment has completed and the service is running.${NC}"
    exit 1
fi

# 2. Check health endpoint
echo -e "\n${BLUE}2. Checking health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "${DEPLOYMENT_URL}/api/health")

if [[ $HEALTH_RESPONSE == *"status"*"ok"* ]]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo -e "${YELLOW}Health response: ${HEALTH_RESPONSE}${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo -e "${YELLOW}Response: ${HEALTH_RESPONSE}${NC}"
    echo -e "${YELLOW}Hint: Check the application logs in Dokploy dashboard.${NC}"
    exit 1
fi

# 3. Check login page
echo -e "\n${BLUE}3. Checking login page...${NC}"
LOGIN_PAGE=$(curl -s "${DEPLOYMENT_URL}/auth")

if [[ $LOGIN_PAGE == *"Login"* || $LOGIN_PAGE == *"Sign In"* ]]; then
    echo -e "${GREEN}✓ Login page is accessible${NC}"
else
    echo -e "${RED}✗ Login page is not accessible or not rendering correctly${NC}"
    echo -e "${YELLOW}Hint: Check the frontend build and routing in your deployment.${NC}"
    exit 1
fi

# 4. Test admin login (optional - requires API interaction)
echo -e "\n${BLUE}4. Would you like to test admin login? (y/n)${NC}"
read -r TEST_LOGIN

if [[ "$TEST_LOGIN" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Attempting login with default admin credentials...${NC}"
    
    LOGIN_RESPONSE=$(curl -s -X POST "${DEPLOYMENT_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"demo"}')
    
    if [[ $LOGIN_RESPONSE == *"token"* ]]; then
        echo -e "${GREEN}✓ Successfully logged in with admin credentials${NC}"
        # Extract token for further testing if needed
        TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')
        echo -e "${GREEN}✓ Authentication token received${NC}"
    else
        echo -e "${RED}✗ Admin login failed${NC}"
        echo -e "${YELLOW}Response: ${LOGIN_RESPONSE}${NC}"
        echo -e "${YELLOW}Hint: Verify that the database was properly initialized with the admin user.${NC}"
        echo -e "${YELLOW}      You may need to manually create an admin user through the Dokploy console.${NC}"
    fi
fi

# 5. Database connection test
echo -e "\n${BLUE}5. Would you like to test database connection? (y/n)${NC}"
read -r TEST_DB

if [[ "$TEST_DB" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}This test requires accessing the Dokploy console and running a command inside the app container.${NC}"
    echo -e "${YELLOW}Please go to your Dokploy dashboard, select the app container, and run this command:${NC}"
    echo -e "${BLUE}node -e \"const { Pool } = require('@neondatabase/serverless'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()', (err, res) => { console.log(err ? 'Database error: ' + err.message : 'Database connected successfully: ' + res.rows[0].now); pool.end(); })\"${NC}"
    
    echo -e "\n${YELLOW}Did the database connection test succeed? (y/n)${NC}"
    read -r DB_SUCCESS
    
    if [[ "$DB_SUCCESS" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✓ Database connection verified${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        echo -e "${YELLOW}Hint: Check the PostgreSQL service in Dokploy and verify environment variables.${NC}"
    fi
fi

# 6. Email configuration test
echo -e "\n${BLUE}6. Would you like to test email configuration? (y/n)${NC}"
read -r TEST_EMAIL

if [[ "$TEST_EMAIL" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}This test requires admin login through the web interface.${NC}"
    echo -e "${YELLOW}Please log in to your application as admin, go to Settings → Email,${NC}"
    echo -e "${YELLOW}and use the 'Test Email' function there.${NC}"
    
    echo -e "\n${YELLOW}Did the email test succeed? (y/n)${NC}"
    read -r EMAIL_SUCCESS
    
    if [[ "$EMAIL_SUCCESS" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✓ Email configuration verified${NC}"
    else
        echo -e "${RED}✗ Email configuration failed${NC}"
        echo -e "${YELLOW}Hint: Check your SMTP settings in the environment variables.${NC}"
    fi
fi

# Summary
echo -e "\n${BLUE}==========================================${NC}"
echo -e "${GREEN}Kapelczak Notes Deployment Verification${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}✓ Site accessibility: PASSED${NC}"
echo -e "${GREEN}✓ Health check: PASSED${NC}"
echo -e "${GREEN}✓ Login page: PASSED${NC}"

if [[ "$TEST_LOGIN" =~ ^[Yy]$ ]]; then
    if [[ $LOGIN_RESPONSE == *"token"* ]]; then
        echo -e "${GREEN}✓ Admin login: PASSED${NC}"
    else
        echo -e "${RED}✗ Admin login: FAILED${NC}"
    fi
fi

if [[ "$TEST_DB" =~ ^[Yy]$ ]]; then
    if [[ "$DB_SUCCESS" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✓ Database connection: PASSED${NC}"
    else
        echo -e "${RED}✗ Database connection: FAILED${NC}"
    fi
fi

if [[ "$TEST_EMAIL" =~ ^[Yy]$ ]]; then
    if [[ "$EMAIL_SUCCESS" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✓ Email configuration: PASSED${NC}"
    else
        echo -e "${RED}✗ Email configuration: FAILED${NC}"
    fi
fi

echo -e "\n${BLUE}For more information and troubleshooting, refer to:${NC}"
echo -e "${YELLOW}- DOKPLOY-DEPLOYMENT.md${NC}"
echo -e "${YELLOW}- Dokploy dashboard logs and monitoring${NC}"