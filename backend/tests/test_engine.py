"""Unit tests for chess engine wrappers and fallback logic."""

import chess
import pytest
from app.config import (
    DEFAULT_ELO,
    MIN_ELO,
    MAX_ELO,
    find_stockfish_binary,
    get_stockfish_install_instructions,
)
from app.engine import (
    FallbackChessEngine,
    StockfishEngine,
    get_chess_engine,
)


def test_fallback_engine_move_generation():
    """Verify fallback engine generates valid legal moves on standard and complex positions."""
    engine = FallbackChessEngine()
    board = chess.Board()

    result = engine.select_move(board, elo=1500, depth=5, style="balanced")
    assert result.move in board.legal_moves
    assert result.is_stockfish is False
    assert result.uci == result.move.uci()
    assert result.san is not None
    assert len(result.explanation) > 0
    assert result.warning is not None
    assert "NOTICE: Stockfish binary is not installed" in result.warning


def test_fallback_engine_styles():
    """Verify different styles run without error and generate style-tuned evaluations."""
    engine = FallbackChessEngine()
    board = chess.Board()

    for style in ["aggressive", "balanced", "defensive"]:
        res = engine.select_move(board, elo=1600, depth=5, style=style)
        assert res.move in board.legal_moves
        assert res.evaluation["style"] == style


def test_elo_clamping():
    """Verify ELO values are safely clamped between 800 and 2800."""
    engine = FallbackChessEngine()
    board = chess.Board()

    # Low ELO
    res_low = engine.select_move(board, elo=500)
    assert res_low.move in board.legal_moves

    # High ELO
    res_high = engine.select_move(board, elo=3500)
    assert res_high.move in board.legal_moves


def test_missing_stockfish_handling():
    """Verify that a missing Stockfish path raises informative error with install guide."""
    instructions = get_stockfish_install_instructions()
    assert "winget install Stockfish.Stockfish" in instructions
    assert "apt-get install -y stockfish" in instructions
    assert "brew install stockfish" in instructions

    # Attempting to point StockfishEngine to a non-existent binary raises FileNotFoundError
    with pytest.raises(FileNotFoundError) as exc_info:
        StockfishEngine("/path/to/nonexistent/stockfish_executable")

    err_msg = str(exc_info.value)
    assert "Stockfish binary not found" in err_msg
    assert "winget install" in err_msg


def test_get_chess_engine_factory():
    """Verify factory returns an engine without crashing even when Stockfish is absent."""
    engine, is_sf, warning = get_chess_engine()
    assert engine is not None
    assert isinstance(is_sf, bool)
    if not is_sf:
        assert isinstance(engine, FallbackChessEngine)
        assert warning is not None
        assert "winget install" in warning
