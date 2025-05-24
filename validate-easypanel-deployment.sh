#!/bin/bash

# Kapelczak Notes - Easypanel Deployment Validation Script
# This script validates that all components are ready for Easypanel deployment

set -e

echo "🔍 Validating Easypanel Deployment Configuration..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check required files
echo "📋 Checking required deployment files..."

required_files=(
    "docker-compose.yml"
    "Dockerfile" 
    "docker-entrypoint.sh"
    "README-EASYPANEL-DEPLOYMENT.md"
    "easypanel-template.json"
    ".env.example"
    "nginx.conf"
    "init-db.sql"
)

all_files_present=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        success "Found $file"
    else
        error "Missing: $file"
        all_files_present=false
    fi
done

if [ "$all_files_present" = false ]; then
    error "Missing required files for deployment"
    exit 1
fi

# Validate Docker Compose syntax
echo ""
echo "🐳 Validating Docker Compose configuration..."

# Check if docker-compose.yml has required services
if grep -q "kapelczak-notes:" docker-compose.yml && \
   grep -q "postgres:" docker-compose.yml; then
    success "Docker Compose services configured correctly"
else
    error "Docker Compose missing required services"
    exit 1
fi

# Check health checks
if grep -q "healthcheck:" docker-compose.yml; then
    success "Health checks configured"
else
    warning "Health checks not found in Docker Compose"
fi

# Validate environment variables
echo ""
echo "⚙️  Validating environment configuration..."

if [ -f ".env.example" ]; then
    if grep -q "POSTGRES_PASSWORD" .env.example && \
       grep -q "SESSION_SECRET" .env.example; then
        success "Required environment variables defined"
    else
        error "Missing required environment variables in .env.example"
        exit 1
    fi
else
    error ".env.example file missing"
    exit 1
fi

# Check Dockerfile structure
echo ""
echo "📦 Validating Dockerfile..."

if grep -q "FROM node:" Dockerfile && \
   grep -q "COPY package" Dockerfile && \
   grep -q "RUN npm ci" Dockerfile; then
    success "Dockerfile structure is valid"
else
    error "Dockerfile missing required components"
    exit 1
fi

# Validate application structure
echo ""
echo "🏗️  Validating application structure..."

required_dirs=(
    "client"
    "server" 
    "shared"
)

for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        success "Directory $dir exists"
    else
        error "Missing directory: $dir"
        exit 1
    fi
done

# Check package.json
if [ -f "package.json" ]; then
    if grep -q "\"build\":" package.json; then
        success "Build script configured in package.json"
    else
        warning "Build script not found in package.json"
    fi
    
    if grep -q "\"dev\":" package.json; then
        success "Development script configured"
    else
        warning "Development script not found"
    fi
else
    error "package.json missing"
    exit 1
fi

# Validate database schema
echo ""
echo "🗄️  Validating database configuration..."

if [ -f "shared/schema.ts" ]; then
    success "Database schema file exists"
else
    error "Database schema missing"
    exit 1
fi

if [ -f "drizzle.config.ts" ] || [ -f "drizzle.config.json" ]; then
    success "Drizzle configuration exists"
else
    warning "Drizzle configuration not found"
fi

# Check deployment documentation
echo ""
echo "📚 Validating documentation..."

if [ -f "README-EASYPANEL-DEPLOYMENT.md" ]; then
    if grep -q "Prerequisites" README-EASYPANEL-DEPLOYMENT.md && \
       grep -q "Environment Variables" README-EASYPANEL-DEPLOYMENT.md; then
        success "Deployment documentation is comprehensive"
    else
        warning "Deployment documentation may be incomplete"
    fi
else
    error "Deployment documentation missing"
    exit 1
fi

# Generate deployment summary
echo ""
echo "=================================================="
echo "🎯 Deployment Summary"
echo "=================================================="
echo "✅ All required files present"
echo "✅ Docker configuration validated"
echo "✅ Application structure verified"
echo "✅ Database configuration checked"
echo "✅ Documentation available"
echo ""
echo "🚀 Ready for Easypanel deployment!"
echo ""
echo "Next steps:"
echo "1. Push code to your Git repository"
echo "2. Create new project in Easypanel"
echo "3. Select 'Docker Compose' deployment type"
echo "4. Configure environment variables"
echo "5. Deploy and enjoy!"
echo ""
echo "📖 Full instructions: README-EASYPANEL-DEPLOYMENT.md"

# Test environment variable loading
echo ""
echo "🧪 Testing configuration loading..."

if [ -f ".env.example" ]; then
    # Create a temporary .env for testing
    cp .env.example .env.test
    
    # Source the test environment
    if source .env.test 2>/dev/null; then
        success "Environment variables load correctly"
    else
        warning "Environment variable format may have issues"
    fi
    
    # Clean up
    rm -f .env.test
fi

echo ""
success "🎉 Easypanel deployment validation complete!"
echo ""