@echo off
title POS Jabbar - Setup
color 0B
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ====================================================================
echo                 POS  JABBAR   -   SETUP
echo ====================================================================
echo.

:: --------------------------------------------------------------------
:: 1) Ensure Node.js is installed (auto-install via winget if possible)
:: --------------------------------------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  Node.js is required but was not found on this PC.
    echo  Trying to install it automatically...
    echo.
    where winget >nul 2>nul
    if !errorlevel! equ 0 (
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        echo.
        echo  ================================================================
        echo   Node.js has been installed.
        echo   Please CLOSE this window and run Setup.bat again.
        echo  ================================================================
        pause
        exit /b 0
    ) else (
        echo  Automatic install is not available on this PC.
        echo  Please install Node.js "LTS" from the page that just opened,
        echo  then run Setup.bat again.
        start https://nodejs.org
        pause
        exit /b 1
    )
)
echo  [OK] Node.js is installed.
echo.

:: --------------------------------------------------------------------
:: 2) Create a Desktop shortcut for everyday launching
:: --------------------------------------------------------------------
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\POS Jabbar.lnk'); $s.TargetPath='%~dp0Start_POS_Production.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,13'; $s.Save()" >nul 2>nul
if exist "%USERPROFILE%\Desktop\POS Jabbar.lnk" echo  [OK] Desktop shortcut created: "POS Jabbar".
echo.

:: --------------------------------------------------------------------
:: 3) Licence: if already activated, just launch. Otherwise show the ID.
:: --------------------------------------------------------------------
if exist "%~dp0backend\license.key" goto :launch

echo ====================================================================
echo    ACTIVATION REQUIRED  (one-time, per computer)
echo ====================================================================
echo.
set "MACHINE_ID="
node -e "require('fs').writeFileSync(process.argv[1], require('./backend/dist/license/hardware').getHardwareId())" "%~dp0MachineID.txt" 2>nul
if exist "%~dp0MachineID.txt" set /p MACHINE_ID=<"%~dp0MachineID.txt"

echo   This computer's MACHINE ID:
echo.
echo       !MACHINE_ID!
echo.
echo   (also saved to the file  MachineID.txt  in this folder)
echo.
echo   To activate:
echo     1) Send the Machine ID above to your software supplier.
echo     2) They send you back a file named  license.key
echo     3) Copy  license.key  into the  "backend"  folder (next to Setup.bat).
echo     4) Run  Setup.bat  again - it will start the app.
echo.
start "" notepad "%~dp0MachineID.txt"
pause
exit /b 0

:launch
echo  [OK] Licence found - starting POS Jabbar...
echo.
start "" "%~dp0Start_POS_Production.bat"
echo  The app is starting. It will open in your browser at:
echo     http://localhost:3000
echo.
echo  You can close this window. Use the "POS Jabbar" desktop shortcut next time.
timeout /t 6 /nobreak >nul
exit /b 0
