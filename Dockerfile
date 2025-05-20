# Multi-stage build for the Kapelczak Notes application

# Build stage
FROM node:20-alpine AS build

# Install curl for healthchecks and build dependencies
RUN apk add --no-cache curl python3 make g++ 

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies including puppeteer dependencies
RUN apk add --no-cache curl chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Create app directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files for production dependencies
COPY package*.json ./

# Install production dependencies and drizzle-kit globally for migrations
RUN npm ci --only=production && npm install -g drizzle-kit

# Create uploads directory
RUN mkdir -p uploads
RUN chmod 755 uploads

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/setup-admin.js ./setup-admin.js

# Copy any necessary configuration files
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set up a healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Expose application port
EXPOSE 5000

# Set entry point
ENTRYPOINT ["/docker-entrypoint.sh"]

# Set default command to start the application
CMD ["node", "dist/index.js"]