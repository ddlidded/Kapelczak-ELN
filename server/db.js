// Import required modules for database connection
const schema = require('../dist/shared/schema.cjs');

// Determine which database driver to use based on environment
let pool, db;

// Check for required environment variables
if (!process.env.DATABASE_URL) {
  console.error("\n===== DATABASE CONFIGURATION ERROR =====");
  console.error("DATABASE_URL environment variable is not set!");
  console.error("Please ensure your .env.production file contains a valid DATABASE_URL.");
  console.error("Examples:");
  console.error("- For Neon: postgresql://user:password@ep-something.us-east-2.aws.neon.tech/neondb");
  console.error("- For standard PostgreSQL: postgresql://user:password@localhost:5432/mydatabase");
  console.error("=====================================\n");
  
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check if we're using a Neon database URL (which starts with postgres://)
// or a standard PostgreSQL connection
if (process.env.DATABASE_URL.includes('neon.tech') || process.env.USE_NEON === 'true') {
  console.log('Using Neon serverless PostgreSQL driver');
  
  // Use Neon's serverless driver with WebSockets
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  const { drizzle } = require('drizzle-orm/neon-serverless');
  const ws = require('ws');
  
  neonConfig.webSocketConstructor = ws;
  
  // Create the connection pool with error handling
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Add error handling for the pool
    pool.on('error', (err) => {
      console.error('Unexpected error on idle Neon database client:', err);
      process.exit(-1);
    });
    
    // Test the connection
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('\n===== NEON DATABASE CONNECTION ERROR =====');
        console.error(err);
        console.error('Please check your DATABASE_URL and ensure your Neon database is accessible.');
        console.error('=========================================\n');
      } else {
        console.log(`Neon database connection successful at ${res.rows[0].now}`);
      }
    });
    
    db = drizzle({ client: pool, schema });
  } catch (error) {
    console.error('\n===== NEON DATABASE INITIALIZATION ERROR =====');
    console.error(error);
    console.error('=============================================\n');
    throw error;
  }
} else {
  console.log('Using standard PostgreSQL driver');
  
  // Use standard node-postgres for traditional PostgreSQL connections
  const { Pool } = require('pg');
  const { drizzle } = require('drizzle-orm/pg-pool');
  
  // Create connection pool using either DATABASE_URL or individual params
  const connectionConfig = process.env.PGHOST ? {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSL === 'true'
  } : {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true'
  };
  
  try {
    pool = new Pool(connectionConfig);
    
    // Add error handling for the pool
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
      process.exit(-1);
    });
    
    // Test the connection
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('\n===== POSTGRESQL CONNECTION ERROR =====');
        console.error(err);
        console.error('Please check your database configuration and ensure PostgreSQL is running.');
        console.error('=======================================\n');
      } else {
        console.log(`PostgreSQL connection successful at ${res.rows[0].now}`);
      }
    });
    
    db = drizzle(pool, { schema });
  } catch (error) {
    console.error('\n===== POSTGRESQL INITIALIZATION ERROR =====');
    console.error(error);
    console.error('=========================================\n');
    throw error;
  }
}

module.exports = { pool, db };