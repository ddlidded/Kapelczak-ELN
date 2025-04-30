/**
 * Create Admin User Script for Kapelczak Notes
 * This script creates an admin user if one doesn't exist.
 * Used during deployment to ensure an admin user is available.
 */

// Fix CommonJS import issues with ESM
import pkg from 'pg';
const { Pool } = pkg;
import { createHash } from 'crypto';

// Get database connection string from environment variables
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

console.log('🔄 Checking for existing admin user...');

// Create a PostgreSQL client
const pool = new Pool({ connectionString });

// Simple password hashing function for the admin user
function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

// Get table schema to check column names
async function getUserTableColumns(client) {
  try {
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
    console.log('Available columns in users table:', columns);
    
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
    insertValues = [hashedPassword];
    
    console.log('Executing SQL:', insertSQL);
    const createResult = await client.query(insertSQL, insertValues);
    
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
createAdminUser();