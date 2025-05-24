# 📋 Easypanel Deployment Checklist

## Pre-Deployment
- [ ] Repository pushed to Git
- [ ] Environment variables configured in .env
- [ ] POSTGRES_PASSWORD set to secure value
- [ ] SESSION_SECRET set to unique value
- [ ] SMTP credentials configured (if using email features)
- [ ] S3 credentials configured (if using S3 storage)

## Easypanel Configuration
- [ ] Create new project in Easypanel
- [ ] Select "Docker Compose" deployment type
- [ ] Upload docker-compose.yml file
- [ ] Configure environment variables
- [ ] Set up custom domain (optional)
- [ ] Configure SSL certificate (recommended)

## Post-Deployment
- [ ] Verify application health at /api/health
- [ ] Login with admin credentials (admin/demo)
- [ ] Change default admin password
- [ ] Test file upload functionality
- [ ] Test note creation and editing
- [ ] Verify database persistence
- [ ] Configure email settings (if using SMTP)
- [ ] Set up S3 storage (if using S3)

## Production Hardening
- [ ] Enable HTTPS/SSL
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Review security settings
- [ ] Set up log monitoring

## Default Admin Credentials
- Username: admin
- Password: demo
- ⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN!
