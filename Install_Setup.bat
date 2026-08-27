@echo off
title Ali Sanitary Store - One-Time POS Installation
color 0A

echo ====================================================================
echo      ALI SANITARY STORE - POS ONE-TIME CLIENT INSTALLATION
echo ====================================================================
echo.
echo  Step [1/4] Checking Node.js Environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is not installed on this system!
    echo  Please download and install Node.js (LTS) from: https://nodejs.org
    echo.
    pause
    exit /b
)
echo  ✓ Node.js detected: 
node -v
echo.

echo  Step [2/4] Installing Backend Dependencies & Initializing Database...
cd /d "%~dp0backend"
call npm install
call npx prisma db push
echo  ✓ Backend & Database configured successfully!
echo.

echo  Step [3/4] Installing Frontend Dependencies & Building Production App...
cd /d "%~dp0frontend"
call npm install
call npm run build
echo  ✓ Frontend production build generated successfully!
echo.

echo  Step [4/4] Creating Desktop Launcher Shortcut...
cd /d "%~dp0"
set SCRIPT="%TEMP%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Ali Sanitary Store POS.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0Start_POS.bat" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Ali Sanitary Store POS" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript /nologo %SCRIPT%
del %SCRIPT%

echo.
echo ====================================================================
echo   ✓ INSTALLATION COMPLETE!
echo   A shortcut named 'Ali Sanitary Store POS' has been created on Desktop.
echo ====================================================================
echo.
pause
