@echo off
title Stop POS Server
echo Shutting down POS background server...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
    set FOUND=1
)

if %FOUND%==1 (
    echo  OK  POS Server stopped successfully.
) else (
    echo  INFO POS Server was not running on port 3000.
)

timeout /t 2 /nobreak >nul
exit
