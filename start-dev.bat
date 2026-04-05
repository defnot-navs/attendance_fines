@echo off
title Attendance & Fines System - Quick Start

echo ========================================
echo Attendance ^& Fines Management System
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] node_modules not found!
    echo Running npm install...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo.
)

REM Check if .env exists
if not exist "server\.env" (
    echo [WARNING] server\.env not found!
    echo Please create server\.env from server\.env.example
    echo and configure your database credentials.
    echo.
    pause
    exit /b 1
)

echo Starting development servers...
echo.
echo [INFO] Frontend will run on http://localhost:5173
echo [INFO] Backend will run on http://localhost:3000
echo.
echo Press Ctrl+C in either window to stop the servers
echo.

REM Start backend in new window
start "Backend API Server" cmd /k "cd /d %~dp0 && npm run server"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in new window
start "Frontend Dev Server" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo [SUCCESS] Both servers are starting...
echo.
echo Access the application:
echo - Admin Dashboard: http://localhost:5173/admin
echo - Student Portal: http://localhost:5173/student
echo - API Health: http://localhost:3000/api/health
echo.
echo Close this window or press any key to exit.
pause > nul
