@echo off
title Make Client Licence
color 0E
setlocal enabledelayedexpansion
cd /d "%~dp0backend"

echo ====================================================================
echo             MAKE A CLIENT LICENCE  (license.key)
echo ====================================================================
echo.
echo  Run this on YOUR computer after the assistant sends you the
echo  client's Machine ID. It creates the license.key to send back.
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js was not found on this PC.
    pause
    exit /b 1
)
if not exist "license\private_key.pem" (
    echo  [ERROR] Signing key not found ^(backend\license\private_key.pem^).
    echo  Restore your offline private key into that folder first.
    pause
    exit /b 1
)

:askshop
set "SHOP="
set /p SHOP="Shop / Company name    : "
if "!SHOP!"=="" ( echo  Please type a name. & goto askshop )

:askid
set "MID="
set /p MID="Paste the Machine ID   : "
if "!MID!"=="" ( echo  Please paste the Machine ID. & goto askid )

set "DAYS="
set /p DAYS="Validity in days [365] : "
if "!DAYS!"=="" set "DAYS=365"

:: Build a safe per-client folder so keys never overwrite each other
set "SAFE=!SHOP!"
set "SAFE=!SAFE: =_!"
set "SAFE=!SAFE:\=_!"
set "SAFE=!SAFE:/=_!"
set "SAFE=!SAFE::=_!"
set "OUTDIR=%~dp0issued-licenses\!SAFE!"
if not exist "!OUTDIR!" mkdir "!OUTDIR!"
set "OUTFILE=!OUTDIR!\license.key"

echo.
echo  Creating licence for "!SHOP!" (!DAYS! days)...
echo.
call npx ts-node scripts\license-issue.ts --company "!SHOP!" --hwid !MID! --days !DAYS! --out "!OUTFILE!"
if errorlevel 1 (
    echo.
    echo  [FAILED] Could not create the licence. Check the Machine ID and try again.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo  DONE. Send THIS file to your assistant:
echo.
echo     !OUTFILE!
echo.
echo  He places it in the client's  backend  folder (keep the name
echo  license.key) and runs Setup.bat again.
echo ====================================================================
start "" explorer /select,"!OUTFILE!"
echo.
pause
exit /b 0
