#!/bin/bash

# Run the admin user creation script
echo "Creating admin user..."
node -r tsx/cjs server/scripts/createAdminUser.js
