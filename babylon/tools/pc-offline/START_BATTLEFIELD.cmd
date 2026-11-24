@echo off
cd /d "%~dp0"
if not exist "runtime\node.exe" (echo Missing runtime. Extract the entire ZIP first.& pause & exit /b 1)
start "Battlefield local server" "%~dp0runtime\node.exe" "%~dp0server.cjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8877/babylon/index.html"
