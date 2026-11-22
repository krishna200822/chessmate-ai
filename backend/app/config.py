"""Application configuration for ChessMate AI.

Centralizes all settings, database paths, Stockfish executable paths,
and default game parameters.
"""

import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True, parents=True)

# Database configuration
DB_PATH = os.getenv("CHESSMATE_DB_PATH", str(DATA_DIR / "chessmate.db"))

# Stockfish path detection
DEFAULT_STOCKFISH_NAMES = [
    "stockfish",
    "stockfish.exe",
    "stockfish-windows-x86-64-avx2.exe",
    "stockfish_16_x64_avx2.exe",
    "stockfish_15_x64_avx2.exe",
]


def find_stockfish_binary(configured_path: Optional[str] = None) -> Optional[str]:
    """Locate the Stockfish binary on the system or return None.

    Checks:
    1. Specifically passed configured_path
    2. Environment variable STOCKFISH_PATH
    3. System PATH for known Stockfish binary names
    4. Local backend/bin directory
    """
    candidates = []
    if configured_path:
        candidates.append(configured_path)
    env_path = os.getenv("STOCKFISH_PATH")
    if env_path:
        candidates.append(env_path)

    # Local bin folder inside backend
    bin_dir = BASE_DIR / "bin"
    if bin_dir.exists():
        for name in DEFAULT_STOCKFISH_NAMES:
            candidates.append(str(bin_dir / name))

    for cand in candidates:
        if cand and os.path.isfile(cand) and os.access(cand, os.X_OK | os.R_OK):
            return str(Path(cand).resolve())

    # Check system PATH
    for name in DEFAULT_STOCKFISH_NAMES:
        found = shutil.which(name)
        if found:
            return str(Path(found).resolve())

    return None


def get_stockfish_install_instructions() -> str:
    """Return formatted, multi-platform Stockfish installation instructions."""
    return (
        "Stockfish binary was not found on your system.\n"
        "To enable full grandmaster AI analysis:\n"
        "- Windows:\n"
        "    1. Open PowerShell and run: winget install Stockfish.Stockfish\n"
        "    2. OR download from https://stockfishchess.org/download/\n"
        "       Extract stockfish.exe and place it in backend/bin/ or add it to PATH\n"
        "- Linux (Ubuntu/Debian):\n"
        "    sudo apt-get update && sudo apt-get install -y stockfish\n"
        "- macOS:\n"
        "    brew install stockfish\n"
        "- Alternatively, set the environment variable STOCKFISH_PATH=/path/to/stockfish"
    )


# Game Defaults
DEFAULT_ELO: int = 1500
MIN_ELO: int = 800
MAX_ELO: int = 2800

DEFAULT_DEPTH: int = 10
MIN_DEPTH: int = 1
MAX_DEPTH: int = 30

DEFAULT_THINK_TIME: float = 1.0  # seconds
MIN_THINK_TIME: float = 0.1
MAX_THINK_TIME: float = 10.0

VALID_STYLES = ["aggressive", "balanced", "defensive"]
DEFAULT_STYLE: str = "balanced"

VALID_COLORS = ["white", "black"]
DEFAULT_HUMAN_COLOR: str = "white"

# EEZYbotARM MK2 Kinematic Parameters (in mm)
ARM_MODEL_NAME = "EEZYbotARM_MK2"
ARM_BASE_HEIGHT = 75.0      # Base rotation center to shoulder pivot (mm)
ARM_LINK_1 = 135.0          # Main lower arm length (mm)
ARM_LINK_2 = 147.0          # Upper horizontal arm length (mm)
ARM_CLAW_LENGTH = 60.0      # End-effector claw reach to grip center (mm)
CHESSBOARD_SQUARE_SIZE = 30.0  # Chessboard square size in mm
ARM_BASE_X = 0.0            # Arm base positioned along center file
ARM_BASE_Y = 0.0

# Robot Arm and Board Physical Configuration (Dimensions in millimeters)
SQUARE_SIZE: float = 30.0   # 30 mm per square
BOARD_CENTER_X: float = 0.0
BOARD_CENTER_Y: float = 270.0
BOARD_Z: float = 0.0

PIECE_GRIP_Z: float = 18.0  # Gripper height when gripping a piece
HOVER_Z: float = 75.0       # Safe transit height clearing pieces on board
TRAY_Z: float = 15.0        # Height for dropping captured pieces into side tray

SIDE_TRAY_WHITE: tuple = (-170.0, 250.0, TRAY_Z)
SIDE_TRAY_BLACK: tuple = (170.0, 250.0, TRAY_Z)

# 6-DOF Arm Link Lengths (mm)
ARM_D1: float = 80.0        # Base turntable to shoulder pivot
ARM_A2: float = 220.0       # Shoulder to elbow pivot
ARM_A3: float = 220.0       # Elbow to wrist pivot
ARM_D6: float = 65.0        # Wrist pivot to gripper fingertips

# Default Home Cartesian Coordinate
ARM_HOME_POS: tuple = (0.0, 160.0, 180.0)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]
