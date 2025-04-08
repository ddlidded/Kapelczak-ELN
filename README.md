# Kapelczak Notes

A laboratory note-taking system with file/image attachment capabilities for scientific documentation.

## Overview

Kapelczak Notes is a comprehensive lab notebook for scientific documentation with features including:
- Project management
- Experiment tracking
- Rich text editing with TinyMCE
- File and image attachments
- User management
- Search functionality

## Installation and Setup

### Prerequisites

- Node.js (v18 or later)
- npm (v8 or later)
- PostgreSQL (v12 or later)

### Development Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd kapelczak-notes
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   ```
   cp .env.example .env
   ```
   
4. Edit the `.env` file with your PostgreSQL connection string:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/kapelczak_notes
   ```

5. Create the database schema:
   ```
   npm run db:push
   ```

6. Start the development server:
   ```
   npm run dev
   ```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Quick Start for Production (Manual Deployment)

To deploy manually without the tsx dependency issue:

1. Install global dependencies:
   ```
   npm install -g tsx vite
   ```

2. Build the frontend:
   ```
   npx vite build
   ```

3. Create required directories:
   ```
   mkdir -p uploads
   ```

4. Set up production environment:
   ```
   cp .env.example .env.production
   ```
   Edit the file with your production database credentials.

5. Push database schema:
   ```
   npx drizzle-kit push
   ```

6. Start the production server:
   ```
   NODE_ENV=production node server/prod.js
   ```

### Production with PM2

For a more robust deployment, use PM2:

1. Install PM2:
   ```
   npm install -g pm2
   ```

2. Start the application:
   ```
   pm2 start ecosystem.config.js
   ```

3. Save the process list:
   ```
   pm2 save
   ```

4. Set up auto-restart on system boot:
   ```
   pm2 startup
   ```

## Features

- **Projects**: Organize your research into separate projects
- **Experiments**: Track different experiments within each project
- **Notes**: Document your findings with rich text and attachments
- **File Attachments**: Attach images, PDFs, and other files to your notes
- **Collaboration**: Invite team members to collaborate on projects
- **Search**: Search across projects, experiments, and notes

## Technologies

- **Frontend**: React, TinyMCE, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js
- **File Handling**: Multer