@echo off
setlocal enabledelayedexpansion

echo =====================================================================
echo                 CHESSMATE AI - 6-DOF ROBOTIC CHESS
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Python environment...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.11+ is required but not found in PATH.
    echo Please install Python 3.11+ from https://python.org
    pause
    exit /b 1
)

echo [2/3] Installing / verifying backend dependencies...
cd backend
python -m pip install -q -r requirements.txt
if errorlevel 1 (
    echo [WARNING] Pip install returned warnings, attempting to continue...
)

echo.
echo [3/3] Starting ChessMate AI Unified Server on http://127.0.0.1:8000 ...
echo.
echo =====================================================================
echo  Open your web browser and navigate to:
echo      http://127.0.0.1:8000/app/
echo =====================================================================
echo.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
