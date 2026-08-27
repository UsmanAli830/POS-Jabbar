@echo off
title Ali Sanitary Store - Enterprise POS Launcher
color 0B

echo ====================================================================
echo        ALI SANITARY STORE - POINT OF SALE (ERP SYSTEM)
echo ====================================================================
echo.
echo  [1/2] Initializing Local POS Database and Server...

:: Kill any existing hanging node processes on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Start Backend Server minimized
start "Ali Sanitary POS Server" /min cmd /c "cd /d ""%~dp0backend"" && npm run dev"

echo  [2/2] Launching Application Window...
echo.

:: Wait 3 seconds for server boot
timeout /t 3 /nobreak >nul

:: Launch in Google Chrome App Mode (looks like a native desktop app)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --start-maximized
) else (
    start http://localhost:3000
)

echo POS is active. You may minimize this window or keep it running.
timeout /t 2 /nobreak >nul
exit
