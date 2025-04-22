#!/bin/bash
# Kapelczak Notes Auto-Deployment Script
# This script automates the deployment of Kapelczak Notes on a Linux server with Docker.

set -e

# Text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                 KAPELCZAK NOTES AUTO-DEPLOY                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is installed
if ! [ -x "$(command -v docker)" ]; then
  echo -e "${RED}Error: Docker is not installed.${NC}" >&2
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  echo -e "${GREEN}Docker installed. You may need to log out and back in.${NC}"
  echo "Please run this script again after logging back in."
  exit 1
fi

# Check if Docker Compose is installed
if ! [ -x "$(command -v docker-compose)" ]; then
  echo -e "${RED}Error: Docker Compose is not installed.${NC}" >&2
  echo "Installing Docker Compose..."
  sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  echo -e "${GREEN}Docker Compose installed.${NC}"
fi

# Environment setup
echo -e "${YELLOW}Setting up environment...${NC}"

# Check if .env file exists, create if needed
if [ ! -f .env ]; then
  echo -e "${YELLOW}Creating .env file...${NC}"
  
  # Generate a random password and session secret
  DB_PASSWORD=$(openssl rand -base64 12)
  SESSION_SECRET=$(openssl rand -base64 32)
  
  cat > .env << EOF
# Database Configuration
POSTGRES_USER=kapelczak_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=kapelczak_notes

# Application Configuration
PORT=5000
NODE_ENV=production
MAX_FILE_SIZE=1073741824  # 1GB in bytes

# Security
SESSION_SECRET=${SESSION_SECRET}

# SMTP Configuration (configure manually)
# SMTP_HOST=your.smtp.host
# SMTP_PORT=587
# SMTP_USER=your_smtp_username
# SMTP_PASSWORD=your_smtp_password
EOF

  echo -e "${GREEN}.env file created with secure random credentials.${NC}"
  echo -e "${YELLOW}Please add SMTP settings manually if needed.${NC}"
else
  echo -e "${GREEN}.env file already exists. Using existing configuration.${NC}"
fi

# Build and deploy
echo -e "${YELLOW}Building and deploying application...${NC}"

# Pull latest changes if in a git repository
if [ -d .git ]; then
  echo -e "${YELLOW}Pulling latest changes...${NC}"
  git pull
fi

# Build and start containers
echo -e "${YELLOW}Building and starting containers...${NC}"
docker-compose down || true
docker-compose build
docker-compose up -d

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
  echo -e "${GREEN}Deployment successful!${NC}"
  echo -e "${BLUE}Application is running on port 5000${NC}"
  echo -e "${YELLOW}Default login credentials:${NC}"
  echo -e "  Username: ${GREEN}admin${NC}"
  echo -e "  Password: ${GREEN}demo${NC}"
  echo -e "${RED}IMPORTANT: Change the default password immediately after first login!${NC}"
  
  # Get server IP address for convenience
  SERVER_IP=$(hostname -I | awk '{print $1}')
  echo -e "${BLUE}Access the application at: http://${SERVER_IP}:5000${NC}"
else
  echo -e "${RED}Deployment failed. Check logs with: docker-compose logs${NC}"
  exit 1
fi

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                DEPLOYMENT COMPLETED SUCCESSFULLY               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"