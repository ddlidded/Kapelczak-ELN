-- Initialize Kapelczak Notes Database
-- This script ensures the database is properly configured

-- Create the database if it doesn't exist (handled by POSTGRES_DB env var)
-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE kapelczak_notes TO kapelczak_user;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';