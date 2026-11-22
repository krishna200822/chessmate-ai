"""Chess game manager using python-chess.

Manages board state, move validation, FEN/PGN export, check/checkmate/stalemate
detection, capture tracking, and game lifecycle (pause, resume, resign).
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import chess
import chess.pgn


class IllegalMoveError(ValueError):
    """Raised when a submitted move is illegal in the current position."""

    pass


class GameStateError(RuntimeError):
    """Raised when an action is performed on a game in an invalid state."""

    pass


class ChessGame:
    """Manages an active or completed chess game on a chess.Board instance."""

    def __init__(
        self,
        game_id: Optional[str] = None,
        fen: Optional[str] = None,
        human_color: str = "white",
        settings: Optional[Dict[str, Any]] = None,
    ):
        self.id = game_id or str(uuid.uuid4())
        self.board = chess.Board(fen) if fen else chess.Board()
        self.human_color = human_color.lower()
        self.status = "in_progress"  # in_progress, paused, checkmate, stalemate, draw, resigned
        self.result = "*"  # *, 1-0, 0-1, 1/2-1/2
        self.moves: List[Dict[str, Any]] = []
        self.captures: Dict[str, List[str]] = {"white": [], "black": []}
        self.settings: Dict[str, Any] = settings or {}
        now = datetime.now(timezone.utc).isoformat()
        self.created_at = now
        self.updated_at = now

        self._update_game_end_status()

    @property
    def fen(self) -> str:
        """Current FEN representation of the board."""
        return self.board.fen()

    @property
    def turn(self) -> str:
        """Whose turn it is ('white' or 'black')."""
        return "white" if self.board.turn == chess.WHITE else "black"

    @property
    def is_check(self) -> bool:
        """Whether the king is currently in check."""
        return self.board.is_check()

    @property
    def is_checkmate(self) -> bool:
        """Whether the current position is checkmate."""
        return self.board.is_checkmate()

    @property
    def is_stalemate(self) -> bool:
        """Whether the current position is stalemate."""
        return self.board.is_stalemate()

    @property
    def is_game_over(self) -> bool:
        """Whether the game has concluded."""
        return self.status in ["checkmate", "stalemate", "draw", "resigned"]

    def get_legal_moves_uci(self) -> List[str]:
        """List of all legal moves in UCI format ('e2e4')."""
        return [m.uci() for m in self.board.legal_moves]

    def get_legal_moves_san(self) -> List[str]:
        """List of all legal moves in SAN format ('e4', 'Nf3')."""
        return [self.board.san(m) for m in self.board.legal_moves]

    def parse_move(self, move_str: str) -> chess.Move:
        """Parse a move string in either UCI or SAN format.

        Raises:
            IllegalMoveError: If the move cannot be parsed or is illegal.
        """
        clean_str = move_str.strip()
        legal_uci = self.get_legal_moves_uci()
        legal_san = self.get_legal_moves_san()

        # Try parsing as UCI
        try:
            candidate = chess.Move.from_uci(clean_str)
            if candidate in self.board.legal_moves:
                return candidate
        except (ValueError, chess.InvalidMoveError):
            pass

        # Try parsing as SAN
        try:
            candidate = self.board.parse_san(clean_str)
            if candidate in self.board.legal_moves:
                return candidate
        except (ValueError, chess.InvalidMoveError):
            pass

        # If not matched, compile helpful error message
        preview_legal = legal_san[:8]
        if len(legal_san) > 8:
            preview_legal.append(f"... ({len(legal_san) - 8} more)")

        raise IllegalMoveError(
            f"Move '{clean_str}' is illegal or invalid in position (turn: {self.turn}). "
            f"FEN: {self.fen}. Legal moves include: {', '.join(preview_legal)}"
        )

    def make_move(
        self,
        move_input: str,
        explanation: Optional[str] = None,
        evaluation: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute a move on the board, updating history, captures, and status.

        Args:
            move_input: Move in UCI or SAN format.
            explanation: Optional reasoning/commentary (e.g. from engine).
            evaluation: Optional engine eval dict.

        Returns:
            Dictionary containing details of the executed move.
        """
        if self.status == "paused":
            raise GameStateError(
                "Game is currently paused. Resume the game before submitting moves."
            )
        if self.is_game_over:
            raise GameStateError(
                f"Game has ended with status '{self.status}' and result '{self.result}'. "
                "No further moves can be played."
            )

        move = self.parse_move(move_input)
        san = self.board.san(move)
        uci = move.uci()
        moving_color = self.turn

        # Track captured piece before pushing move
        captured_symbol = None
        if self.board.is_capture(move):
            if self.board.is_en_passant(move):
                captured_symbol = "p" if moving_color == "white" else "P"
            else:
                target_piece = self.board.piece_at(move.to_square)
                if target_piece:
                    captured_symbol = target_piece.symbol()

            if captured_symbol:
                self.captures[moving_color].append(captured_symbol)

        # Apply move
        self.board.push(move)
        now = datetime.now(timezone.utc).isoformat()
        self.updated_at = now

        # Check ending conditions
        self._update_game_end_status()

        move_record = {
            "uci": uci,
            "san": san,
            "from_square": chess.square_name(move.from_square),
            "to_square": chess.square_name(move.to_square),
            "color": moving_color,
            "captured_piece": captured_symbol,
            "is_check": self.is_check,
            "is_checkmate": self.is_checkmate,
            "fen_after": self.fen,
            "timestamp": now,
            "explanation": explanation,
            "evaluation": evaluation,
        }
        self.moves.append(move_record)

        return move_record

    def _update_game_end_status(self) -> None:
        """Evaluate whether game has reached a terminal condition."""
        if self.board.is_checkmate():
            self.status = "checkmate"
            # If it's now White's turn, Black gave checkmate -> 0-1
            self.result = "0-1" if self.board.turn == chess.WHITE else "1-0"
        elif self.board.is_stalemate():
            self.status = "stalemate"
            self.result = "1/2-1/2"
        elif self.board.is_insufficient_material():
            self.status = "draw"
            self.result = "1/2-1/2"
        elif self.board.is_seventyfive_moves() or self.board.is_fivefold_repetition():
            self.status = "draw"
            self.result = "1/2-1/2"

    def pause(self) -> None:
        """Pause the game."""
        if self.is_game_over:
            raise GameStateError("Cannot pause a completed game.")
        self.status = "paused"
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def resume(self) -> None:
        """Resume a paused game."""
        if self.status != "paused":
            raise GameStateError(
                f"Game is not paused (current status: {self.status})."
            )
        self.status = "in_progress"
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def resign(self, player: Optional[str] = None) -> None:
        """Resign the game for the specified player or the current human player."""
        if self.is_game_over:
            raise GameStateError("Cannot resign a completed game.")

        resigning = (player or self.human_color).lower()
        self.status = "resigned"
        self.result = "0-1" if resigning == "white" else "1-0"
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def export_pgn(self) -> str:
        """Export the complete game in standard Portable Game Notation (PGN)."""
        pgn_game = chess.pgn.Game()

        # Set headers
        pgn_game.headers["Event"] = "ChessMate AI Match"
        pgn_game.headers["Site"] = "ChessMate AI Platform"
        pgn_game.headers["Date"] = datetime.now(timezone.utc).strftime("%Y.%m.%d")
        pgn_game.headers["Round"] = "1"

        elo = self.settings.get("elo", 1500)
        if self.human_color == "white":
            pgn_game.headers["White"] = "Human Player"
            pgn_game.headers["Black"] = f"ChessMate AI (ELO {elo})"
        else:
            pgn_game.headers["White"] = f"ChessMate AI (ELO {elo})"
            pgn_game.headers["Black"] = "Human Player"

        pgn_game.headers["Result"] = self.result

        # Replay moves into PGN
        node = pgn_game
        temp_board = chess.Board()
        for m_data in self.moves:
            uci_str = m_data["uci"]
            m = chess.Move.from_uci(uci_str)
            node = node.add_variation(m)
            if m_data.get("explanation"):
                node.comment = m_data["explanation"]
            temp_board.push(m)

        exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
        return pgn_game.accept(exporter)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize full game state into a dictionary."""
        return {
            "id": self.id,
            "fen": self.fen,
            "status": self.status,
            "human_color": self.human_color,
            "turn": self.turn,
            "result": self.result,
            "is_check": self.is_check,
            "is_checkmate": self.is_checkmate,
            "is_stalemate": self.is_stalemate,
            "legal_moves": self.get_legal_moves_uci(),
            "legal_moves_san": self.get_legal_moves_san(),
            "moves": self.moves,
            "captures": self.captures,
            "pgn": self.export_pgn(),
            "settings": self.settings,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChessGame":
        """Reconstruct a ChessGame instance from dictionary state."""
        game = cls(
            game_id=data["id"],
            fen=data.get("fen"),
            human_color=data.get("human_color", "white"),
            settings=data.get("settings", {}),
        )
        game.status = data.get("status", "in_progress")
        game.result = data.get("result", "*")
        game.moves = data.get("moves", [])
        game.captures = data.get("captures", {"white": [], "black": []})
        game.created_at = data.get("created_at", game.created_at)
        game.updated_at = data.get("updated_at", game.updated_at)
        return game
