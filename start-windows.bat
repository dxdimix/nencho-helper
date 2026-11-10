@echo off
rem Double-click this file to start the app on this PC.
cd /d "%~dp0"
set "PATH=%PATH%;%ProgramFiles%\nodejs;%USERPROFILE%\.local\bin;%APPDATA%\npm"
where node >NUL 2>&1 || (echo Node.js is not installed. Run the setup command again. & pause & exit /b 1)
if not exist node_modules (call npm install || (pause & exit /b 1))
call npm run local
pause
