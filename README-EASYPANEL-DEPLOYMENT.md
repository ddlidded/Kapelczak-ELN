# 🚀 Kapelczak Notes - Easypanel One-Click Deployment

Deploy your complete laboratory documentation platform on Easypanel in under 5 minutes with automated database setup, file uploads, and admin user creation.

## 📋 Prerequisites

- Easypanel account (free or paid plan)
- Git repository containing this project
- 5 minutes of your time

## 🎯 Quick Deployment (3 Steps)

### Step 1: Prepare Your Repository
1. Fork or clone this repository to your GitHub/GitLab account
2. Ensure all files are present (especially `docker-compose.yml` and `Dockerfile`)

### Step 2: Create Project in Easypanel
1. **Login to Easypanel Dashboard**
   - Go to your Easypanel instance
   - Navigate to "Projects" → "Create New Project"

2. **Project Configuration**
   ```
   Project Name: kapelczak-notes
   Description: Laboratory Documentation Platform
   ```

3. **Source Configuration**
   - **Source Type**: Git Repository
   - **Repository URL**: `https://github.com/yourusername/kapelczak-notes`
   - **Branch**: `main` (or your default branch)

### Step 3: Configure Deployment
1. **Deployment Type**
   - Select: **"Docker Compose"**
   - **Compose File**: `docker-compose.yml` (auto-detected)

2. **Environment Variables** (Copy and paste these exactly)
   ```env
   NODE_ENV=production
   PORT=5000
   POSTGRES_PASSWORD=SecurePass123!ChangeMe
   SESSION_SECRET=YourUniqueSessionSecret2024!
   DATABASE_URL=postgresql://kapelczak_user:SecurePass123!ChangeMe@postgres:5432/kapelczak_notes
   ```

3. **Optional Environment Variables** (for advanced features)
   ```env
   # Email functionality (optional)
   SMTP_HOST=your-smtp-server.com
   SMTP_PORT=587
   SMTP_USER=your-email@domain.com
   SMTP_PASSWORD=your-email-password
   
   # S3 Storage (optional)
   AWS_ACCESS_KEY_ID=your-aws-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret
   S3_BUCKET=your-bucket-name
   S3_ENDPOINT=your-s3-endpoint
   ```

4. **Domain Configuration**
   - **Custom Domain**: `your-domain.com` (optional)
   - **SSL**: Enable automatic SSL certificate
   - **Port Mapping**: 
     - Internal: `80` → External: `80`
     - Internal: `443` → External: `443`

## 🔧 Detailed Configuration Guide

### Environment Variables Explained

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `POSTGRES_PASSWORD` | ✅ Yes | Database password | `SecurePass123!` |
| `SESSION_SECRET` | ✅ Yes | Session encryption key | `UniqueSecret2024!` |
| `SMTP_HOST` | ❌ Optional | Email server hostname | `smtp.gmail.com` |
| `SMTP_USER` | ❌ Optional | Email username | `user@gmail.com` |
| `SMTP_PASSWORD` | ❌ Optional | Email password | `app-password` |
| `S3_BUCKET` | ❌ Optional | S3 bucket name | `my-files-bucket` |

### Easypanel Service Configuration

**Recommended Resource Allocation:**
- **CPU**: 1 Core minimum (2 Cores recommended)
- **Memory**: 1GB minimum (2GB recommended)
- **Storage**: 10GB minimum (50GB recommended)

**Network Configuration:**
- **Internal Network**: Automatic (Docker Compose handles networking)
- **External Access**: Port 80/443 for web interface
- **Health Checks**: Enabled on `/api/health`

## ⚡ One-Click Deploy Button

Click this button to deploy instantly on Easypanel:

```yaml
# Easypanel Template Configuration
name: kapelczak-notes
services:
  - name: kapelczak-notes
    image: 
      type: dockerfile
      dockerfile: Dockerfile
    domains:
      - host: kapelczak-notes.yourdomain.com
    env:
      - name: NODE_ENV
        value: production
      - name: POSTGRES_PASSWORD
        value: CHANGE_THIS_PASSWORD
      - name: SESSION_SECRET
        value: CHANGE_THIS_SECRET
    volumes:
      - name: uploads
        mountPath: /app/uploads
      - name: logs
        mountPath: /app/logs
```

## 🚀 Deployment Process

### Automated Steps (Handled by Easypanel)

1. **Container Build**
   - Pulls Node.js 20 Alpine image
   - Installs dependencies and builds application
   - Sets up production environment

2. **Database Setup**
   - Creates PostgreSQL 15 container
   - Initializes database schema automatically
   - Creates default admin user

3. **Application Startup**
   - Starts Express server on port 5000
   - Configures file upload handling
   - Enables health monitoring

4. **Proxy Configuration**
   - Sets up Nginx reverse proxy
   - Configures SSL termination
   - Enables WebSocket support

### Expected Deployment Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Repository Clone | 30s | Building... |
| Dependency Install | 2min | Building... |
| Application Build | 1min | Building... |
| Database Setup | 30s | Starting... |
| Service Start | 30s | Running ✅ |
| **Total Time** | **~5min** | **Ready!** |

## 🔍 Post-Deployment Verification

### 1. Check Application Health
Visit: `https://your-domain.com/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. Access Admin Panel
- **URL**: `https://your-domain.com`
- **Username**: `admin`
- **Password**: `demo`

⚠️ **IMPORTANT**: Change the default password immediately!

### 3. Test Core Features
- ✅ Login with admin credentials
- ✅ Create a new project
- ✅ Add a note with text content
- ✅ Upload a file attachment
- ✅ Generate a PDF report

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### Issue: "Database Connection Failed"
**Solution:**
1. Check environment variables in Easypanel dashboard
2. Verify `POSTGRES_PASSWORD` matches in all references
3. Restart the application service

#### Issue: "File Upload Not Working"
**Solution:**
1. Check volume mounts in Easypanel
2. Verify upload directory permissions
3. Ensure sufficient storage space

#### Issue: "Application Won't Start"
**Solution:**
1. Check application logs in Easypanel
2. Verify all required environment variables are set
3. Check resource allocation (CPU/Memory)

### Accessing Logs

**In Easypanel Dashboard:**
1. Go to your project
2. Click on "kapelczak-notes" service
3. Navigate to "Logs" tab
4. Filter by service:
   - `kapelczak-notes` - Application logs
   - `postgres` - Database logs
   - `nginx` - Proxy logs

### Manual Commands (if needed)

**Restart Application:**
```bash
# In Easypanel terminal
docker-compose restart kapelczak-notes
```

**Check Database:**
```bash
# Connect to database
docker-compose exec postgres psql -U kapelczak_user -d kapelczak_notes
```

**Reset Admin Password:**
```bash
# Run admin setup script
docker-compose exec kapelczak-notes node setup-admin.js
```

## 🔒 Security Configuration

### Production Security Checklist

- [ ] Change default `POSTGRES_PASSWORD`
- [ ] Set unique `SESSION_SECRET`
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Update admin password from default
- [ ] Review user permissions
- [ ] Enable monitoring and alerts

### Recommended Security Settings

```env
# Strong password requirements
POSTGRES_PASSWORD=StrongPassword123!@#
SESSION_SECRET=UniqueSessionKey2024$%^

# Secure cookie settings (auto-configured)
SECURE_COOKIES=true
SAME_SITE_COOKIES=strict
```

## 📊 Monitoring and Maintenance

### Built-in Monitoring

**Health Checks:**
- Application health: Every 30 seconds
- Database connectivity: Every 10 seconds
- File system: Every 60 seconds

**Metrics Available:**
- Response time monitoring
- Error rate tracking
- Resource usage statistics
- Active user sessions

### Backup Strategy

**Automated Backups (Recommended):**
1. Enable Easypanel automatic backups
2. Schedule daily database exports
3. Store uploaded files in S3 (optional)

**Manual Backup:**
```bash
# Database backup
docker-compose exec postgres pg_dump -U kapelczak_user kapelczak_notes > backup.sql

# File uploads backup
tar -czf uploads-backup.tar.gz uploads/
```

## 🚀 Scaling and Performance

### Resource Scaling

**For Small Teams (1-10 users):**
- CPU: 1 Core
- Memory: 1GB
- Storage: 10GB

**For Medium Teams (10-50 users):**
- CPU: 2 Cores
- Memory: 2GB
- Storage: 50GB

**For Large Teams (50+ users):**
- CPU: 4 Cores
- Memory: 4GB
- Storage: 100GB+

### Performance Optimization

1. **Enable S3 Storage**: Offload file uploads to S3
2. **Database Indexing**: Automatic optimization included
3. **Caching**: Built-in Redis caching for sessions
4. **CDN**: Use Easypanel's CDN for static assets

## 📞 Support and Updates

### Getting Help

1. **Check Logs**: Always start with application logs
2. **Documentation**: Review this guide thoroughly
3. **Easypanel Support**: Contact Easypanel support for platform issues
4. **Community**: Check GitHub issues for known problems

### Updating the Application

**Automatic Updates:**
1. Push changes to your Git repository
2. Easypanel will auto-detect and rebuild
3. Zero-downtime deployment with health checks

**Manual Update:**
1. Go to Easypanel dashboard
2. Navigate to your project
3. Click "Redeploy" to rebuild from latest code

---

## 🎉 Success!

Your Kapelczak Notes laboratory documentation platform is now running on Easypanel!

**Next Steps:**
1. Login and change the admin password
2. Create your first project and experiment
3. Invite team members (if using collaboration features)
4. Configure email notifications (optional)
5. Set up S3 storage for large files (optional)

**Default Access:**
- **Application**: `https://your-domain.com`
- **Admin Username**: `admin`
- **Admin Password**: `demo` (change immediately!)

Enjoy your new laboratory documentation platform! 🧪📊