#!/bin/bash
# Master deployment script for Kapelczak Notes
# This script automates the entire deployment process

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to display a step banner
function display_step() {
  echo -e "\n${BLUE}=====================================================${NC}"
  echo -e "${BLUE}  STEP $1: $2${NC}"
  echo -e "${BLUE}=====================================================${NC}\n"
}

# Function to handle errors
function handle_error() {
  echo -e "\n${RED}ERROR: Deployment failed at step $1${NC}"
  echo -e "${RED}$2${NC}"
  exit 1
}

# Display welcome banner
echo -e "\n${PURPLE}=====================================================${NC}"
echo -e "${PURPLE}             KAPELCZAK NOTES DEPLOYMENT              ${NC}"
echo -e "${PURPLE}=====================================================${NC}"
echo -e "${CYAN}This script will automate the deployment of Kapelczak Notes${NC}"
echo -e "${CYAN}The following steps will be performed:${NC}"
echo -e "${CYAN}  1. Verify prerequisites${NC}"
echo -e "${CYAN}  2. Build the application${NC}"
echo -e "${CYAN}  3. Initialize database${NC}"
echo -e "${CYAN}  4. Deploy to platform${NC}"
echo -e "${CYAN}  5. Verify deployment${NC}\n"

# Ask for confirmation
echo -e "${YELLOW}Do you want to continue? (y/n)${NC}"
read -r continue_choice
if [[ ! "$continue_choice" =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Deployment canceled.${NC}"
  exit 0
fi

# Step 1: Verify prerequisites
display_step "1" "Verifying prerequisites"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  handle_error "1" "Node.js is not installed. Please install Node.js before proceeding."
fi

# Display Node.js and npm versions
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ Using Node.js ${NODE_VERSION} and npm ${NPM_VERSION}${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
  handle_error "1" "Git is not installed. Please install Git before proceeding."
fi
echo -e "${GREEN}✓ Git is installed${NC}"

# Check for .env.production file
if [ ! -f .env.production ]; then
  echo -e "${YELLOW}Warning: .env.production file not found!${NC}"
  echo -e "${YELLOW}Would you like to create a basic .env.production file? (y/n)${NC}"
  read -r create_env
  
  if [[ "$create_env" =~ ^[Yy]$ ]]; then
    # Create a basic .env.production file
    cat > .env.production << EOL
# Database Configuration
DATABASE_URL=postgresql://kapelczak_user:your_secure_password@localhost:5432/kapelczak_notes

# Application Configuration
PORT=5000
NODE_ENV=production

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=1073741824  # 1GB limit for file uploads

# Security Configuration
SESSION_SECRET=replace_with_secure_random_string_in_production

# SMTP Configuration (for email features)
SMTP_HOST=your-smtp-host.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
EOL
    
    echo -e "${GREEN}✓ Created default .env.production file${NC}"
    echo -e "${YELLOW}Please update the file with your actual configuration values.${NC}"
    echo -e "${YELLOW}Press Enter to continue or Ctrl+C to abort and edit the .env.production file...${NC}"
    read -r
  else
    handle_error "1" "No .env.production file found. Please create one before proceeding."
  fi
else
  echo -e "${GREEN}✓ .env.production file exists${NC}"
fi

# Check if deployment scripts are executable
for script in build.sh init-db.sh railway-deploy.sh; do
  if [ ! -x "$script" ]; then
    echo -e "${YELLOW}Making $script executable...${NC}"
    chmod +x "$script"
  fi
done
echo -e "${GREEN}✓ All deployment scripts are executable${NC}"

# Step 2: Build the application
display_step "2" "Building the application"
echo -e "${YELLOW}This step will execute build.sh to build the application.${NC}"
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r build_choice
if [[ "$build_choice" =~ ^[Yy]$ ]]; then
  ./build.sh || handle_error "2" "Build process failed. Check the error messages above."
  echo -e "${GREEN}✓ Application built successfully${NC}"
else
  echo -e "${YELLOW}Build step skipped.${NC}"
fi

# Step 3: Initialize the database
display_step "3" "Initializing the database"
echo -e "${YELLOW}This step will execute init-db.sh to set up the database.${NC}"
echo -e "${YELLOW}NOTE: This requires a valid DATABASE_URL environment variable.${NC}"
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r db_choice
if [[ "$db_choice" =~ ^[Yy]$ ]]; then
  # Source .env.production to get DATABASE_URL if not already set
  if [ -z "$DATABASE_URL" ]; then
    export $(grep -v '^#' .env.production | grep DATABASE_URL)
  fi
  
  if [ -z "$DATABASE_URL" ]; then
    handle_error "3" "DATABASE_URL environment variable is not set."
  fi
  
  ./init-db.sh || handle_error "3" "Database initialization failed. Check the error messages above."
  echo -e "${GREEN}✓ Database initialized successfully${NC}"
else
  echo -e "${YELLOW}Database initialization step skipped.${NC}"
fi

# Step 4: Deploy to platform
display_step "4" "Deploying to platform"
echo -e "${YELLOW}Where would you like to deploy? Choose a platform:${NC}"
echo -e "${YELLOW}1. Railway (Automated with railway-deploy.sh)${NC}"
echo -e "${YELLOW}2. Render (Manual steps)${NC}"
echo -e "${YELLOW}3. Custom server (Manual steps)${NC}"
echo -e "${YELLOW}4. Skip deployment${NC}"
read -r deploy_choice

case $deploy_choice in
  1)
    echo -e "${BLUE}Deploying to Railway...${NC}"
    ./railway-deploy.sh || handle_error "4" "Railway deployment failed. Check the error messages above."
    echo -e "${GREEN}✓ Application deployed to Railway${NC}"
    ;;
  2)
    echo -e "${BLUE}For Render deployment:${NC}"
    echo -e "${CYAN}1. Create a Render account if you don't have one${NC}"
    echo -e "${CYAN}2. Connect your Git repository to Render${NC}"
    echo -e "${CYAN}3. Create a new Web Service, selecting 'Nixpacks' as the build method${NC}"
    echo -e "${CYAN}4. Configure environment variables in the Render dashboard${NC}"
    echo -e "${CYAN}5. Deploy your application${NC}"
    echo -e "${YELLOW}Please refer to NIXPACKS-DEPLOYMENT.md for detailed instructions.${NC}"
    ;;
  3)
    echo -e "${BLUE}For custom server deployment:${NC}"
    echo -e "${CYAN}1. Install Nixpacks: curl -sSL https://nixpacks.com/install.sh | bash${NC}"
    echo -e "${CYAN}2. Build the application: nixpacks build . --name kapelczak-notes${NC}"
    echo -e "${CYAN}3. Run the container: docker run -p 5000:5000 --env-file .env.production kapelczak-notes${NC}"
    echo -e "${YELLOW}Please refer to NIXPACKS-README.md for detailed instructions.${NC}"
    ;;
  4)
    echo -e "${YELLOW}Deployment step skipped.${NC}"
    ;;
  *)
    echo -e "${RED}Invalid choice. Deployment step skipped.${NC}"
    ;;
esac

# Step 5: Verify deployment
display_step "5" "Deployment verification"
echo -e "${BLUE}Please verify your deployment by:${NC}"
echo -e "${CYAN}1. Accessing the application URL${NC}"
echo -e "${CYAN}2. Logging in with default credentials (admin/demo)${NC}"
echo -e "${CYAN}3. Changing the default password immediately${NC}"
echo -e "${CYAN}4. Configuring S3 storage for file persistence${NC}"
echo -e "${PURPLE}===========================================${NC}"
echo -e "${GREEN}DEPLOYMENT PROCESS COMPLETE!${NC}"
echo -e "${PURPLE}===========================================${NC}"
echo -e "${YELLOW}For more information, refer to the following files:${NC}"
echo -e "${YELLOW}- NIXPACKS-README.md${NC}"
echo -e "${YELLOW}- NIXPACKS-DEPLOYMENT.md${NC}"
echo -e "${YELLOW}- NIXPACKS-RAILWAY-DEPLOYMENT.md${NC}"