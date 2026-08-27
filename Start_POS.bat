@echo off
title POS System - Starting...
color 0B
setlocal enabledelayedexpansion

echo ====================================================================
echo        POINT OF SALE SYSTEM - STARTING
echo ====================================================================
echo.

:: -----------------------------------------------------------------------
:: Check Node.js is available
:: -----------------------------------------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js is not found on this PC!
    echo  Please run Install_Setup.bat first.
    echo.
    pause
    exit /b 1
)

:: -----------------------------------------------------------------------
:: Free up port 3000 if something is already running on it
:: -----------------------------------------------------------------------
echo  Checking for existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo  Port 3000 is free.
echo.

:: -----------------------------------------------------------------------
:: Start Backend Server minimized in background
:: -----------------------------------------------------------------------
echo  Starting backend server...
start "POS Backend Server" /min cmd /c "cd /d ""%~dp0backend"" && npm run dev"

:: Wait for server to initialize
echo  Waiting for server to start...
timeout /t 4 /nobreak >nul

:: -----------------------------------------------------------------------
:: Open in browser (Chrome App Mode = feels like a native desktop app)
:: -----------------------------------------------------------------------
echo  Launching app window...
echo.

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --start-maximized
) else (
    echo  Chrome/Edge not found - opening in default browser...
    start http://localhost:3000
)

echo ====================================================================
echo   POS System is running at: http://localhost:3000
echo   This window keeps the server alive. DO NOT close it.
echo   To stop the server, close this window or run Stop_POS.bat
echo ====================================================================
echo.
