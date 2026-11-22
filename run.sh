#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "====================================================================="
echo "                CHESSMATE AI - 6-DOF ROBOTIC CHESS"
echo "====================================================================="
echo ""

echo "[1/3] Checking Python environment..."
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 could not be found. Please install Python 3.11+."
    exit 1
fi

echo "[2/3] Installing / verifying backend dependencies..."
cd backend
python3 -m pip install -q -r requirements.txt

echo ""
echo "[3/3] Starting ChessMate AI Unified Server on http://127.0.0.1:8000 ..."
echo ""
echo "====================================================================="
echo " Open your web browser and navigate to:"
echo "     http://127.0.0.1:8000/app/"
echo "====================================================================="
echo ""

python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
