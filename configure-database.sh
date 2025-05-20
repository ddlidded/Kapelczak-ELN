#!/bin/bash
# Helper script for setting up database schema in Easypanel or other environments
# where drizzle-kit might not be directly available

echo "Configuring database schema for Kapelczak Notes..."

# Try npm script first
echo "Attempting database migration with npm script..."
npm run db:push

if [ $? -ne 0 ]; then
  echo "Initial migration attempt failed. Trying direct drizzle-kit command..."
  
  # Try direct drizzle-kit command
  if command -v drizzle-kit &> /dev/null; then
    drizzle-kit push
  else
    echo "drizzle-kit command not found. Trying with npx..."
    npx drizzle-kit push
  fi
  
  if [ $? -ne 0 ]; then
    echo "WARNING: All migration attempts failed."
    echo "The application will still start, but you may need to manually set up the database schema."
  else
    echo "Database schema created successfully with fallback method."
  fi
else
  echo "Database schema created successfully with npm script."
fi

exit 0