#!/bin/bash
# Database initialization script for Kapelczak Notes
# This script ensures the database is properly set up during deployment

set -e # Exit immediately if any command fails

# Define colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Kapelczak Notes Database Initialization  ${NC}"
echo -e "${BLUE}==========================================${NC}"

# Check for DATABASE_URL environment variable
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set.${NC}"
    echo -e "${YELLOW}Please set the DATABASE_URL environment variable and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}Using DATABASE_URL: ${DATABASE_URL}${NC}"

# Create database tables and initialize schema
echo -e "${BLUE}Creating database schema...${NC}"
npm run db:push
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create database schema. See errors above.${NC}"
    exit 1
fi
echo -e "${GREEN}Database schema created successfully!${NC}"

# Check if admin user exists
echo -e "${BLUE}Checking for admin user...${NC}"
ADMIN_CHECK=$(node -e "
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function checkAdmin() {
    try {
        const result = await db.execute(sql\`SELECT id FROM users WHERE username = 'admin'\`);
        console.log(result.length > 0 ? 'exists' : 'not-found');
    } catch (error) {
        console.error('Error checking admin:', error);
        console.log('error');
    } finally {
        await pool.end();
    }
}

checkAdmin();
")

if [ "$ADMIN_CHECK" = "error" ]; then
    echo -e "${RED}Failed to check for admin user.${NC}"
    exit 1
elif [ "$ADMIN_CHECK" = "not-found" ]; then
    echo -e "${YELLOW}Admin user not found. Creating default admin user...${NC}"
    
    # Create admin user with default credentials
    node -e "
    const { Pool, neonConfig } = require('@neondatabase/serverless');
    const { drizzle } = require('drizzle-orm/neon-serverless');
    const ws = require('ws');
    neonConfig.webSocketConstructor = ws;
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });
    
    async function createAdmin() {
        try {
            await db.execute(sql\`
                INSERT INTO users (username, email, password, displayName, role, isAdmin, isVerified)
                VALUES ('admin', 'admin@kapelczak.com', 'demo', 'Admin User', 'Administrator', true, true)
            \`);
            console.log('Admin user created successfully');
        } catch (error) {
            console.error('Error creating admin:', error);
            process.exit(1);
        } finally {
            await pool.end();
        }
    }
    
    createAdmin();
    "
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create admin user. See errors above.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Admin user created successfully!${NC}"
    echo -e "${YELLOW}Default admin credentials:${NC}"
    echo -e "${YELLOW}  Username: admin${NC}"
    echo -e "${YELLOW}  Password: demo${NC}"
    echo -e "${RED}IMPORTANT: Change the default password immediately after first login!${NC}"
else
    echo -e "${GREEN}Admin user already exists. No need to create.${NC}"
fi

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Database initialization complete!  ${NC}"
echo -e "${GREEN}================================${NC}"