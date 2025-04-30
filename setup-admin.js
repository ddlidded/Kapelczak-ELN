#!/usr/bin/env node

/**
 * Standalone Admin User Setup Script for Kapelczak Notes
 * 
 * This script is designed to work in any Node.js environment, regardless of
 * whether it's ESM or CommonJS. It creates an admin user if one doesn't exist.
 * 
 * Usage:
 *   node setup-admin.js
 * 
 * Requires:
 *   - DATABASE_URL environment variable to be set
 */

// Determine if we're running as ESM or CommonJS
const isESM = typeof require === 'undefined';

// Dynamically import or require based on module system
async function main() {
  let pg, crypto;
  
  if (isESM) {
    console.log('Running in ESM mode');
    // Dynamic imports for ESM
    pg = await import('pg');
    crypto = await import('crypto');
  } else {
    console.log('Running in CommonJS mode');
    // CommonJS requires
    pg = require('pg');
    crypto = require('crypto');
  }
  
  const { Pool } = pg;

  // Get database connection string from environment variables
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.');
    console.error('   Please set it before running this script:');
    console.error('   export DATABASE_URL="postgresql://username:password@hostname:port/database"');
    process.exit(1);
  }

  console.log('🔄 Checking database connection...');
  console.log(`   Using connection string: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

  // Create a PostgreSQL client
  const pool = new Pool({ connectionString });

  // Simple password hashing function for the admin user
  function hashPassword(password) {
    if (isESM) {
      return crypto.createHash('sha256').update(password).digest('hex');
    } else {
      return crypto.createHash('sha256').update(password).digest('hex');
    }
  }

  // Get table schema to check column names
  async function getUserTableColumns(client) {
    try {
      // First check if the users table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        )
      `;
      const tableCheckResult = await client.query(tableCheckQuery);
      
      if (!tableCheckResult.rows[0].exists) {
        console.error('❌ Error: "users" table does not exist in the database.');
        console.error('   Please ensure the schema has been properly created with:');
        console.error('   npm run db:push');
        process.exit(1);
      }
      
      const columnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `;
      const columnsResult = await client.query(columnsQuery);
      return columnsResult.rows.map(row => row.column_name);
    } catch (error) {
      console.error('❌ Error getting table schema:', error.message);
      return [];
    }
  }

  async function createAdminUser() {
    let client;
    
    try {
      client = await pool.connect();
      console.log('✅ Successfully connected to database');
      
      // Check if admin user already exists
      const checkResult = await client.query("SELECT id FROM users WHERE username = 'admin'");
      
      if (checkResult.rows.length > 0) {
        console.log('✅ Admin user already exists. No action needed.');
        return;
      }
      
      console.log('⏳ Creating admin user...');
      
      // Hash the password for the admin user
      const hashedPassword = hashPassword('demo');
      
      // Get column names to handle column casing variations
      const columns = await getUserTableColumns(client);
      console.log('📋 Available columns in users table:', columns);
      
      // Check for displayName or display_name column
      const displayNameColumn = columns.find(col => 
        col.toLowerCase() === 'displayname' || col.toLowerCase() === 'display_name'
      );
      
      // Check for isAdmin or is_admin column
      const isAdminColumn = columns.find(col => 
        col.toLowerCase() === 'isadmin' || col.toLowerCase() === 'is_admin'
      );
      
      // Check for isVerified or is_verified column
      const isVerifiedColumn = columns.find(col => 
        col.toLowerCase() === 'isverified' || col.toLowerCase() === 'is_verified'
      );
      
      // Create admin user with default credentials - using dynamic SQL to handle column variations
      let insertSQL;
      let insertValues;
      
      // Build the column list dynamically based on what exists in the database
      let columnList = [`username`, `email`, `password`, `role`];
      let valuesList = [`'admin'`, `'admin@kapelczak.com'`, `$1`, `'Administrator'`];
      
      // Add displayName if it exists
      if (displayNameColumn) {
        columnList.push(`"${displayNameColumn}"`);
        valuesList.push(`'Admin User'`);
      }
      
      // Add isAdmin if it exists
      if (isAdminColumn) {
        columnList.push(`"${isAdminColumn}"`);
        valuesList.push(`true`);
      }
      
      // Add isVerified if it exists
      if (isVerifiedColumn) {
        columnList.push(`"${isVerifiedColumn}"`);
        valuesList.push(`true`);
      }
      
      insertSQL = `
        INSERT INTO users (
          ${columnList.join(', ')}
        ) VALUES (
          ${valuesList.join(', ')}
        ) RETURNING id
      `;
      
      console.log('🔍 Generated SQL:', insertSQL.replace('$1', '[HASHED_PASSWORD]'));
      const createResult = await client.query(insertSQL, [hashedPassword]);
      
      if (createResult.rows.length > 0) {
        console.log(`✅ Admin user created successfully with ID: ${createResult.rows[0].id}`);
        console.log('⚠️ Default credentials:');
        console.log('   Username: admin');
        console.log('   Password: demo');
        console.log('⚠️ IMPORTANT: Change the default admin password immediately after first login!');
      } else {
        console.error('❌ Failed to create admin user.');
      }
    } catch (error) {
      console.error('❌ Error creating admin user:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      if (client) {
        client.release();
      }
      await pool.end();
    }
  }

  // Run the function
  await createAdminUser();
}

// Start the script
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});