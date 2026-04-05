# Attendance & Fines Management System - Quick Start Guide

## 🚀 Quick Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup database
# Create database in MariaDB/MySQL:
CREATE DATABASE attendance_fines;

# 3. Configure environment
cd server
cp .env.example .env
# Edit .env with your database credentials

# 4. Run the application
# Terminal 1:
npm run dev

# Terminal 2:
npm run server
```

## 📋 First Time Setup

### 1. Upload Students
1. Open http://localhost:5173/admin
2. Go to "Upload Members" tab
3. Upload CSV with columns: Student ID, LASTNAME, FIRSTNAME, MIDDLE INITIAL

### 2. Configure Fines
1. Go to "Settings" tab
2. Set fine amounts:
   - Absent: ₱50 (or your amount)
   - Late: ₱20 (or your amount)

### 3. Share Student Link
1. In Settings, copy the student portal link
2. Share with students

## 🎯 Quick Feature Guide

### Scan QR Codes
- **QR Scanner** tab → Start Scanning
- Point camera at student QR code
- Attendance recorded automatically

### Online Meeting Attendance
- **Online Meeting** tab
- Paste attendee list (LASTNAME, FIRSTNAME MI)
- Click Process Attendance
- System marks present/absent and calculates fines

### View Reports
- **Attendance Logs**: See all scans
- **Fines Summary**: View all student fines
- Export data as CSV

### Student Access
Students visit portal URL and enter Student ID to view:
- Their attendance history
- Their fines

## 🔧 Offline Mode

✅ Works offline automatically!
- Scans saved locally in browser
- Auto-syncs when online
- Click "Sync Now" to force sync

## 📱 Install as App

Mobile: Browser menu → "Add to Home Screen"  
Desktop: Click install icon in address bar

## 🆘 Common Issues

**Camera not working?**
- Allow camera permissions
- Use HTTPS (required for camera)

**Database error?**
- Check MariaDB is running
- Verify .env credentials

**Names not parsing?**
- Format: `LASTNAME, FIRSTNAME MI`
- Must include middle initial

## 📞 Need Help?

Check the full README.md for detailed documentation!

---

**Access Points:**
- Admin: http://localhost:5173/admin
- Student Portal: http://localhost:5173/student
- API: http://localhost:3000/api
