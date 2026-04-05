# 🚀 Deployment Guide

## Production Deployment Options

### Option 1: Traditional Server (VPS/Dedicated)

#### Prerequisites
- Ubuntu 20.04+ or similar Linux server
- Node.js 18+
- MariaDB/MySQL 10+
- Nginx (for reverse proxy)
- Domain name (optional but recommended for HTTPS)

#### Step-by-Step Deployment

**1. Server Setup**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MariaDB
sudo apt install -y mariadb-server
sudo mysql_secure_installation

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

**2. Database Setup**

```bash
# Login to MariaDB
sudo mysql -u root -p

# Create database and user
CREATE DATABASE attendance_fines;
CREATE USER 'attendance_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON attendance_fines.* TO 'attendance_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema
mysql -u attendance_user -p attendance_fines < database/schema.sql
```

**3. Upload Application**

```bash
# Clone or upload your code to server
cd /var/www/
sudo mkdir attendance_fines
sudo chown $USER:$USER attendance_fines
cd attendance_fines

# Upload files via git, scp, or ftp
# Example with git:
git clone https://github.com/yourusername/attendance-fines.git .
```

**4. Configure Environment**

```bash
# Create .env file
cd server
cp .env.example .env
nano .env

# Set your production values:
DB_HOST=localhost
DB_USER=attendance_user
DB_PASSWORD=your_secure_password
DB_NAME=attendance_fines
PORT=3000
```

**5. Install and Build**

```bash
cd /var/www/attendance_fines

# Install dependencies
npm install

# Build frontend
npm run build
```

**6. Start Backend with PM2**

```bash
# Start backend
pm2 start server/index.js --name attendance-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown
```

**7. Configure Nginx**

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/attendance
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your server IP

    # Frontend (built files)
    root /var/www/attendance_fines/dist;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Camera access requires HTTPS
    # Consider adding SSL certificate (Let's Encrypt)
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

**8. Setup SSL (Recommended - Required for Camera)**

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure HTTPS
```

**9. Firewall Configuration**

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

**10. Verify Deployment**

- Visit https://your-domain.com/admin
- Test QR scanning (requires HTTPS)
- Test student portal
- Check API: https://your-domain.com/api/health

---

### Option 2: Cloud Platform (Heroku)

**1. Prepare Application**

```bash
# Create Procfile
echo "web: node server/index.js" > Procfile

# Update package.json
# Add to scripts:
"start": "node server/index.js",
"heroku-postbuild": "npm run build"
```

**2. Deploy**

```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create your-app-name

# Add MariaDB addon (ClearDB or JawsDB)
heroku addons:create jawsdb:kitefin

# Set environment variables
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run bash
mysql -h [host] -u [user] -p [database] < database/schema.sql
```

---

### Option 3: Vercel (Frontend) + Render/Railway (Backend)

**Frontend on Vercel:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Backend on Render:**
1. Connect GitHub repository
2. Create new Web Service
3. Set build command: `npm install`
4. Set start command: `node server/index.js`
5. Add environment variables
6. Deploy

---

### Option 4: Docker Deployment

**Create Dockerfile:**

```dockerfile
# Frontend Build
FROM node:18 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Backend
FROM node:18
WORKDIR /app
COPY --from=frontend-build /app/dist ./dist
COPY server ./server
COPY package*.json ./
RUN npm install --production
EXPOSE 3000
CMD ["node", "server/index.js"]
```

**Docker Compose:**

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - DB_USER=root
      - DB_PASSWORD=password
      - DB_NAME=attendance_fines
    depends_on:
      - db

  db:
    image: mariadb:10
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=attendance_fines
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

**Deploy:**

```bash
docker-compose up -d
```

---

## 🔒 Security Checklist

### Pre-Deployment

- [ ] Change default database passwords
- [ ] Set strong `DB_PASSWORD` in .env
- [ ] Add `.env` to `.gitignore`
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure CORS for specific domains
- [ ] Disable MariaDB remote root access
- [ ] Setup firewall rules
- [ ] Limit API rate limiting (optional)

### Post-Deployment

- [ ] Test all features in production
- [ ] Monitor server logs
- [ ] Setup backups (database)
- [ ] Monitor disk space
- [ ] Setup uptime monitoring
- [ ] Document admin credentials

---

## 📊 Performance Optimization

### Frontend

```javascript
// vite.config.js - Add build optimizations
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'db-vendor': ['dexie'],
          'qr-vendor': ['html5-qrcode']
        }
      }
    }
  }
});
```

### Backend

- Use connection pooling (already implemented)
- Add Redis for caching (optional)
- Enable gzip compression

```javascript
// server/index.js
import compression from 'compression';
app.use(compression());
```

### Database

```sql
-- Add indexes for better performance
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_fines_date ON fines(date);
CREATE INDEX idx_student_name ON students(last_name, first_name);
```

---

## 🔄 Backup Strategy

### Database Backups

**Daily Automated Backup:**

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/attendance"
DB_NAME="attendance_fines"
DB_USER="attendance_user"
DB_PASS="your_password"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
```

**Setup Cron Job:**

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

---

## 📈 Monitoring

### Application Monitoring

**PM2 Monitoring:**

```bash
# View logs
pm2 logs attendance-api

# Monitor resources
pm2 monit

# Web dashboard
pm2 plus
```

### Server Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop iotop

# Check disk space
df -h

# Check memory
free -h

# Check processes
htop
```

---

## 🆘 Troubleshooting Production Issues

### Backend Won't Start

```bash
# Check logs
pm2 logs attendance-api

# Check if port is in use
sudo lsof -i :3000

# Restart service
pm2 restart attendance-api
```

### Database Connection Issues

```bash
# Test database connection
mysql -u attendance_user -p -h localhost attendance_fines

# Check MariaDB status
sudo systemctl status mariadb

# View MariaDB logs
sudo tail -f /var/log/mysql/error.log
```

### Nginx Issues

```bash
# Check configuration
sudo nginx -t

# View logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

---

## 📱 Mobile App (Optional)

Convert to native app using:

1. **Capacitor** (Recommended)
2. **Cordova**
3. **React Native** (requires rewrite)

**Quick Capacitor Setup:**

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap add ios
npx cap sync
```

---

## ✅ Go-Live Checklist

- [ ] Database created and schema imported
- [ ] Environment variables configured
- [ ] Application built (`npm run build`)
- [ ] Backend running (PM2 or similar)
- [ ] Nginx configured and running
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backup script setup
- [ ] Monitoring configured
- [ ] Test all features
- [ ] Document server credentials
- [ ] Train administrators
- [ ] Share student portal link

---

## 🎉 You're Ready to Go!

Your attendance and fines management system is now deployed and ready for production use!

For support and updates, refer to:
- `README.md` - Full documentation
- `QUICKSTART.md` - Quick reference
- `PROJECT_SUMMARY.md` - Project overview
