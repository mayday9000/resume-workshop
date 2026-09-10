@echo off
title Resume Workshop
cd /d "%~dp0.."

REM If the server is already up, just bring the browser to it.
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:4000/health' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  start "" "http://localhost:4000"
  exit /b 0
)

echo Resume Workshop is starting on http://localhost:4000
echo Your browser will open automatically.
echo Close this window when you are done to stop the server.
echo.
node app\server.mjs
if errorlevel 1 (
  echo.
  echo The server stopped with an error - details above.
  pause
)