@echo off
title Business Suite
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed on this computer.
  echo   Download the LTS version from https://nodejs.org , install it, then run this file again.
  echo.
  pause
  exit /b 1
)
node server.js
pause
