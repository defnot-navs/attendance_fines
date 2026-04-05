# 📂 Complete File Structure

```
attendance_fines/
│
├── 📁 src/                                # Frontend Source Code
│   ├── 📁 components/                     # React Components
│   │   ├── AttendanceLogs.jsx            # View all attendance records
│   │   ├── FinesSummary.jsx              # Fines overview with stats
│   │   ├── MemberUpload.jsx              # CSV/Excel upload interface
│   │   ├── OnlineMeetingParser.jsx       # Parse meeting attendees
│   │   ├── OnlineStatus.jsx              # Offline/online indicator
│   │   ├── QRScanner.jsx                 # Camera-based QR scanning
│   │   └── Settings.jsx                  # Configure fine rules
│   │
│   ├── 📁 pages/                          # Main Pages
│   │   ├── AdminDashboard.jsx            # Admin interface (tabbed)
│   │   └── StudentView.jsx               # Student portal (view-only)
│   │
│   ├── 📁 db/                             # Database Layer
│   │   └── database.js                   # IndexedDB schema & operations
│   │
│   ├── 📁 utils/                          # Utility Functions
│   │   ├── finesCalculator.js            # Auto-compute fines
│   │   ├── fileParser.js                 # CSV/Excel processing
│   │   ├── nameParser.js                 # Name format validation
│   │   ├── qrParser.js                   # QR code parsing
│   │   └── syncManager.js                # Offline/online sync
│   │
│   ├── App.jsx                           # Main app with routing
│   ├── main.jsx                          # React entry point
│   └── index.css                         # Global styles (Tailwind)
│
├── 📁 server/                             # Backend API
│   ├── index.js                          # Express server (11 endpoints)
│   ├── .env.example                      # Environment template
│   └── .env                              # Your config (create this)
│
├── 📁 database/                           # Database Scripts
│   └── schema.sql                        # MariaDB schema & sample data
│
├── 📁 sample-data/                        # Test Data
│   ├── students-sample.csv               # Sample student list
│   └── online-meeting-sample.txt         # Sample meeting attendees
│
├── 📁 public/                             # Static Assets (auto-generated)
│   └── (PWA icons, manifest, etc.)
│
├── 📄 package.json                        # Dependencies & scripts
├── 📄 vite.config.js                      # Vite & PWA configuration
├── 📄 tailwind.config.js                  # Tailwind CSS setup
├── 📄 postcss.config.js                   # PostCSS configuration
├── 📄 index.html                          # HTML entry point
├── 📄 .gitignore                          # Git ignore rules
│
├── 📖 README.md                           # Complete documentation
├── 📖 QUICKSTART.md                       # Fast setup guide
├── 📖 PROJECT_SUMMARY.md                  # Project overview
├── 📖 DEPLOYMENT.md                       # Production deployment
└── 📖 FILE_STRUCTURE.md                   # This file
```

---

## 📊 Component Relationships

```
App.jsx (Router)
│
├─── /admin → AdminDashboard.jsx
│                 │
│                 ├── Tab: QRScanner.jsx
│                 │         └─ uses: qrParser.js, database.js
│                 │
│                 ├── Tab: MemberUpload.jsx
│                 │         └─ uses: fileParser.js, database.js
│                 │
│                 ├── Tab: OnlineMeetingParser.jsx
│                 │         └─ uses: nameParser.js, database.js, finesCalculator.js
│                 │
│                 ├── Tab: AttendanceLogs.jsx
│                 │         └─ uses: database.js
│                 │
│                 ├── Tab: FinesSummary.jsx
│                 │         └─ uses: database.js, finesCalculator.js, syncManager.js
│                 │
│                 ├── Tab: Settings.jsx
│                 │         └─ uses: database.js, finesCalculator.js
│                 │
│                 └── Header: OnlineStatus.jsx
│                           └─ uses: syncManager.js, database.js
│
└─── /student → StudentView.jsx
                  └─ uses: database.js, finesCalculator.js
```

---

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                 │
│  • QRScanner → qrParser → database.js → IndexedDB          │
│  • MemberUpload → fileParser → database.js → IndexedDB     │
│  • OnlineMeeting → nameParser → database.js → IndexedDB    │
│  • FinesSummary → finesCalculator → database.js            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ├─── Offline Mode ───┐
                         │                     │
                         ▼                     ▼
              ┌──────────────────┐    ┌───────────────┐
              │   IndexedDB       │    │  Sync Queue   │
              │  (Dexie.js)      │    │  (Pending)    │
              └──────────┬───────┘    └───────┬───────┘
                         │                     │
                         └─────────┬───────────┘
                                   │
                          Online Mode │
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   Express API Server      │
                    │   (server/index.js)       │
                    └────────────┬──────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      MariaDB              │
                    │  (Source of Truth)        │
                    └──────────────────────────┘
```

---

## 🗄️ Database Schema (IndexedDB)

```javascript
// IndexedDB Structure (Browser)
AttendanceFinesDB
│
├── students              // Student records
│   ├── id (++)
│   ├── studentId (unique index)
│   ├── lastName
│   ├── firstName
│   ├── middleInitial
│   └── createdAt
│
├── attendance           // Attendance logs
│   ├── id (++)
│   ├── studentId (index)
│   ├── date (index)
│   ├── type (qr|online)
│   ├── status (present|absent|late)
│   ├── timestamp
│   └── synced (boolean)
│
├── fines                // Fine records
│   ├── id (++)
│   ├── studentId (index)
│   ├── amount
│   ├── reason
│   ├── date
│   ├── timestamp
│   └── synced (boolean)
│
├── fineRules            // Configuration
│   ├── id (++)
│   ├── type (absent|late)
│   └── amount
│
└── syncQueue            // Offline sync queue
    ├── id (++)
    ├── table
    ├── action
    ├── data (JSON)
    ├── timestamp
    └── synced (boolean)
```

---

## 🗄️ Database Schema (MariaDB)

```sql
-- MariaDB Structure (Server)
attendance_fines
│
├── students              -- Student records
│   ├── id (PK, AUTO_INCREMENT)
│   ├── student_id (UNIQUE)
│   ├── last_name
│   ├── first_name
│   ├── middle_initial
│   ├── created_at
│   └── updated_at
│
├── attendance           -- Attendance logs
│   ├── id (PK, AUTO_INCREMENT)
│   ├── student_id (FK → students)
│   ├── date
│   ├── type (ENUM: qr, online)
│   ├── status (ENUM: present, absent, late)
│   ├── timestamp
│   └── UNIQUE(student_id, date)
│
├── fines                -- Fine records
│   ├── id (PK, AUTO_INCREMENT)
│   ├── student_id (FK → students)
│   ├── amount (DECIMAL)
│   ├── reason
│   ├── date
│   └── timestamp
│
└── fine_rules           -- Configuration
    ├── id (PK, AUTO_INCREMENT)
    ├── type (UNIQUE)
    ├── amount (DECIMAL)
    └── updated_at
```

---

## 🛠️ Utility Functions Map

```
src/utils/
│
├── qrParser.js
│   ├── parseQRCode()           # Extract Student ID from QR
│   ├── isValidStudentId()      # Validate ID format
│   └── extractFromUrl()        # Parse URL-based QR
│
├── nameParser.js
│   ├── parseName()             # Parse single name
│   ├── parseAttendeeList()     # Parse multi-line text
│   ├── matchStudent()          # Match against database
│   ├── processOnlineMeeting()  # Complete workflow
│   └── validateNameFormat()    # Quick validation
│
├── finesCalculator.js
│   ├── calculateStudentFines()      # Compute student total
│   ├── autoGenerateFines()          # Auto-create fine records
│   ├── getAllStudentsFinesSummary() # Summary for all students
│   ├── getFinesStatistics()         # Overall stats
│   └── formatCurrency()             # Format ₱ display
│
├── fileParser.js
│   ├── parseCSV()              # Parse CSV files
│   ├── parseExcel()            # Parse Excel files
│   ├── validateStudentData()   # Validate uploaded data
│   ├── checkDuplicates()       # Find duplicate IDs
│   └── processStudentFile()    # Main processing function
│
└── syncManager.js
    ├── isOnline()              # Check connection status
    ├── syncToServer()          # Push to MariaDB
    ├── setupAutoSync()         # Auto-sync on reconnect
    ├── getSyncStatus()         # Get sync queue status
    ├── exportData()            # Export to JSON
    └── exportToCSV()           # Export to CSV
```

---

## 🔌 API Endpoints Map

```
Base URL: http://localhost:3000/api

Health & Status:
├── GET  /health                    # Server health check

Sync:
├── POST /sync                      # Sync offline data

Students:
├── GET  /students                  # Get all students
└── GET  /students/:studentId       # Get specific student

Attendance:
├── GET  /attendance                # Get all attendance (limit 1000)
└── GET  /attendance/:studentId     # Get student attendance

Fines:
├── GET  /fines                     # Get fines summary (all students)
└── GET  /fines/:studentId          # Get student fines

Fine Rules:
├── GET  /fine-rules                # Get all fine rules
└── PUT  /fine-rules/:type          # Update fine rule
```

---

## 📦 NPM Scripts

```json
{
  "scripts": {
    "dev": "vite",              // Start dev server (frontend)
    "build": "vite build",      // Build for production
    "preview": "vite preview",  // Preview production build
    "server": "node server/index.js"  // Start backend API
  }
}
```

---

## 🔑 Environment Variables

```bash
# server/.env
DB_HOST=localhost           # Database host
DB_USER=root               # Database user
DB_PASSWORD=your_password  # Database password
DB_NAME=attendance_fines   # Database name
PORT=3000                  # API server port
```

---

## 🎨 Styling System

```
Tailwind CSS Classes Used:

Layout:
├── Container: max-w-7xl mx-auto px-4
├── Grid: grid grid-cols-1 md:grid-cols-2
└── Flex: flex items-center justify-between

Components:
├── Card: bg-white rounded-lg shadow p-6
├── Button: bg-blue-600 text-white px-4 py-2 rounded-lg
├── Input: px-4 py-2 border rounded-lg
└── Badge: px-2 py-1 text-xs rounded

Colors:
├── Primary: blue-600
├── Success: green-600
├── Warning: yellow-600
├── Error: red-600
└── Info: purple-600

Responsive:
├── Mobile First: base classes
├── Tablet: md: prefix
└── Desktop: lg: prefix
```

---

## 🚀 Build Output

```
dist/                      # Production build folder
├── assets/
│   ├── index-[hash].js   # Main JS bundle
│   ├── index-[hash].css  # Compiled CSS
│   └── vendor-[hash].js  # Third-party libraries
├── index.html            # Entry HTML
└── sw.js                 # Service Worker (PWA)
```

---

## 📏 Code Statistics

```
Total Files: 30+
Total Lines: ~5,000+

Breakdown:
├── Components: 7 files (~2,000 lines)
├── Pages: 2 files (~600 lines)
├── Utilities: 5 files (~1,200 lines)
├── Database: 1 file (~400 lines)
├── Server: 1 file (~300 lines)
└── Documentation: 5 files (~2,500 lines)

Languages:
├── JavaScript/JSX: 85%
├── SQL: 5%
├── Markdown: 8%
└── Config: 2%
```

---

## 🎯 Testing Coverage Areas

```
Manual Testing Required:

Frontend:
├── QR Scanning
│   ├── Valid QR codes
│   ├── Invalid QR codes
│   ├── Duplicate scans
│   └── Camera permissions
│
├── File Upload
│   ├── CSV files
│   ├── Excel files
│   ├── Invalid formats
│   └── Duplicate students
│
├── Online Meeting Parser
│   ├── Valid names
│   ├── Invalid formats
│   ├── Missing students
│   └── Absent marking
│
└── Student Portal
    ├── Valid ID lookup
    ├── Invalid ID
    ├── View attendance
    └── View fines

Backend:
├── API Endpoints
│   ├── Health check
│   ├── Data sync
│   ├── CRUD operations
│   └── Error handling
│
└── Database
    ├── Connection
    ├── Queries
    ├── Constraints
    └── Indexes

Offline Mode:
├── Disconnect test
├── Queue building
├── Auto-sync
└── Manual sync
```

---

This structure provides a complete, production-ready offline-first attendance and fines management system! 🎉
