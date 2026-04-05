# 🎯 Offline-First Attendance & Fines Management System

A Progressive Web App (PWA) for managing student attendance and fines with offline-first capabilities. Scan existing student QR codes, parse online meeting attendance, and automatically compute fines - all while working offline.

## ✨ Features

### 🔑 Core Capabilities
- **Offline-First Architecture**: All scanning and computation works without internet
- **QR Code Scanning**: Use existing student-issued QR codes
- **Online Meeting Parser**: Parse and validate attendee names from meeting platforms
- **Automatic Fines**: Auto-compute fines based on attendance status
- **Dual Storage**: IndexedDB for offline + MariaDB for online sync
- **Student Portal**: View-only access for students to check their records
- **PWA Support**: Installable on mobile and desktop

### 👥 User Roles

#### Admin
- Upload student/member lists (CSV/Excel)
- Scan QR codes for attendance
- Parse online meeting attendance
- View attendance logs
- Manage fines and rules
- Export data
- Share student portal link

#### Student (View-Only)
- View personal attendance history
- View personal fines breakdown
- No login required - access via Student ID only

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons

### Offline Storage
- **IndexedDB** via Dexie.js
- **Service Worker** for offline caching

### QR Scanning
- **html5-qrcode** for camera-based scanning

### File Processing
- **PapaParse** for CSV parsing
- **XLSX** for Excel file support

### Backend
- **Express.js** REST API
- **MariaDB/MySQL** database
- **CORS** enabled

## 📁 Project Structure

```
attendance_fines/
├── src/
│   ├── components/
│   │   ├── QRScanner.jsx              # QR code scanning
│   │   ├── MemberUpload.jsx           # CSV/Excel upload
│   │   ├── OnlineMeetingParser.jsx    # Online meeting attendance
│   │   ├── AttendanceLogs.jsx         # Attendance history
│   │   ├── FinesSummary.jsx           # Fines overview
│   │   ├── Settings.jsx               # Fine rules config
│   │   └── OnlineStatus.jsx           # Offline/online indicator
│   ├── pages/
│   │   ├── AdminDashboard.jsx         # Admin interface
│   │   └── StudentView.jsx            # Student portal
│   ├── db/
│   │   └── database.js                # IndexedDB schema & operations
│   ├── utils/
│   │   ├── qrParser.js                # QR code parsing logic
│   │   ├── nameParser.js              # Name format validation
│   │   ├── finesCalculator.js         # Fines computation
│   │   ├── fileParser.js              # CSV/Excel processing
│   │   └── syncManager.js             # Offline/online sync
│   ├── App.jsx                        # Main app component
│   ├── main.jsx                       # Entry point
│   └── index.css                      # Global styles
├── server/
│   ├── index.js                       # Express API server
│   └── .env.example                   # Environment template
├── package.json
├── vite.config.js
└── README.md
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ 
- MariaDB or MySQL database
- Modern web browser with camera (for QR scanning)

### Step 1: Clone and Install Dependencies

```bash
cd attendance_fines
npm install
```

### Step 2: Database Setup

1. Create a MariaDB/MySQL database:

```sql
CREATE DATABASE attendance_fines;
```

2. Configure environment variables:

```bash
cd server
cp .env.example .env
```

3. Edit `server/.env` with your database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=attendance_fines
PORT=3000
```

### Step 3: Run the Application

**Development Mode** (runs both frontend and backend):

```bash
# Terminal 1: Start frontend
npm run dev

# Terminal 2: Start backend
npm run server
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

**Production Build**:

```bash
npm run build
npm run preview
```

## 📖 Usage Guide

### For Admins

#### 1. Upload Student List

1. Navigate to **Upload Members** tab
2. Prepare CSV/Excel file with these columns:
   - Student ID
   - LASTNAME
   - FIRSTNAME
   - MIDDLE INITIAL

**Sample CSV Format**:
```csv
Student ID,LASTNAME,FIRSTNAME,MIDDLE INITIAL
2021-12345,DELA CRUZ,JUAN,A
2021-12346,SANTOS,MARIA,B
2021-12347,REYES,PEDRO,C
```

3. Click **Choose File** and select your file
4. System validates and imports data
5. Review any errors or duplicates

#### 2. Scan QR Codes

1. Go to **QR Scanner** tab
2. Click **Start Scanning**
3. Position student QR code in camera view
4. System automatically:
   - Extracts Student ID
   - Validates against database
   - Records attendance
   - Prevents duplicate scans

**Supported QR Formats**:
- Pure Student ID: `2021-12345`
- Text format: `Student: 2021-12345`
- JSON format: `{"studentId": "2021-12345"}`
- URL format: `https://school.edu/student/2021-12345`

#### 3. Process Online Meeting Attendance

1. Copy attendee list from Zoom/Teams/Google Meet
2. Go to **Online Meeting** tab
3. Paste list (one name per line)
4. Click **Process Attendance**

**Valid Name Format**:
```
LASTNAME, FIRSTNAME MIDINIT
```

**Examples**:
```
DELA CRUZ, JUAN A
SANTOS, MARIA B
REYES, PEDRO C
```

System will:
- ✅ Mark matching names as PRESENT
- ⚠️ Mark non-matching students as ABSENT
- ❌ Flag invalid name formats
- 💰 Auto-generate fines for absences

#### 4. View Attendance Logs

- See all attendance records
- Filter by type (QR or Online)
- Real-time updates

#### 5. Manage Fines

- View fines summary for all students
- See statistics (total, average, highest)
- Export to CSV
- Update fine rules in Settings

#### 6. Share Student Portal

1. Go to **Settings** tab
2. Copy the student portal link
3. Share with students via email/LMS/messaging

### For Students

1. Open the shared student portal link
2. Enter your Student ID
3. Click **Search**
4. View your:
   - Attendance history
   - Fines breakdown
   - Total fines

**No account needed!** Access is read-only.

## 🔧 Configuration

### Fine Rules

Default fines (modifiable in Settings):
- **Absent**: ₱50.00
- **Late**: ₱20.00

To change:
1. Admin Dashboard → Settings
2. Update amounts
3. Click Update

### QR Code Parsing

The system supports multiple QR formats. To add custom patterns, edit:

```javascript
// src/utils/qrParser.js
const patterns = [
  /\b(\d{4}[-_]?\d{4,6})\b/,  // Add your pattern here
];
```

### Name Format Validation

To customize name parsing rules, edit:

```javascript
// src/utils/nameParser.js
export function parseName(nameLine) {
  // Customize validation logic
}
```

## 💾 Offline/Online Sync

### How It Works

1. **Offline Mode**:
   - All data stored in IndexedDB (browser storage)
   - Changes queued for sync
   - Full functionality maintained

2. **Online Mode**:
   - Auto-sync when connection restored
   - Manual sync via "Sync Now" button
   - Resolves conflicts using timestamps

3. **Data Flow**:
   ```
   IndexedDB (Local) ←→ Sync Queue ←→ MariaDB (Server)
   ```

### Manual Sync

1. Check online status indicator (top right)
2. If pending items shown, click **Sync Now**
3. Review sync results

## 📤 Data Export

### Export Fines (CSV)

1. Go to **Fines Summary**
2. Click **Export CSV**
3. File downloads with format:
   ```csv
   Student ID,Name,Total Fines,Fine Count
   2021-12345,"DELA CRUZ, JUAN A",100.00,2
   ```

### Backup All Data (JSON)

Use browser console:

```javascript
import { exportData } from './utils/syncManager';
import { getAllStudents, getAllAttendance, getAllFines } from './db/database';

const students = await getAllStudents();
const attendance = await getAllAttendance();
const fines = await getAllFines();
await exportData(students, attendance, fines);
```

## 🔒 Security

- **No Authentication**: Student portal uses Student ID only
- **Read-Only Access**: Students cannot modify data
- **QR Codes**: Should not contain sensitive information
- **CORS**: Configured for frontend-backend communication
- **Environment Variables**: Database credentials secured via .env

## 🐛 Troubleshooting

### QR Scanner Not Working

- **Grant camera permissions** in browser
- Use **HTTPS** (required for camera access)
- Check browser compatibility (Chrome, Edge, Safari recommended)

### Offline Mode Issues

- Clear browser cache and reload
- Check IndexedDB in DevTools → Application → Storage
- Ensure Service Worker is registered

### Database Connection Failed

- Verify MariaDB is running
- Check .env credentials
- Ensure database exists
- Review server logs

### Name Parser Rejecting Valid Names

- Format must be: `LASTNAME, FIRSTNAME MIDINIT`
- Check for extra spaces or special characters
- Middle initial required (1-2 letters)

## 📱 PWA Installation

### Mobile (Android/iOS)

1. Open app in browser
2. Tap browser menu (⋮)
3. Select "Add to Home Screen"
4. App installs like native app

### Desktop (Chrome/Edge)

1. Open app
2. Click install icon in address bar
3. Confirm installation

## 🔄 API Endpoints

### Backend REST API

Base URL: `http://localhost:3000/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/sync` | POST | Sync offline data |
| `/students` | GET | Get all students |
| `/students/:id` | GET | Get student by ID |
| `/attendance` | GET | Get all attendance |
| `/attendance/:id` | GET | Student attendance |
| `/fines` | GET | Fines summary |
| `/fines/:id` | GET | Student fines |
| `/fine-rules` | GET | Get fine rules |
| `/fine-rules/:type` | PUT | Update fine rule |

## 🎨 Customization

### Branding

Edit colors in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#3b82f6',  // Change brand color
    }
  }
}
```

### UI Text

Edit component files in `src/components/` and `src/pages/`

## 📊 Database Schema

### Students Table
```sql
student_id (VARCHAR, PRIMARY KEY)
last_name (VARCHAR)
first_name (VARCHAR)
middle_initial (VARCHAR)
created_at (TIMESTAMP)
```

### Attendance Table
```sql
id (INT, AUTO_INCREMENT)
student_id (VARCHAR, FOREIGN KEY)
date (DATE)
type (ENUM: 'qr', 'online')
status (ENUM: 'present', 'absent', 'late')
timestamp (TIMESTAMP)
```

### Fines Table
```sql
id (INT, AUTO_INCREMENT)
student_id (VARCHAR, FOREIGN KEY)
amount (DECIMAL)
reason (VARCHAR)
date (DATE)
timestamp (TIMESTAMP)
```

### Fine Rules Table
```sql
id (INT, AUTO_INCREMENT)
type (VARCHAR, UNIQUE)
amount (DECIMAL)
updated_at (TIMESTAMP)
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is open source and available for educational purposes.

## 🆘 Support

For issues, questions, or suggestions:
1. Check this README
2. Review troubleshooting section
3. Open an issue on GitHub

## 🙏 Acknowledgments

- Built with React, Vite, and Tailwind CSS
- QR scanning powered by html5-qrcode
- Icons from Lucide React
- Offline storage via Dexie.js

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Status**: Production Ready ✅
