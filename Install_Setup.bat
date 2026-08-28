@echo off
title POS Installation Setup
color 0A
setlocal enabledelayedexpansion

echo ====================================================================
echo        POS SYSTEM - ONE-TIME INSTALLATION SETUP
echo ====================================================================
echo.

:: -----------------------------------------------------------------------
:: STEP 1: Check Node.js
:: -----------------------------------------------------------------------
echo  [1/6] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Node.js is NOT installed on this system!
    echo.
    echo  Please install Node.js ^(LTS version^) from:
    echo  https://nodejs.org
    echo.
    echo  After installing Node.js, run this setup again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  OK  Node.js found: %NODE_VER%
echo.

:: -----------------------------------------------------------------------
:: STEP 2: Backend dependencies + Database
:: -----------------------------------------------------------------------
echo  [2/6] Installing backend packages (this may take a few minutes)...
cd /d "%~dp0backend"

call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Backend npm install failed!
    echo  Make sure you have internet access and try again.
    echo.
    pause
    exit /b 1
)
echo  OK  Backend packages installed.
echo.

echo  [3/6] Setting up database...
call npx prisma db push --skip-generate
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Database setup failed!
    echo  Check that the backend\.env file exists with a valid DATABASE_URL.
    echo.
    pause
    exit /b 1
)
echo  OK  Database initialized.
echo.

echo  Seeding default admin credentials...
call npx prisma db seed
if %errorlevel% neq 0 (
    echo  (Seed skipped - admin may already exist, continuing...)
)
echo.

:: -----------------------------------------------------------------------
:: STEP 4: Frontend build
:: -----------------------------------------------------------------------
echo  [4/6] Building the app (frontend production build)...
cd /d "%~dp0frontend"

call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Frontend npm install failed!
    echo.
    pause
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Frontend build failed!
    echo  Check for any code or configuration errors above.
    echo.
    pause
    exit /b 1
)
echo  OK  App built successfully.
echo.

:: -----------------------------------------------------------------------
:: STEP 5: Desktop Shortcut
:: -----------------------------------------------------------------------
echo  [5/6] Creating desktop shortcut...
cd /d "%~dp0"

set VBS_SCRIPT="%TEMP%\CreatePOSShortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > %VBS_SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\POS System.lnk" >> %VBS_SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %VBS_SCRIPT%
echo oLink.TargetPath = "%~dp0Start_POS.bat" >> %VBS_SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %VBS_SCRIPT%
echo oLink.Description = "Start POS System" >> %VBS_SCRIPT%
echo oLink.Save >> %VBS_SCRIPT%

cscript /nologo %VBS_SCRIPT%
del %VBS_SCRIPT% >nul 2>nul

echo  OK  Desktop shortcut created: "POS System"
echo.

:: -----------------------------------------------------------------------
:: STEP 6: Register Windows Task Scheduler for Auto-Start on Boot
:: -----------------------------------------------------------------------
echo  [6/6] Registering auto-start task (runs silently on every login)...

:: Store VBS path in a variable to safely handle spaces in directory names
set "VBS_PATH=%~dp0Start_POS_Silent.vbs"

:: Remove old task if it exists (ignore error if not found)
schtasks /delete /tn "POS System Startup" /f >nul 2>&1

:: Register new task: runs Start_POS_Silent.vbs at user logon, in background
schtasks /create /tn "POS System Startup" /tr "wscript.exe ""%VBS_PATH%""" /sc onlogon /rl highest /f >nul 2>&1

if %errorlevel% neq 0 (
    echo  WARN Auto-start task registration may have failed ^(needs Admin rights^).
    echo       Right-click Install_Setup.bat and choose 'Run as administrator'.
) else (
    echo  OK  Auto-start registered. POS server starts automatically on every login.
)
echo.

:: -----------------------------------------------------------------------
:: Done
:: -----------------------------------------------------------------------
color 0A
echo ====================================================================
echo   INSTALLATION COMPLETE!
echo.
echo   A shortcut "POS System" has been added to your Desktop.
echo   Double-click it to start the software anytime.
echo.
echo   AUTO-START: The server is now registered to start automatically
echo   on every Windows login — no manual steps needed after reboot!
echo.
echo   Default Login Credentials:
echo   - Super Admin:  superadmin / superadmin123!
echo   - Store Admin:  admin / admin123
echo ====================================================================
echo.
pause