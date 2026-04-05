-- ================================================
-- Attendance & Fines Management System
-- MariaDB/MySQL Database Schema
-- ================================================

-- Create database
CREATE DATABASE IF NOT EXISTS attendance_fines;
USE attendance_fines;

-- ================================================
-- Students/Members Table
-- ================================================
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_initial VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Attendance Records Table
-- ================================================
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    type ENUM('qr', 'online') NOT NULL,
    status ENUM('present', 'absent', 'late') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (student_id, date),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    INDEX idx_date (date),
    INDEX idx_student_date (student_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Fines Table
-- ================================================
CREATE TABLE IF NOT EXISTS fines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    INDEX idx_student_fines (student_id),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Fine Rules Configuration Table
-- ================================================
CREATE TABLE IF NOT EXISTS fine_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Insert Default Fine Rules
-- ================================================
INSERT INTO fine_rules (type, amount) VALUES
    ('absent', 50.00),
    ('late', 20.00)
ON DUPLICATE KEY UPDATE amount = VALUES(amount);

-- ================================================
-- Sample Data (Optional - for testing)
-- ================================================

-- Sample students
INSERT INTO students (student_id, last_name, first_name, middle_initial) VALUES
    ('2021-12345', 'DELA CRUZ', 'JUAN', 'A'),
    ('2021-12346', 'SANTOS', 'MARIA', 'B'),
    ('2021-12347', 'REYES', 'PEDRO', 'C'),
    ('2021-12348', 'GARCIA', 'ANA', 'D'),
    ('2021-12349', 'RAMOS', 'JOSE', 'E')
ON DUPLICATE KEY UPDATE last_name = VALUES(last_name);

-- ================================================
-- Useful Queries
-- ================================================

-- Get student attendance summary
-- SELECT 
--     s.student_id,
--     CONCAT(s.last_name, ', ', s.first_name, ' ', s.middle_initial) as name,
--     COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
--     COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
--     COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count
-- FROM students s
-- LEFT JOIN attendance a ON s.student_id = a.student_id
-- GROUP BY s.student_id, s.last_name, s.first_name, s.middle_initial;

-- Get student fines summary
-- SELECT 
--     s.student_id,
--     CONCAT(s.last_name, ', ', s.first_name, ' ', s.middle_initial) as name,
--     COALESCE(SUM(f.amount), 0) as total_fines,
--     COUNT(f.id) as fine_count
-- FROM students s
-- LEFT JOIN fines f ON s.student_id = f.student_id
-- GROUP BY s.student_id, s.last_name, s.first_name, s.middle_initial
-- ORDER BY total_fines DESC;

-- Get attendance for a specific date
-- SELECT 
--     s.student_id,
--     CONCAT(s.last_name, ', ', s.first_name, ' ', s.middle_initial) as name,
--     COALESCE(a.status, 'no record') as status,
--     a.type
-- FROM students s
-- LEFT JOIN attendance a ON s.student_id = a.student_id AND a.date = '2026-01-24'
-- ORDER BY s.last_name, s.first_name;

-- ================================================
-- Maintenance Queries
-- ================================================

-- Delete old attendance records (older than 1 year)
-- DELETE FROM attendance WHERE date < DATE_SUB(CURDATE(), INTERVAL 1 YEAR);

-- Clear all data (USE WITH CAUTION!)
-- TRUNCATE TABLE fines;
-- TRUNCATE TABLE attendance;
-- TRUNCATE TABLE students;
