# Base image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all files
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine

# Install Puppeteer dependencies for PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig

# Set environment variable for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/assets ./server/assets

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chmod 777 uploads

# Create health check script
RUN echo '#!/bin/sh\ncurl -f http://localhost:5000/api/health || exit 1' > /healthcheck.sh && \
    chmod +x /healthcheck.sh

# Expose the port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV MAX_FILE_SIZE=1073741824

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD [ "/healthcheck.sh" ]

# Run the application
CMD ["node", "dist/index.js"]