-- Reset Database Script for Laragon
-- Run this in HeidiSQL or phpMyAdmin if you have table issues

-- Drop database if exists and recreate
DROP DATABASE IF EXISTS attendance_fines;
CREATE DATABASE attendance_fines;
USE attendance_fines;

-- The Node.js server will automatically create all tables on next start
-- This just ensures a clean slate

SELECT 'Database reset complete. Run npm start to create tables.' AS message;
