@echo off
title POS System - Starting...
color 0B
setlocal enabledelayedexpansion

:: ====================================================================
::  PRODUCTION launcher for CLIENT machines.
::  Runs the COMPILED + OBFUSCATED backend (backend\dist) with the
::  hardware-locked licence ENFORCED. It never runs raw source.
::  Build first on the supplier machine with:  cd backend ^& npm run build:prod
:: ====================================================================

set SILENT_MODE=0
if /i "%1"=="/silent" set SILENT_MODE=1
if /i "%1"=="--silent" set SILENT_MODE=1

:: Node present?
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js is not installed on this PC. Run the installer first.
    if %SILENT_MODE%==0 pause
    exit /b 1
)

:: Compiled build present?
if not exist "%~dp0backend\dist\index.js" (
    color 0C
    echo  [ERROR] Compiled app not found (backend\dist). This install is incomplete.
    if %SILENT_MODE%==0 pause
    exit /b 1
)

:: Free port 3000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Licensing + runtime environment
set NODE_ENV=production
set LICENSE_ENFORCEMENT=1
set PORT=3000
set LICENSE_FILE=%~dp0backend\license.key
set LICENSE_PUBLIC_KEY=%~dp0backend\dist\license\public_key.pem

:: Start the compiled server (keeps this window alive)
if %SILENT_MODE%==0 echo  Starting licensed POS server...
start "POS Server" /min cmd /c "cd /d ""%~dp0backend"" && node dist\index.js"

:: Give it a moment, then open the app (manual launch only)
timeout /t 4 /nobreak >nul
if %SILENT_MODE%==1 exit /b 0

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --start-maximized
) else (
    start http://localhost:3000
)

echo ====================================================================
echo   POS System running at: http://localhost:3000  (licensed mode)
echo ====================================================================
exit /b 0
