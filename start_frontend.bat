@echo off
title ProtoLink — Custom Network Protocol Lab Dev Server
echo ========================================================
echo   ProtoLink - Custom Network Protocol Lab
echo   Connect. Transmit. Acknowledge.
echo ========================================================
echo.
cd /d "%~dp0frontend"

if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
)

echo Starting Vite React Dev Server...
call npm run dev
pause
