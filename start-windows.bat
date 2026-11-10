@echo off
rem Double-click this file to start the app on this PC.
cd /d "%~dp0"
where node >NUL 2>&1 || (echo Node.js is not installed. See README. & pause & exit /b 1)
where claude >NUL 2>&1 || (echo Claude Code [claude command] is not installed. See README. & pause & exit /b 1)
if not exist node_modules (call npm install || (pause & exit /b 1))
call npm run local
pause
