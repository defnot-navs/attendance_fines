# 🏗️ System Architecture

## Complete Offline-First Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐      ┌──────────────────────────────┐   │
│  │    ADMIN DASHBOARD            │      │    STUDENT PORTAL             │   │
│  │  (http://localhost:5173/admin)│      │  (http://localhost:5173/student) │
│  ├──────────────────────────────┤      ├──────────────────────────────┤   │
│  │  • QR Scanner                 │      │  • Search by Student ID       │   │
│  │  • Upload Members (CSV/Excel) │      │  • View Attendance History    │   │
│  │  • Online Meeting Parser      │      │  • View Fines Breakdown       │   │
│  │  • Attendance Logs            │      │  • Read-Only Access           │   │
│  │  • Fines Summary              │      │                               │   │
│  │  • Settings                   │      │                               │   │
│  │  • Offline/Online Indicator   │      │                               │   │
│  └──────────────┬───────────────┘      └──────────────┬───────────────┘   │
│                 │                                       │                    │
└─────────────────┼───────────────────────────────────────┼───────────────────┘
                  │                                       │
                  └───────────────┬───────────────────────┘
                                  │
                                  ▼
         ┌────────────────────────────────────────────────────────┐
         │              REACT COMPONENTS LAYER                     │
         ├────────────────────────────────────────────────────────┤
         │                                                         │
         │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
         │  │ QRScanner.jsx│  │MemberUpload  │  │OnlineMeeting│ │
         │  │              │  │    .jsx      │  │Parser.jsx   │ │
         │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
         │         │                 │                  │         │
         │  ┌──────▼───────┐  ┌─────▼────────┐  ┌─────▼──────┐ │
         │  │Attendance    │  │FinesSummary  │  │Settings    │ │
         │  │Logs.jsx      │  │   .jsx       │  │  .jsx      │ │
         │  └──────────────┘  └──────────────┘  └────────────┘ │
         │                                                        │
         └────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
         ┌────────────────────────────────────────────────────────┐
         │               UTILITY FUNCTIONS LAYER                   │
         ├────────────────────────────────────────────────────────┤
         │                                                         │
         │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
         │  │ qrParser.js  │  │nameParser.js │  │fileParser.js│ │
         │  │              │  │              │  │             │ │
         │  │• parseQR()   │  │• parseName() │  │• parseCSV() │ │
         │  │• validate()  │  │• match()     │  │• parseXLSX()│ │
         │  └──────────────┘  └──────────────┘  └─────────────┘ │
         │                                                         │
         │  ┌──────────────┐  ┌──────────────────────────────┐  │
         │  │finesCalc.js  │  │    syncManager.js            │  │
         │  │              │  │                              │  │
         │  │• calculate() │  │• syncToServer()              │  │
         │  │• autoGen()   │  │• exportData()                │  │
         │  └──────────────┘  └──────────────────────────────┘  │
         │                                                         │
         └────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
         ┌────────────────────────────────────────────────────────┐
         │           DATABASE ABSTRACTION LAYER                    │
         │                  (database.js)                          │
         ├────────────────────────────────────────────────────────┤
         │                                                         │
         │  • addStudent()          • getAllStudents()            │
         │  • recordAttendance()    • getStudentAttendance()      │
         │  • recordFine()          • getStudentFines()           │
         │  • getFineRules()        • updateFineRule()            │
         │  • getSyncQueue()        • markAsSynced()              │
         │                                                         │
         └────────────────────────┬───────────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
                  ▼                               ▼
    ┌──────────────────────────┐    ┌──────────────────────────┐
    │   OFFLINE STORAGE         │    │   SYNC QUEUE             │
    │   (IndexedDB / Dexie.js)  │    │   (Pending Changes)      │
    ├──────────────────────────┤    ├──────────────────────────┤
    │                           │    │                           │
    │  • students               │    │  • table: 'students'      │
    │  • attendance             │    │  • action: 'add'          │
    │  • fines                  │    │  • data: {...}            │
    │  • fineRules              │    │  • synced: false          │
    │                           │    │                           │
    │  ✅ Works OFFLINE         │    │  ✅ Queues for later      │
    │  ✅ Browser-based         │    │  ✅ Auto-sync on online   │
    │  ✅ No installation       │    │                           │
    └──────────────────────────┘    └────────────┬──────────────┘
                                                  │
                              ┌───────────────────┘
                              │ When Online
                              │
                              ▼
                  ┌──────────────────────────────────┐
                  │     NETWORK BOUNDARY              │
                  │  (Online Mode Required Beyond)    │
                  └──────────────┬───────────────────┘
                                 │
                                 ▼
         ┌────────────────────────────────────────────────────────┐
         │              BACKEND API SERVER                         │
         │         (Express.js on port 3000)                       │
         ├────────────────────────────────────────────────────────┤
         │                                                         │
         │  REST API Endpoints:                                   │
         │  ┌──────────────────────────────────────────────────┐ │
         │  │ GET  /api/health          - Health check         │ │
         │  │ POST /api/sync            - Sync offline data    │ │
         │  │ GET  /api/students        - Get all students     │ │
         │  │ GET  /api/students/:id    - Get student          │ │
         │  │ GET  /api/attendance      - Get all attendance   │ │
         │  │ GET  /api/attendance/:id  - Get student attend.  │ │
         │  │ GET  /api/fines           - Get fines summary    │ │
         │  │ GET  /api/fines/:id       - Get student fines    │ │
         │  │ GET  /api/fine-rules      - Get fine rules       │ │
         │  │ PUT  /api/fine-rules/:type - Update fine rule    │ │
         │  └──────────────────────────────────────────────────┘ │
         │                                                         │
         │  Features:                                             │
         │  • CORS enabled                                        │
         │  • Connection pooling                                  │
         │  • Error handling                                      │
         │  • Auto-create tables                                  │
         │                                                         │
         └────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
         ┌────────────────────────────────────────────────────────┐
         │              PERSISTENT DATABASE                        │
         │         (MariaDB/MySQL on port 3306)                    │
         ├────────────────────────────────────────────────────────┤
         │                                                         │
         │  Tables:                                               │
         │  ┌──────────────────────────────────────────────────┐ │
         │  │ students       - Student records                 │ │
         │  │ attendance     - Attendance logs                 │ │
         │  │ fines          - Fine records                    │ │
         │  │ fine_rules     - Configuration                   │ │
         │  └──────────────────────────────────────────────────┘ │
         │                                                         │
         │  Features:                                             │
         │  • Source of truth for all data                        │
         │  • Indexed for performance                             │
         │  • Foreign key constraints                             │
         │  • Timestamp tracking                                  │
         │  • Backup ready                                        │
         │                                                         │
         └────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Scenarios

### Scenario 1: QR Code Scanning (Offline)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Admin clicks "Start Scanning" in QRScanner component        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. html5-qrcode activates camera and starts scanning           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. QR code detected, raw content captured                       │
│    Example: "Student: 2021-12345"                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. qrParser.parseQRCode() extracts Student ID                  │
│    Result: "2021-12345"                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. database.getStudentByStudentId() looks up in IndexedDB      │
│    ✅ Found: Continue to step 6                                 │
│    ❌ Not found: Show error message                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. database.recordAttendance() saves to IndexedDB              │
│    • studentId: "2021-12345"                                    │
│    • date: "2026-01-24"                                         │
│    • type: "qr"                                                 │
│    • status: "present"                                          │
│    • synced: false                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Add to sync queue for later upload to server                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Show success message to admin                               │
│    ✅ "DELA CRUZ, JUAN A - Attendance recorded"                 │
└─────────────────────────────────────────────────────────────────┘

⭐ Total time: < 1 second
⭐ Works 100% offline
⭐ No server required
```

---

### Scenario 2: Online Meeting Attendance (Offline)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Admin pastes attendee list into OnlineMeetingParser         │
│    DELA CRUZ, JUAN A                                            │
│    SANTOS, MARIA B                                              │
│    INVALID NAME                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Click "Process Attendance"                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. nameParser.parseAttendeeList() processes each line          │
│    • Line 1: ✅ Valid format                                     │
│    • Line 2: ✅ Valid format                                     │
│    • Line 3: ❌ Invalid format                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. database.getAllStudents() fetches from IndexedDB            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. nameParser.matchStudent() matches each name                 │
│    • DELA CRUZ, JUAN A: ✅ Match found → PRESENT                │
│    • SANTOS, MARIA B: ✅ Match found → PRESENT                  │
│    • Other students: ❌ No match → ABSENT                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. For each PRESENT student:                                   │
│    • database.recordAttendance(id, 'online', 'present')         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. For each ABSENT student:                                    │
│    • database.recordAttendance(id, 'online', 'absent')          │
│    • finesCalculator.autoGenerateFines(id, date, 'absent')      │
│    • database.recordFine(id, amount, reason, date)              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Display results:                                             │
│    ✅ Present: 2                                                 │
│    ❌ Absent: 3 (fines generated)                               │
│    ⚠️ Invalid: 1                                                │
└─────────────────────────────────────────────────────────────────┘

⭐ Batch processing
⭐ Auto-generates fines
⭐ All offline
```

---

### Scenario 3: Sync to Server (Online)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. System detects internet connection restored                 │
│    • navigator.onLine = true                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. setupAutoSync() triggers automatic sync                      │
│    OR admin clicks "Sync Now" button                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. database.getSyncQueue() retrieves pending items             │
│    Example:                                                     │
│    • 15 attendance records                                      │
│    • 5 fine records                                             │
│    • 2 student records                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. For each item in queue:                                     │
│    POST /api/sync with:                                         │
│    {                                                            │
│      table: "attendance",                                       │
│      action: "add",                                             │
│      data: {studentId, date, type, status},                     │
│      timestamp: "2026-01-24T10:30:00Z"                          │
│    }                                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Express API receives request                                │
│    • Validates data                                             │
│    • Executes SQL query to MariaDB                              │
│    • Uses ON DUPLICATE KEY UPDATE for conflicts                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. If successful:                                               │
│    • Server responds with {success: true}                       │
│    • database.markAsSynced(id) updates sync queue               │
│    • Remove from pending items                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Show sync results:                                           │
│    ✅ Synced: 22 items                                           │
│    ❌ Failed: 0 items                                            │
└─────────────────────────────────────────────────────────────────┘

⭐ Automatic on reconnect
⭐ Manual trigger available
⭐ Conflict resolution
```

---

### Scenario 4: Student Viewing Records (Online/Offline)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Student opens portal: http://localhost:5173/student         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Enters Student ID: "2021-12345"                             │
│    Clicks "Search"                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. database.getStudentByStudentId() queries IndexedDB          │
│    ✅ Found: Continue                                            │
│    ❌ Not found: Show "Student ID not found"                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Fetch data in parallel:                                     │
│    • database.getStudentAttendance(id)                          │
│    • database.getStudentFines(id)                               │
│    • database.getStudentTotalFines(id)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Display student information:                                │
│    ┌───────────────────────────────────────────────────────┐  │
│    │ DELA CRUZ, JUAN A (2021-12345)                        │  │
│    │                                                        │  │
│    │ Attendance: 15 records                                │  │
│    │ Total Fines: ₱150.00                                  │  │
│    │                                                        │  │
│    │ Attendance History:                                   │  │
│    │ • 2026-01-24: Present (QR)                            │  │
│    │ • 2026-01-23: Present (Online)                        │  │
│    │ • 2026-01-22: Absent (Online) → Fine: ₱50            │  │
│    │                                                        │  │
│    │ Fines Breakdown:                                      │  │
│    │ • 2026-01-22: Absent - ₱50.00                         │  │
│    │ • 2026-01-20: Absent - ₱50.00                         │  │
│    │ • 2026-01-18: Late - ₱20.00                           │  │
│    │                                                        │  │
│    │ Total: ₱150.00                                         │  │
│    └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

⭐ Works offline (reads IndexedDB)
⭐ Works online (can sync latest)
⭐ Read-only interface
```

---

## 🎨 Component Hierarchy

```
App.jsx (Router)
│
├── Route: /admin
│   │
│   └── AdminDashboard.jsx
│       │
│       ├── Header
│       │   └── OnlineStatus.jsx
│       │       ├── isOnline()
│       │       ├── getSyncStatus()
│       │       └── syncToServer()
│       │
│       └── Tabs
│           │
│           ├── QRScanner.jsx
│           │   ├── html5-qrcode
│           │   ├── parseQRCode()
│           │   ├── getStudentByStudentId()
│           │   └── recordAttendance()
│           │
│           ├── MemberUpload.jsx
│           │   ├── processStudentFile()
│           │   ├── parseCSV()
│           │   ├── parseExcel()
│           │   ├── validateStudentData()
│           │   └── addStudent()
│           │
│           ├── OnlineMeetingParser.jsx
│           │   ├── parseAttendeeList()
│           │   ├── parseName()
│           │   ├── matchStudent()
│           │   ├── recordAttendance()
│           │   └── autoGenerateFines()
│           │
│           ├── AttendanceLogs.jsx
│           │   ├── getAllAttendance()
│           │   └── getAllStudents()
│           │
│           ├── FinesSummary.jsx
│           │   ├── getAllStudentsFinesSummary()
│           │   ├── getFinesStatistics()
│           │   ├── formatCurrency()
│           │   └── exportToCSV()
│           │
│           └── Settings.jsx
│               ├── getFineRules()
│               └── updateFineRule()
│
└── Route: /student
    │
    └── StudentView.jsx
        ├── getStudentByStudentId()
        ├── getStudentAttendance()
        ├── getStudentFines()
        ├── getStudentTotalFines()
        └── formatCurrency()
```

---

## 💾 Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   CLIENT-SIDE (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IndexedDB: AttendanceFinesDB                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  students (5 fields)                                   │    │
│  │  ├── id, studentId, lastName, firstName, middleInitial │    │
│  │  └── Index on: studentId                               │    │
│  │                                                         │    │
│  │  attendance (6 fields)                                 │    │
│  │  ├── id, studentId, date, type, status, timestamp      │    │
│  │  └── Compound index on: [studentId, date]             │    │
│  │                                                         │    │
│  │  fines (6 fields)                                      │    │
│  │  ├── id, studentId, amount, reason, date, timestamp    │    │
│  │  └── Index on: studentId                               │    │
│  │                                                         │    │
│  │  fineRules (2 fields)                                  │    │
│  │  ├── id, type, amount                                  │    │
│  │  └── Index on: type                                    │    │
│  │                                                         │    │
│  │  syncQueue (5 fields)                                  │    │
│  │  ├── id, table, action, data, timestamp, synced        │    │
│  │  └── Index on: synced                                  │    │
│  │                                                         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Service Worker Cache                                           │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  • Static assets (JS, CSS, HTML, images)              │    │
│  │  • Google Fonts                                        │    │
│  │  • Application shell                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   SERVER-SIDE (MariaDB)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Database: attendance_fines                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  students (6 fields)                                   │    │
│  │  ├── id, student_id (UNIQUE), last_name, first_name,   │    │
│  │  │   middle_initial, created_at, updated_at            │    │
│  │  └── Indexes: student_id, (last_name, first_name)     │    │
│  │                                                         │    │
│  │  attendance (6 fields)                                 │    │
│  │  ├── id, student_id (FK), date, type, status,          │    │
│  │  │   timestamp                                         │    │
│  │  └── Unique: (student_id, date)                       │    │
│  │  └── Indexes: date, (student_id, date)                │    │
│  │                                                         │    │
│  │  fines (6 fields)                                      │    │
│  │  ├── id, student_id (FK), amount, reason, date,        │    │
│  │  │   timestamp                                         │    │
│  │  └── Indexes: student_id, date                        │    │
│  │                                                         │    │
│  │  fine_rules (3 fields)                                 │    │
│  │  ├── id, type (UNIQUE), amount, updated_at             │    │
│  │  └── Index: type                                       │    │
│  │                                                         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

This architecture ensures:
✅ **Offline-first** - Full functionality without internet
✅ **Fast** - IndexedDB queries are instant
✅ **Reliable** - Sync queue prevents data loss
✅ **Scalable** - Indexed for performance
✅ **Secure** - Read-only student access
