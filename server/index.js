import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_fines',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let pool;

async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Connected to MariaDB');
    
    // Create tables if they don't exist
    await createTables(connection);

    // Apply light migrations for existing installs
    await migrateTables(connection);
    
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('Server will continue without database connection');
  }
}

async function migrateTables(connection) {
  // Add session column to attendance if missing
  try {
    await connection.query(
      `ALTER TABLE attendance 
       ADD COLUMN session VARCHAR(20) NOT NULL DEFAULT 'AM_IN' AFTER date`
    );
    console.log('✅ Migrated attendance: added session column');
  } catch (error) {
    // ER_DUP_FIELDNAME: column already exists
    if (error.code !== 'ER_DUP_FIELDNAME') {
      console.warn('⚠️ Attendance migration skipped/failed:', error.message);
    }
  }

  // Ensure a unique index exists for (student_id, event_id, date, session)
  // Note: event_id NULL uniqueness is still enforced in code using null-safe checks.
  try {
    await connection.query('ALTER TABLE attendance DROP INDEX unique_attendance');
  } catch (error) {
    // index might not exist; ignore
  }
  try {
    await connection.query(
      'ALTER TABLE attendance ADD UNIQUE KEY unique_attendance (student_id, event_id, date, session)'
    );
    console.log('✅ Migrated attendance: updated unique index');
  } catch (error) {
    // Ignore if index already exists with same definition
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.warn('⚠️ Attendance index migration skipped/failed:', error.message);
    }
  }
}

async function createTables(connection) {
  // Students table - enhanced with yearLevel and program
  await connection.query(`
    CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) UNIQUE NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      middle_initial VARCHAR(10) NOT NULL,
      year_level INT DEFAULT 1,
      program VARCHAR(50) DEFAULT '',
      email VARCHAR(100) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Events table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      late_threshold TIME NOT NULL,
      end_time TIME NOT NULL,
      fine_amount DECIMAL(10, 2) DEFAULT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Attendance table - enhanced with eventId
  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL,
      event_id INT DEFAULT NULL,
      date DATE NOT NULL,
      session VARCHAR(20) NOT NULL DEFAULT 'AM_IN',
      type ENUM('qr', 'online', 'manual') NOT NULL,
      status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_attendance (student_id, event_id, date, session),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
    )
  `);

  // Fines table - enhanced with paid status
  await connection.query(`
    CREATE TABLE IF NOT EXISTS fines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL,
      event_id INT DEFAULT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMP NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
    )
  `);

  // Fine rules table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS fine_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) UNIQUE NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Excuses table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS excuses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      start_time TIME DEFAULT NULL,
      end_time TIME DEFAULT NULL,
      description TEXT,
      file_name VARCHAR(255) DEFAULT NULL,
      file_data LONGTEXT DEFAULT NULL,
      approved BOOLEAN DEFAULT TRUE,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_student_id (student_id),
      CONSTRAINT fk_excuses_student 
        FOREIGN KEY (student_id) 
        REFERENCES students(student_id) 
        ON DELETE CASCADE
    )
  `);

  // Membership payments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS membership_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) UNIQUE NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      paid BOOLEAN DEFAULT FALSE,
      paid_at TIMESTAMP NULL,
      payment_method VARCHAR(50) DEFAULT NULL,
      receipt_number VARCHAR(100) DEFAULT NULL,
      national_membership BOOLEAN DEFAULT FALSE,
      national_receipt_number VARCHAR(100) DEFAULT NULL,
      academic_year VARCHAR(20) NOT NULL,
      semester VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Database tables initialized');
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: pool ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ===== STUDENTS =====

// Add student
app.post('/api/students', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { studentId, lastName, firstName, middleInitial, yearLevel, program, email } = req.body;

  try {
    await pool.query(
      'INSERT INTO students (student_id, last_name, first_name, middle_initial, year_level, program, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [studentId, lastName, firstName, middleInitial, yearLevel || 1, program || '', email || '']
    );
    res.json({ success: true, studentId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: `Student ID ${studentId} already exists` });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM students ORDER BY last_name, first_name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get student by ID
app.get('/api/students/:studentId', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM students WHERE student_id = ?', [req.params.studentId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { lastName, firstName, middleInitial, yearLevel, program } = req.body;

  try {
    await pool.query(
      'UPDATE students SET last_name = ?, first_name = ?, middle_initial = ?, year_level = ?, program = ? WHERE id = ?',
      [lastName, firstName, middleInitial, yearLevel, program, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all students
app.delete('/api/students', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [result] = await pool.query('DELETE FROM students');
    res.json({ success: true, count: result.affectedRows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== EVENTS =====

// Add event
app.post('/api/events', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { name, date, startTime, lateThreshold, endTime, fineAmount, description } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO events (name, date, start_time, late_threshold, end_time, fine_amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, date, startTime, lateThreshold, endTime, fineAmount, description]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events
app.get('/api/events', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM events ORDER BY date DESC, start_time DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete event
app.delete('/api/events/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark remaining students as absent for an event
app.post('/api/events/:id/mark-absent', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const eventId = Number(req.params.id);
  if (!Number.isFinite(eventId)) {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [events] = await connection.query('SELECT * FROM events WHERE id = ? LIMIT 1', [eventId]);
    const event = events[0];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const [ruleRows] = await connection.query(
      'SELECT amount FROM fine_rules WHERE type = ? LIMIT 1',
      ['absent']
    );
    const absentFineAmount = ruleRows.length > 0 ? Number(ruleRows[0].amount) : 0;

    // Students with no attendance record for this event (any session)
    const [missingRows] = await connection.query(
      `SELECT s.student_id
       FROM students s
       LEFT JOIN attendance a
         ON a.student_id = s.student_id AND a.event_id = ?
       WHERE a.id IS NULL`,
      [eventId]
    );

    const studentsToMark = missingRows.map(r => r.student_id).filter(Boolean);

    await connection.beginTransaction();

    let markedCount = 0;
    for (const studentId of studentsToMark) {
      await connection.query(
        'INSERT INTO attendance (student_id, event_id, date, session, type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [studentId, eventId, event.date, 'AM_IN', 'manual', 'absent']
      );

      if (absentFineAmount > 0) {
        await connection.query(
          'INSERT INTO fines (student_id, event_id, amount, reason, date) VALUES (?, ?, ?, ?, ?)',
          [studentId, eventId, absentFineAmount, `Absent - ${event.name}`, event.date]
        );
      }

      markedCount++;
    }

    await connection.commit();

    res.json({
      success: true,
      markedCount,
      eventName: event.name,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore
      }
    }
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ===== ATTENDANCE =====

// Record attendance
app.post('/api/attendance', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { studentId, eventId, date, type, status, session } = req.body;
  const rawEventId = eventId && typeof eventId === 'object' ? eventId.id : eventId;
  const normalizedEventId =
    rawEventId === null || rawEventId === undefined || rawEventId === ''
      ? null
      : Number(rawEventId);

  if (normalizedEventId !== null && !Number.isFinite(normalizedEventId)) {
    return res.status(400).json({ error: 'Invalid eventId' });
  }
  const attendanceSession = session || 'AM_IN';

  try {
    // Enforce uniqueness even when eventId is NULL (MySQL UNIQUE allows multiple NULLs)
    const [existing] = await pool.query(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND session = ? AND (event_id <=> ?) LIMIT 1',
      [studentId, date, attendanceSession, normalizedEventId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Attendance already recorded' });
    }

    await pool.query(
      'INSERT INTO attendance (student_id, event_id, date, session, type, status) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, normalizedEventId, date, attendanceSession, type, status]
    );
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Attendance already recorded' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all attendance logs
app.get('/api/attendance', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM attendance ORDER BY timestamp DESC LIMIT 1000');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance for a student
app.get('/api/attendance/:studentId', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC',
      [req.params.studentId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete attendance record
app.delete('/api/attendance/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM attendance WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all attendance
app.delete('/api/attendance', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM attendance');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== FINES =====

// Add fine
app.post('/api/fines', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { studentId, eventId, amount, reason, date } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO fines (student_id, event_id, amount, reason, date) VALUES (?, ?, ?, ?, ?)',
      [studentId, eventId, amount, reason, date]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get fines for a student
app.get('/api/fines/:studentId', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM fines WHERE student_id = ? ORDER BY date DESC',
      [req.params.studentId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all fines
app.get('/api/fines', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM fines ORDER BY date DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark fine as paid
app.put('/api/fines/:id/pay', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('UPDATE fines SET paid = TRUE, paid_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all fines
app.delete('/api/fines', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM fines');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get fines summary
app.get('/api/fines-summary', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query(`
      SELECT 
        s.student_id,
        s.id,
        s.last_name,
        s.first_name,
        s.middle_initial,
        s.year_level,
        s.program,
        COALESCE(SUM(f.amount), 0) as total_fines,
        COALESCE(SUM(CASE WHEN f.paid = FALSE THEN f.amount ELSE 0 END), 0) as unpaid_fines,
        COUNT(f.id) as fine_count
      FROM students s
      LEFT JOIN fines f ON s.student_id = f.student_id
      GROUP BY s.id, s.student_id, s.last_name, s.first_name, s.middle_initial, s.year_level, s.program
      HAVING total_fines > 0
      ORDER BY total_fines DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== EXCUSES =====

// Add excuse
app.post('/api/excuses', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { studentId, type, startDate, endDate, startTime, endTime, description, fileName, fileData } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO excuses (student_id, type, start_date, end_date, start_time, end_time, description, file_name, file_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [studentId, type, startDate, endDate, startTime, endTime, description, fileName, fileData]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all excuses
app.get('/api/excuses', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM excuses ORDER BY uploaded_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete excuse
app.delete('/api/excuses/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM excuses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all excuses
app.delete('/api/excuses', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM excuses');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== MEMBERSHIP PAYMENTS =====

// Initialize membership payments
app.post('/api/membership/initialize', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { academicYear, semester, amount } = req.body;

  try {
    const [students] = await pool.query('SELECT student_id FROM students');
    
    for (const student of students) {
      await pool.query(
        `INSERT INTO membership_payments (student_id, amount, academic_year, semester) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year), semester = VALUES(semester), amount = VALUES(amount)`,
        [student.student_id, amount, academicYear, semester]
      );
    }
    
    res.json({ success: true, count: students.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all membership payments
app.get('/api/membership', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query(`
      SELECT m.*, s.last_name, s.first_name, s.middle_initial, s.year_level, s.program
      FROM membership_payments m
      JOIN students s ON m.student_id = s.student_id
      ORDER BY s.last_name, s.first_name
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark membership as paid
app.put('/api/membership/:id/pay', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { paymentMethod, receiptNumber, nationalMembership, nationalReceiptNumber } = req.body;

  try {
    await pool.query(
      'UPDATE membership_payments SET paid = TRUE, paid_at = NOW(), payment_method = ?, receipt_number = ?, national_membership = ?, national_receipt_number = ? WHERE id = ?',
      [paymentMethod, receiptNumber, nationalMembership, nationalReceiptNumber, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all membership payments
app.delete('/api/membership', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    await pool.query('DELETE FROM membership_payments');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== FINE RULES =====

// Get fine rules
app.get('/api/fine-rules', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const [rows] = await pool.query('SELECT * FROM fine_rules');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update fine rule
app.put('/api/fine-rules/:type', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { amount } = req.body;

  try {
    await pool.query(
      'INSERT INTO fine_rules (type, amount) VALUES (?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)',
      [req.params.type, amount]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌐 Network: http://192.168.1.8:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  });
});

export default app;
