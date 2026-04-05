# 🎯 START HERE - Attendance & Fines Management System

Welcome! This guide will help you get started quickly.

---

## ⚡ Quick Start (5 Minutes)

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Setup Database

```bash
# In MariaDB/MySQL:
CREATE DATABASE attendance_fines;

# Import schema:
mysql -u root -p attendance_fines < database/schema.sql
```

### 3️⃣ Configure Environment

```bash
cd server
copy .env.example .env
# Edit .env with your database credentials
```

### 4️⃣ Start Development

**Option A: Using Scripts (Recommended)**
```bash
# Windows CMD:
start-dev.bat

# Windows PowerShell:
.\start-dev.ps1
```

**Option B: Manual Start**
```bash
# Terminal 1 - Frontend:
npm run dev

# Terminal 2 - Backend:
npm run server
```

### 5️⃣ Access the Application

- **Admin Dashboard:** http://localhost:5173/admin
- **Student Portal:** http://localhost:5173/student
- **API Health:** http://localhost:3000/api/health

---

## 📖 Documentation Index

Choose the guide that fits your needs:

### For Quick Setup
- **[QUICKSTART.md](QUICKSTART.md)** - Fast installation and first-time setup

### For Complete Information
- **[README.md](README.md)** - Full documentation (400+ lines)
  - Features
  - Installation
  - Usage guide
  - API reference
  - Troubleshooting

### For Understanding the Project
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Complete project overview
  - What was built
  - Deliverables
  - Tech stack
  - Features list

### For Production Deployment
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
  - VPS deployment
  - Cloud platforms
  - Docker setup
  - Security checklist

### For Project Structure
- **[FILE_STRUCTURE.md](FILE_STRUCTURE.md)** - Complete file organization
  - Folder structure
  - Component relationships
  - Database schemas
  - API endpoints

### For Feature Verification
- **[FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md)** - Complete feature list
  - All implemented features
  - 100% completion status
  - Requirements mapping

---

## 🎓 First-Time User Guide

### As an Administrator

1. **Upload Students**
   - Go to "Upload Members" tab
   - Upload `sample-data/students-sample.csv` (or your CSV)
   - Review import results

2. **Configure Fines**
   - Go to "Settings" tab
   - Set fine amounts (default: Absent=₱50, Late=₱20)

3. **Try QR Scanning**
   - Go to "QR Scanner" tab
   - Click "Start Scanning"
   - Scan a student QR code with their ID

4. **Test Online Meeting Parser**
   - Go to "Online Meeting" tab
   - Paste from `sample-data/online-meeting-sample.txt`
   - Click "Process Attendance"

5. **View Reports**
   - Check "Attendance Logs" for all records
   - Check "Fines Summary" for totals

6. **Share with Students**
   - Go to "Settings"
   - Copy the student portal link
   - Share via email/LMS/messaging

### As a Student

1. Open the student portal link (shared by admin)
2. Enter your Student ID
3. Click "Search"
4. View your attendance and fines

---

## 🔧 Verification

Run the verification script to check your setup:

```bash
# PowerShell:
.\verify-setup.ps1
```

This checks:
- ✅ Node.js version
- ✅ npm installation
- ✅ Project structure
- ✅ Configuration files
- ✅ Documentation

---

## 📁 Project Structure Overview

```
attendance_fines/
├── src/                   # Frontend React app
│   ├── components/        # UI components (7 files)
│   ├── pages/            # Main pages (Admin + Student)
│   ├── db/               # IndexedDB layer
│   └── utils/            # Helper functions (5 modules)
├── server/               # Backend Express API
├── database/             # SQL schema
├── sample-data/          # Test data
└── docs/                 # All .md documentation
```

---

## 🎯 Key Features

### ✅ Offline-First
- Works without internet
- Syncs when online
- No data loss

### ✅ QR Scanning
- Camera-based
- Multiple QR formats
- Instant validation

### ✅ Online Meeting Parser
- Paste attendee lists
- Auto-validate names
- Auto-mark absences

### ✅ Auto-Fines
- Configurable rules
- Automatic computation
- Real-time updates

### ✅ Student Portal
- View-only access
- No login needed
- Mobile-friendly

### ✅ PWA Ready
- Installable app
- Offline caching
- Service worker

---

## 🆘 Common Issues

### "Cannot find module"
```bash
npm install
```

### "Database connection failed"
- Check MariaDB is running
- Verify server/.env credentials
- Test connection: `mysql -u root -p`

### "Camera not working"
- Grant camera permissions
- Use HTTPS (required for camera)
- Check browser compatibility

### "Name format invalid"
- Format must be: `LASTNAME, FIRSTNAME MI`
- Include comma and middle initial
- Check for extra spaces

---

## 💡 Tips

1. **Test with Sample Data**
   - Use files in `sample-data/` folder
   - Safe to experiment
   - Easy to reset

2. **Check Offline Mode**
   - Disconnect internet
   - Try scanning QR codes
   - Should still work!

3. **Monitor Sync Status**
   - Look at top-right indicator
   - Click "Sync Now" when online
   - Verify in MariaDB

4. **Export Data Regularly**
   - Use "Export CSV" in Fines Summary
   - Backup database with mysqldump
   - Keep offline copies

---

## 🚀 Next Steps

1. ✅ Run `npm install`
2. ✅ Setup database
3. ✅ Configure .env
4. ✅ Start servers
5. ✅ Upload test data
6. ✅ Test QR scanning
7. ✅ Test online meeting parser
8. ✅ Share student portal link

---

## 📞 Need Help?

1. Check [README.md](README.md) for detailed docs
2. See [QUICKSTART.md](QUICKSTART.md) for fast reference
3. Review [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) for features
4. Read [DEPLOYMENT.md](DEPLOYMENT.md) for production

---

## 🎉 You're Ready!

Everything is set up and ready to use. Start with the Quick Start section above and explore the features!

**Happy tracking! 📊**

---

**Version:** 1.0.0  
**Status:** ✅ Production Ready  
**Last Updated:** January 24, 2026
