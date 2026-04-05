# 🚀 Quick Setup with Laragon

## Prerequisites
✅ Laragon installed and running
✅ MySQL service started in Laragon

## Setup Steps

### 1. Start Laragon MySQL
1. Open Laragon
2. Click "Start All" (or just start MySQL)
3. Verify MySQL is running (green indicator)

### 2. Create Database (Optional - Auto-created)
The system will automatically create the database, but you can do it manually:

1. Click "Database" button in Laragon
2. Opens HeidiSQL or phpMyAdmin
3. Create database: `attendance_fines`

**OR** let the system create it automatically on first run!

### 3. Start the System
Open terminal in project folder and run:
```bash
npm start
```

This command starts:
- ✅ Backend server on `http://localhost:3000`
- ✅ Frontend on `http://localhost:5173`

### 4. Verify Connection
Check the terminal output:
```
✅ Connected to MariaDB
✅ Database tables initialized
🚀 Server running on http://localhost:3000
```

If you see this, you're good to go!

## Configuration (Already Set)

The `server/.env` file is already configured for Laragon defaults:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=attendance_fines
PORT=3000
```

**No changes needed** - Laragon uses these exact defaults!

## Access from Phone

### Your Network URL
1. In Laragon, click "Menu" → "Apache" → "httpd.conf" (or check your IP)
2. Or run in terminal:
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., 192.168.1.8)

### Update Frontend to Use Network
Edit `.env` file in project root:
```env
VITE_API_URL=http://192.168.1.8:3000/api
```

Then restart:
```bash
npm start
```

### Access Points
- **Admin:** `http://192.168.1.8:5173/admin`
- **QR Scanner:** `http://192.168.1.8:5173/scan`
- **Student View:** `http://192.168.1.8:5173/student`

## Troubleshooting

### "Database not available"
1. Check if MySQL is running in Laragon (green light)
2. Try restarting MySQL in Laragon
3. Check terminal for specific error messages

### Port 3000 already in use
Change port in `server/.env`:
```env
PORT=3001
```
And update `.env`:
```env
VITE_API_URL=http://localhost:3001/api
```

### Database connection failed
1. Open HeidiSQL from Laragon
2. Test connection with:
   - Host: `localhost`
   - User: `root`
   - Password: (leave empty)
3. If it works, the system should work too

### Backend won't start
Make sure you installed dependencies:
```bash
npm install
```

## Features

### ✅ Centralized Data
- Upload students on one device → visible on all devices
- Record attendance on phone → updates all admin dashboards
- All data stored in Laragon's MySQL database

### ✅ Real-Time Sync
- Multiple admins can work simultaneously
- Changes reflect instantly across all devices
- Single source of truth

### ✅ Offline Support
- If MySQL is down, uses local browser storage
- Automatically switches back when MySQL is available
- No data loss

## Commands Reference

```bash
# Start everything (backend + frontend)
npm start

# Start backend only
npm run start:server

# Start frontend only
npm run start:client

# Stop: Press Ctrl+C in terminal
```

## Success Indicators

Terminal shows:
```
✅ Connected to MariaDB
✅ Database tables initialized
🚀 Server running on http://localhost:3000
📊 API endpoints available at http://localhost:3000/api

VITE v5.4.21  ready in 437 ms
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.8:5173/
```

Browser console shows:
```
✅ Backend server connected - using centralized database
```

## Database Tables (Auto-Created)

The system automatically creates:
- ✅ `students` - Student information
- ✅ `events` - Event schedule
- ✅ `attendance` - Attendance records
- ✅ `fines` - Fine records
- ✅ `excuses` - Excuse documents (COE, OJT)
- ✅ `membership_payments` - Membership tracking
- ✅ `fine_rules` - Fine amount configuration

You can view them in HeidiSQL/phpMyAdmin from Laragon!

## Tips

1. **Keep Laragon Running** - MySQL must be running for centralized sync
2. **Use Network URL** - Update `.env` with your IP for phone access
3. **Check Laragon Console** - Shows MySQL errors if any
4. **Backup Database** - Use Laragon's database export feature

---

**You're all set!** Just run `npm start` and everything should work with Laragon's MySQL! 🎉
