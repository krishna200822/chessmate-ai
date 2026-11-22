"""Unit tests for ChessGame manager logic."""

import pytest
from app.game import ChessGame, IllegalMoveError, GameStateError


def test_legal_moves_parsing():
    """Verify parsing and execution of legal moves in both UCI and SAN."""
    game = ChessGame()

    # Move 1: e2e4 (UCI)
    m1 = game.make_move("e2e4")
    assert m1["uci"] == "e2e4"
    assert m1["san"] == "e4"
    assert game.turn == "black"

    # Move 1: e7e5 (SAN)
    m2 = game.make_move("e5")
    assert m2["uci"] == "e7e5"
    assert m2["san"] == "e5"
    assert game.turn == "white"


def test_illegal_move_rejection():
    """Verify illegal moves are rejected with descriptive error message."""
    game = ChessGame()

    with pytest.raises(IllegalMoveError) as exc_info:
        game.make_move("e2e5")  # Pawn can't jump to e5 on move 1

    msg = str(exc_info.value)
    assert "Move 'e2e5' is illegal or invalid" in msg
    assert "Legal moves include:" in msg

    # Completely nonsense string
    with pytest.raises(IllegalMoveError):
        game.make_move("xyz999")


def test_captures_and_en_passant():
    """Verify capture tracking including en passant."""
    game = ChessGame()
    # 1. e4 Nf6 2. e5 d5 3. exd6 (en passant)
    game.make_move("e4")
    game.make_move("Nf6")
    game.make_move("e5")
    game.make_move("d5")

    # En passant
    ep_move = game.make_move("exd6")
    assert ep_move["captured_piece"] == "p"
    assert "p" in game.captures["white"]


def test_castling_kingside():
    """Verify castling move execution."""
    game = ChessGame()
    # Reach position for kingside castling: 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O
    moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]
    for m in moves:
        game.make_move(m)

    assert "O-O" in [m["san"] for m in game.moves]
    assert game.board.piece_at(6).symbol() == "K"  # g1 square


def test_pawn_promotion():
    """Verify pawn promotion handling."""
    # Set up board near promotion: White pawn on a7
    fen = "8/P7/8/8/8/8/8/4K2k w - - 0 1"
    game = ChessGame(fen=fen)

    m = game.make_move("a8=Q")
    assert "a8=Q" in m["san"]
    assert m["is_check"] is True
    assert game.board.piece_at(56).symbol() == "Q"  # a8


def test_checkmate_scholars_mate():
    """Verify checkmate detection, game status, result, and move rejection post-game."""
    game = ChessGame()
    scholars_moves = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]

    for m in scholars_moves:
        game.make_move(m)

    assert game.is_checkmate is True
    assert game.status == "checkmate"
    assert game.result == "1-0"

    # Further moves must be rejected
    with pytest.raises(GameStateError) as exc_info:
        game.make_move("a6")
    assert "Game has ended" in str(exc_info.value)


def test_stalemate_detection():
    """Verify stalemate detection and draw result."""
    # Classic stalemate position: Black king on a8, White queen on c7, White king on c6
    stalemate_fen = "k7/2Q5/2K5/8/8/8/8/8 b - - 0 1"
    game = ChessGame(fen=stalemate_fen)

    assert game.is_stalemate is True
    assert game.status == "stalemate"
    assert game.result == "1/2-1/2"


def test_pgn_export():
    """Verify standard PGN generation with metadata headers and moves."""
    game = ChessGame(human_color="white", settings={"elo": 1800})
    game.make_move("e4")
    game.make_move("e5")
    game.make_move("Nf3")

    pgn_str = game.export_pgn()
    assert '[Event "ChessMate AI Match"]' in pgn_str
    assert '[White "Human Player"]' in pgn_str
    assert '[Black "ChessMate AI (ELO 1800)"]' in pgn_str
    assert "1. e4 e5 2. Nf3" in pgn_str


def test_pause_and_resume():
    """Verify game pause and resume mechanics."""
    game = ChessGame()
    game.make_move("e4")

    game.pause()
    assert game.status == "paused"

    # Moving while paused must fail
    with pytest.raises(GameStateError) as exc_info:
        game.make_move("e5")
    assert "paused" in str(exc_info.value)

    # Resume and make move
    game.resume()
    assert game.status == "in_progress"
    m = game.make_move("e5")
    assert m["san"] == "e5"


def test_resignation():
    """Verify player resignation updates game status and result."""
    game = ChessGame(human_color="white")
    game.make_move("e4")

    game.resign(player="white")
    assert game.status == "resigned"
    assert game.result == "0-1"
