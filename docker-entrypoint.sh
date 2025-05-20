#!/bin/sh
set -e

# Environment variables
export NODE_ENV=production
export PORT=5000

echo "========================================="
echo "Starting Kapelczak Notes Application"
echo "========================================="

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Using default PostgreSQL connection."
  # Use default connection to the bundled PostgreSQL container
  export DATABASE_URL="postgresql://${POSTGRES_USER:-kapelczak_user}:${POSTGRES_PASSWORD:-password}@postgres:5432/${POSTGRES_DB:-kapelczak_notes}"
  echo "Using DATABASE_URL: ${DATABASE_URL}"
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "WARNING: SESSION_SECRET is not set. Using default session secret."
  export SESSION_SECRET="defaultsecretchangeme"
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if nc -z postgres 5432; then
    echo "PostgreSQL is ready!"
    break
  fi
  
  echo "Waiting for PostgreSQL... ($i/30)"
  sleep 1
  
  if [ $i -eq 30 ]; then
    echo "Error: PostgreSQL did not become ready in time."
    echo "Please check your database configuration."
    exit 1
  fi
done

# Push database schema
echo "Setting up database schema..."
NODE_OPTIONS="--experimental-specifier-resolution=node" node -e "
const {spawn} = require('child_process');
const proc = spawn('npm', ['run', 'db:push']);
proc.stdout.pipe(process.stdout);
proc.stderr.pipe(process.stderr);
proc.on('close', (code) => {
  if (code !== 0) {
    console.error('Failed to push database schema. Exit code:', code);
    process.exit(code);
  }
  console.log('Database schema created successfully');
});
"

# Create admin user if needed
echo "Setting up admin user..."
node setup-admin.js || {
  echo "WARNING: Failed to create admin user. You may need to create one manually."
}

echo "----------------------------------------"
echo "Kapelczak Notes is now starting..."
echo "----------------------------------------"

# Execute the main command
exec "$@"