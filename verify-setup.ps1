# Installation Verification Script
# Run this after installation to verify everything is set up correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Attendance & Fines System - Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# Check Node.js
Write-Host "Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version
    if ($nodeVersion -match "v(\d+)\.") {
        $majorVersion = [int]$Matches[1]
        if ($majorVersion -ge 18) {
            Write-Host " OK ($nodeVersion)" -ForegroundColor Green
        } else {
            Write-Host " WARNING - Version $nodeVersion found, 18+ recommended" -ForegroundColor Yellow
            $warnings++
        }
    }
} catch {
    Write-Host " FAILED - Node.js not found" -ForegroundColor Red
    $errors++
}

# Check npm
Write-Host "Checking npm..." -NoNewline
try {
    $npmVersion = npm --version
    Write-Host " OK (v$npmVersion)" -ForegroundColor Green
} catch {
    Write-Host " FAILED - npm not found" -ForegroundColor Red
    $errors++
}

# Check if package.json exists
Write-Host "Checking package.json..." -NoNewline
if (Test-Path "package.json") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED - package.json not found" -ForegroundColor Red
    $errors++
}

# Check if node_modules exists
Write-Host "Checking node_modules..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " WARNING - Run 'npm install' first" -ForegroundColor Yellow
    $warnings++
}

# Check src structure
Write-Host "Checking src/ structure..." -NoNewline
$srcFolders = @("src/components", "src/pages", "src/db", "src/utils")
$allExist = $true
foreach ($folder in $srcFolders) {
    if (-not (Test-Path $folder)) {
        $allExist = $false
        break
    }
}
if ($allExist) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED - Missing folders" -ForegroundColor Red
    $errors++
}

# Check server structure
Write-Host "Checking server/ structure..." -NoNewline
if ((Test-Path "server/index.js") -and (Test-Path "server/.env.example")) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED - Missing server files" -ForegroundColor Red
    $errors++
}

# Check .env file
Write-Host "Checking server/.env..." -NoNewline
if (Test-Path "server/.env") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " WARNING - Create from .env.example" -ForegroundColor Yellow
    $warnings++
}

# Check database folder
Write-Host "Checking database/ folder..." -NoNewline
if (Test-Path "database/schema.sql") {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED - schema.sql not found" -ForegroundColor Red
    $errors++
}

# Check documentation
Write-Host "Checking documentation..." -NoNewline
$docs = @("README.md", "QUICKSTART.md", "PROJECT_SUMMARY.md", "DEPLOYMENT.md")
$allDocsExist = $true
foreach ($doc in $docs) {
    if (-not (Test-Path $doc)) {
        $allDocsExist = $false
        break
    }
}
if ($allDocsExist) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " WARNING - Some docs missing" -ForegroundColor Yellow
    $warnings++
}

# Check configuration files
Write-Host "Checking config files..." -NoNewline
$configs = @("vite.config.js", "tailwind.config.js", "postcss.config.js")
$allConfigsExist = $true
foreach ($config in $configs) {
    if (-not (Test-Path $config)) {
        $allConfigsExist = $false
        break
    }
}
if ($allConfigsExist) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED - Config files missing" -ForegroundColor Red
    $errors++
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host 'All checks passed!' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Next Steps:' -ForegroundColor Cyan
    Write-Host '1. Ensure MariaDB/MySQL is installed and running'
    Write-Host '2. Create database: CREATE DATABASE attendance_fines;'
    Write-Host '3. Import schema: mysql -u root -p attendance_fines < database/schema.sql'
    Write-Host '4. Configure server/.env with your database credentials'
    Write-Host '5. Run "npm run dev" (Terminal 1) and "npm run server" (Terminal 2)'
    Write-Host ''
    Write-Host 'Access:' -ForegroundColor Cyan
    Write-Host ' - Admin: http://localhost:5173/admin'
    Write-Host ' - Student: http://localhost:5173/student'
    Write-Host ' - API: http://localhost:3000/api'
} elseif ($errors -eq 0) {
    Write-Host "Core checks passed with $warnings warning(s)" -ForegroundColor Yellow
    Write-Host 'Review warnings above and proceed with caution.'
} else {
    Write-Host "Verification failed with $errors error(s) and $warnings warning(s)" -ForegroundColor Red
    Write-Host 'Please fix the errors above before proceeding.'
}

Write-Host ""
Write-Host "For detailed setup instructions, see QUICKSTART.md" -ForegroundColor Cyan
Write-Host ""
