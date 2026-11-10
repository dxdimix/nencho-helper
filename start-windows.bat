@echo off
rem Double-click this file to start the app on this PC.
rem The whole body is in one block so that cmd is not confused when update-windows.ps1 replaces this file.
(
  cd /d "%~dp0"
  set "PATH=%PATH%;%ProgramFiles%\nodejs;%USERPROFILE%\.local\bin;%APPDATA%\npm"
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-windows.ps1"
  where node >NUL 2>&1 || (echo Node.js is not installed. Run the setup command again. & pause & exit /b 1)
  if not exist node_modules call npm install
  call npm run local
  pause
  exit /b
)
