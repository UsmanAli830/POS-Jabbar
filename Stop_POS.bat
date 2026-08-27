@echo off
title Stop POS Server
echo Shutting down POS background server...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo POS Server has been stopped successfully.
timeout /t 2 /nobreak >nul
exit
