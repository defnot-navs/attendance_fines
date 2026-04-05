# Quick Development Starter for PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Attendance & Fines Management System" -ForegroundColor Cyan
Write-Host "Quick Development Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[WARNING] node_modules not found!" -ForegroundColor Yellow
    Write-Host "Running npm install..." -ForegroundColor Yellow
    Write-Host ""
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed!" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host ""
}

# Check if .env exists
if (-not (Test-Path "server\.env")) {
    Write-Host "[WARNING] server\.env not found!" -ForegroundColor Yellow
    Write-Host "Please create server\.env from server\.env.example" -ForegroundColor Yellow
    Write-Host "and configure your database credentials." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "Starting development servers..." -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Frontend will run on http://localhost:5173" -ForegroundColor Cyan
Write-Host "[INFO] Backend will run on http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the servers" -ForegroundColor Yellow
Write-Host ""

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run server" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "[SUCCESS] Both servers are starting in new windows..." -ForegroundColor Green
Write-Host ""
Write-Host "Access the application:" -ForegroundColor Cyan
Write-Host "- Admin Dashboard: http://localhost:5173/admin" -ForegroundColor White
Write-Host "- Student Portal: http://localhost:5173/student" -ForegroundColor White
Write-Host "- API Health: http://localhost:3000/api/health" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this launcher..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
