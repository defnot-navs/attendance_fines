# 🗄️ Centralized Database Setup Guide

## Overview
The system now uses a **centralized MySQL/MariaDB database** that syncs data across all devices in real-time. When you upload students, add events, or record attendance on one device, it immediately reflects on all other devices connected to the same database.

## Setup Instructions

### Step 1: Install MariaDB/MySQL

#### Windows:
1. Download MariaDB from: https://mariadb.org/download/
2. Run the installer
3. Set root password (or leave blank for development)
4. Start MariaDB service

#### Alternative - Use XAMPP:
1. Download XAMPP: https://www.apachefriends.org/
2. Install and start MySQL service
3. Default credentials: user=`root`, password=`` (empty)

### Step 2: Configure Database Connection

Edit `server/.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=attendance_fines
PORT=3000
```

### Step 3: Start the System

#### Option 1: Start Everything Together (Recommended)
```bash
npm start
```
This starts both the backend server (port 3000) and frontend (port 5173)

#### Option 2: Start Separately
Terminal 1 - Backend Server:
```bash
npm run start:server
```

Terminal 2 - Frontend:
```bash
npm run start:client
```

### Step 4: Verify Connection

1. Check backend health:
   ```
   http://localhost:3000/api/health
   ```
   Should show: `{"status":"ok","database":"connected"}`

2. Check frontend:
   ```
   http://localhost:5173/admin
   ```
   Console should show: "✅ Backend server connected - using centralized database"

## How It Works

### Centralized Mode (When Backend is Available)
- ✅ All data saved to MySQL database
- ✅ Real-time sync across all devices
- ✅ Students uploaded on Device A appear instantly on Device B, C, D...
- ✅ Attendance recorded on phones reflects immediately on admin dashboard
- ✅ Single source of truth for all data

### Offline Mode (When Backend is Unavailable)
- ⚠️ Falls back to local IndexedDB (browser storage)
- ⚠️ Data stays on individual devices
- ⚠️ No cross-device sync

## Network Access

### For Same Computer:
- Backend API: `http://localhost:3000/api`
- Frontend: `http://localhost:5173/admin`

### For Other Devices on Network:
1. Find your computer's IP address:
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., 192.168.1.8)

2. Update `.env` file:
   ```env
   VITE_API_URL=http://192.168.1.8:3000/api
   ```

3. Access from any device:
   - Frontend: `http://192.168.1.8:5173/admin`
   - Scanner: `http://192.168.1.8:5173/scan`
   - All devices connect to same database!

## Database Schema

The system automatically creates these tables:

- **students** - Student information
- **events** - Event schedule
- **attendance** - Attendance records
- **fines** - Fine records
- **excuses** - Excuse documents
- **membership_payments** - Membership tracking
- **fine_rules** - Fine amount rules

## Features

### ✅ Real-Time Sync
- Upload students on Computer A → See them on Computer B instantly
- Record attendance on Phone → Updates admin dashboard immediately
- Add event on Device A → Available for scanning on Device B

### ✅ Multi-Device Support
- Multiple admins can work simultaneously
- Multiple devices can scan QR codes at the same time
- All data centralized in one database

### ✅ Automatic Fallback
- If backend is down, system uses local IndexedDB
- Automatically reconnects when backend comes back online
- No data loss during offline periods

## Troubleshooting

### "Database not available" Error
1. Check if MariaDB/MySQL is running
2. Verify credentials in `server/.env`
3. Check if port 3000 is available
4. Look at terminal for error messages

### Backend Won't Start
1. Install dependencies: `npm install`
2. Check if MySQL is installed and running
3. Try creating database manually:
   ```sql
   CREATE DATABASE attendance_fines;
   ```

### Data Not Syncing
1. Open browser console (F12)
2. Check for API errors
3. Verify `.env` has correct API_URL
4. Check if both devices on same network
5. Ensure firewall allows port 3000

### Cross-Device Access Issues
1. Make sure all devices on same WiFi
2. Update VITE_API_URL to use computer's IP (not localhost)
3. Restart both backend and frontend after changing .env
4. Check Windows Firewall settings

## Production Deployment

For production use:

1. **Use a proper database server** (not localhost)
2. **Set strong passwords** in `.env`
3. **Use HTTPS** for security
4. **Enable CORS** properly for your domains
5. **Set up database backups**

## Commands Reference

```bash
# Start everything
npm start

# Start backend only
npm run start:server

# Start frontend only
npm run start:client

# Check backend health
curl http://localhost:3000/api/health

# View backend logs
# (Shows all API requests and database operations)
```

## Success Indicators

### Backend Running Successfully:
```
✅ Connected to MariaDB
✅ Database tables initialized
🚀 Server running on http://localhost:3000
📊 API endpoints available at http://localhost:3000/api
```

### Frontend Connected Successfully:
Browser console shows:
```
✅ Backend server connected - using centralized database
```

### Offline Mode:
Browser console shows:
```
⚠️ Backend unavailable - using local IndexedDB
```

## Benefits

✅ **Centralized Data** - Single source of truth  
✅ **Real-Time Updates** - No manual refresh needed  
✅ **Multi-Device** - Work from anywhere  
✅ **Offline Support** - Works without internet  
✅ **Scalable** - Add unlimited devices  
✅ **Reliable** - Automatic fallback to local storage  

---

**Note:** Make sure MariaDB/MySQL is installed and running before starting the system. The backend will create all necessary tables automatically on first run.
