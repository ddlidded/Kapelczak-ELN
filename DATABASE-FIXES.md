# Database Connection Fixes for Production

## Problem Identified
The error logs showed database connection issues when running in production mode with the error:
```
Error: connect ECONNREFUSED 172.23.0.2:443
```

This indicated that the application was trying to connect to a PostgreSQL database using Neon's WebSocket connection (over WSS), but the connection was being refused. This is likely because:

1. The application was trying to use WebSockets to connect to a regular PostgreSQL database
2. The Docker networking was causing issues with the connection

## Solutions Implemented

### 1. Updated Database Connection Logic (`server/db.js`)

- **Added Flexible Connection Logic**: Modified the database connection code to use different drivers based on the database URL or environment variables.
  - For Neon.tech databases (using WebSockets): Uses `@neondatabase/serverless`
  - For standard PostgreSQL databases: Uses regular `pg` (node-postgres)

- **Enhanced Error Detection**: Added detailed error messaging to help identify database connection issues.

- **Added Connection Validation**: Added a query to test the database connection at startup and display the connection status.

- **Added Robust Error Handling**: Added proper error handling for database connections with helpful error messages.

### 2. Added Retry Logic (`server/storage.js`)

- **Implemented Connection Retry**: Added a retry mechanism with exponential backoff to handle transient database connection issues.

- **Applied Retry Logic to Key Methods**: Updated critical database operations to use the retry logic:
  - `getUser`
  - `getUserByUsername`
  - `listProjects`
  - `listProjectsByUser`
  - `listNotesByExperiment`

- **Added Defensive Coding**: Added additional null checks and error handling to make the code more robust against unexpected data conditions.

### 3. Updated Environment Configuration

- **Updated Environment Variables**: Added additional environment variables in `.env.production` to support both connection methods:
  - Standard PostgreSQL variables: `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`, `PGPORT`
  - Connection type indicator: `USE_NEON` flag

- **SSL Configuration Option**: Added `PGSSL` environment variable to enable SSL for PostgreSQL connections when needed.

## Deployment Changes

- **Updated Node.js Version**: Changed from Node.js 16 to Node.js 20 in the deployment script.

- **Updated Build Scripts**: Changed from direct command calls to npm script calls to ensure consistent behavior.

- **Added Better Production Error Handling**: Updated the production server to provide more detailed error logs and handle errors gracefully.

## Testing Your Database Connection

To determine which type of database connection to use:

1. For a Neon.tech serverless PostgreSQL database, ensure your `DATABASE_URL` contains `neon.tech` or set `USE_NEON=true` in your `.env.production` file.

2. For a standard PostgreSQL database:
   - You can use `DATABASE_URL` with a format like `postgresql://user:password@host:port/database`
   - Or provide individual parameters: `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`, `PGPORT`
   - If your PostgreSQL requires SSL, add `PGSSL=true`

## Monitoring Database Connections

The application now logs detailed information about database connections:

- Connection type detected (Neon or standard PostgreSQL)
- Successful connection confirmations
- Detailed error information when connections fail
- Retry attempts for unstable connections

## Next Steps if Issues Persist

If database connection issues persist after these changes:

1. Check your database credentials and ensure the database server is accessible from your deployment environment.
2. Verify network connectivity between your server and the database.
3. Look for specific error messages in the server logs to pinpoint the issue.
4. If using a Neon serverless database, ensure your server has proper WebSocket connectivity.
