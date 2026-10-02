@echo off
cd /d "%~dp0"
taskkill /f /im python.exe >nul 2>&1
"backend\venv\Scripts\python.exe" backend\server.py