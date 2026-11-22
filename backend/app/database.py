"""Database access layer for ChessMate AI using SQLite.

Manages persistent storage for games, moves, captured pieces, and settings.
"""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.config import (
    DB_PATH,
    DEFAULT_ELO,
    DEFAULT_DEPTH,
    DEFAULT_THINK_TIME,
    DEFAULT_STYLE,
    DEFAULT_HUMAN_COLOR,
)


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Create and return a configured SQLite connection."""
    target_path = db_path or DB_PATH
    conn = sqlite3.connect(target_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Initialize SQLite database tables and default settings."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Games table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            fen TEXT NOT NULL,
            status TEXT NOT NULL,
            human_color TEXT NOT NULL,
            result TEXT NOT NULL,
            is_check INTEGER NOT NULL DEFAULT 0,
            is_checkmate INTEGER NOT NULL DEFAULT 0,
            is_stalemate INTEGER NOT NULL DEFAULT 0,
            moves_json TEXT NOT NULL DEFAULT '[]',
            captures_json TEXT NOT NULL DEFAULT '{"white":[], "black":[]}',
            pgn TEXT NOT NULL DEFAULT '',
            settings_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    # Settings table (single-row configuration)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            elo INTEGER NOT NULL DEFAULT 1500,
            depth INTEGER NOT NULL DEFAULT 10,
            think_time REAL NOT NULL DEFAULT 1.0,
            style TEXT NOT NULL DEFAULT 'balanced',
            human_color TEXT NOT NULL DEFAULT 'white',
            stockfish_path TEXT,
            updated_at TEXT NOT NULL
        )
        """
    )

    # Insert default settings if not exists
    cursor.execute("SELECT id FROM settings WHERE id = 1")
    if cursor.fetchone() is None:
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT INTO settings (id, elo, depth, think_time, style, human_color, stockfish_path, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, NULL, ?)
            """,
            (
                DEFAULT_ELO,
                DEFAULT_DEPTH,
                DEFAULT_THINK_TIME,
                DEFAULT_STYLE,
                DEFAULT_HUMAN_COLOR,
                now,
            ),
        )

    conn.commit()
    conn.close()


def save_game(game_data: Dict[str, Any], db_path: Optional[str] = None) -> None:
    """Save or update a game in the database."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    moves_str = (
        json.dumps(game_data.get("moves", []))
        if isinstance(game_data.get("moves"), (list, dict))
        else game_data.get("moves", "[]")
    )
    captures_str = (
        json.dumps(game_data.get("captures", {"white": [], "black": []}))
        if isinstance(game_data.get("captures"), dict)
        else game_data.get("captures", '{"white":[], "black":[]}')
    )
    settings_str = (
        json.dumps(game_data.get("settings", {}))
        if isinstance(game_data.get("settings"), dict)
        else game_data.get("settings", "{}")
    )

    created_at = game_data.get("created_at", now)

    cursor.execute(
        """
        INSERT INTO games (
            id, fen, status, human_color, result, is_check, is_checkmate, is_stalemate,
            moves_json, captures_json, pgn, settings_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            fen = excluded.fen,
            status = excluded.status,
            human_color = excluded.human_color,
            result = excluded.result,
            is_check = excluded.is_check,
            is_checkmate = excluded.is_checkmate,
            is_stalemate = excluded.is_stalemate,
            moves_json = excluded.moves_json,
            captures_json = excluded.captures_json,
            pgn = excluded.pgn,
            settings_json = excluded.settings_json,
            updated_at = excluded.updated_at
        """,
        (
            game_data["id"],
            game_data["fen"],
            game_data["status"],
            game_data["human_color"],
            game_data.get("result", "*"),
            1 if game_data.get("is_check") else 0,
            1 if game_data.get("is_checkmate") else 0,
            1 if game_data.get("is_stalemate") else 0,
            moves_str,
            captures_str,
            game_data.get("pgn", ""),
            settings_str,
            created_at,
            now,
        ),
    )

    conn.commit()
    conn.close()


def get_game(game_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieve a game by ID from the database."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM games WHERE id = ?", (game_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "fen": row["fen"],
        "status": row["status"],
        "human_color": row["human_color"],
        "result": row["result"],
        "is_check": bool(row["is_check"]),
        "is_checkmate": bool(row["is_checkmate"]),
        "is_stalemate": bool(row["is_stalemate"]),
        "moves": json.loads(row["moves_json"]),
        "captures": json.loads(row["captures_json"]),
        "pgn": row["pgn"],
        "settings": json.loads(row["settings_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_games(
    limit: int = 50, offset: int = 0, db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List games ordered by most recently updated."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, fen, status, human_color, result, is_check, is_checkmate, is_stalemate,
               created_at, updated_at, settings_json
        FROM games
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    )
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append(
            {
                "id": r["id"],
                "fen": r["fen"],
                "status": r["status"],
                "human_color": r["human_color"],
                "result": r["result"],
                "is_check": bool(r["is_check"]),
                "is_checkmate": bool(r["is_checkmate"]),
                "is_stalemate": bool(r["is_stalemate"]),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "settings": json.loads(r["settings_json"]),
            }
        )
    return result


def get_settings(db_path: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve current settings."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings WHERE id = 1")
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "elo": DEFAULT_ELO,
            "depth": DEFAULT_DEPTH,
            "think_time": DEFAULT_THINK_TIME,
            "style": DEFAULT_STYLE,
            "human_color": DEFAULT_HUMAN_COLOR,
            "stockfish_path": None,
        }

    return {
        "elo": row["elo"],
        "depth": row["depth"],
        "think_time": row["think_time"],
        "style": row["style"],
        "human_color": row["human_color"],
        "stockfish_path": row["stockfish_path"],
        "updated_at": row["updated_at"],
    }


def update_settings(
    settings_data: Dict[str, Any], db_path: Optional[str] = None
) -> Dict[str, Any]:
    """Update settings and return updated values."""
    current = get_settings(db_path)
    elo = settings_data.get("elo", current["elo"])
    depth = settings_data.get("depth", current["depth"])
    think_time = settings_data.get("think_time", current["think_time"])
    style = settings_data.get("style", current["style"])
    human_color = settings_data.get("human_color", current["human_color"])
    stockfish_path = settings_data.get("stockfish_path", current.get("stockfish_path"))

    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE settings
        SET elo = ?, depth = ?, think_time = ?, style = ?, human_color = ?, stockfish_path = ?, updated_at = ?
        WHERE id = 1
        """,
        (elo, depth, think_time, style, human_color, stockfish_path, now),
    )
    conn.commit()
    conn.close()

    return {
        "elo": elo,
        "depth": depth,
        "think_time": think_time,
        "style": style,
        "human_color": human_color,
        "stockfish_path": stockfish_path,
        "updated_at": now,
    }
