"""Stockfish UCI engine wrapper and fallback chess engine.

Supports configurable ELO (800-2800), depth, think time, and playing styles
(aggressive, balanced, defensive) using multi-PV candidate evaluation.
Includes a robust built-in fallback engine if the Stockfish binary is missing.
"""

import logging
import random
import shutil
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import chess
import chess.engine

from app.config import (
    DEFAULT_ELO,
    DEFAULT_DEPTH,
    DEFAULT_THINK_TIME,
    DEFAULT_STYLE,
    MIN_ELO,
    MAX_ELO,
    find_stockfish_binary,
    get_stockfish_install_instructions,
)

logger = logging.getLogger("chessmate.engine")

# Basic piece values for heuristic evaluation
PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000,
}


@dataclass
class EngineMoveResult:
    """Result of an engine move calculation."""

    move: chess.Move
    uci: str
    san: str
    explanation: str
    is_stockfish: bool
    evaluation: Dict[str, Any]
    warning: Optional[str] = None


class FallbackChessEngine:
    """Heuristic chess engine used when Stockfish binary is missing.

    Provides legal move generation, basic tactical/positional evaluation,
    and style weighting so the system never crashes when Stockfish is absent.
    """

    def __init__(self):
        self.install_instructions = get_stockfish_install_instructions()

    def evaluate_board(self, board: chess.Board, for_color: chess.Color) -> int:
        """Simple material and center-control evaluation in centipawns relative to for_color."""
        if board.is_checkmate():
            # If it's for_color's turn, for_color is checkmated (-100000). Otherwise, opponent is checkmated (+100000).
            return -100000 if board.turn == for_color else 100000
        if (
            board.is_stalemate()
            or board.is_insufficient_material()
            or board.can_claim_draw()
        ):
            return 0

        score = 0
        for sq, piece in board.piece_map().items():
            val = PIECE_VALUES.get(piece.piece_type, 0)
            # Center bonus
            file_dist = abs(chess.square_file(sq) - 3.5)
            rank_dist = abs(chess.square_rank(sq) - 3.5)
            center_bonus = int((4 - (file_dist + rank_dist)) * 10)

            total_val = val + center_bonus
            if piece.color == chess.WHITE:
                score += total_val
            else:
                score -= total_val

        return score if for_color == chess.WHITE else -score

    def select_move(
        self,
        board: chess.Board,
        elo: int = DEFAULT_ELO,
        depth: int = DEFAULT_DEPTH,
        think_time: float = DEFAULT_THINK_TIME,
        style: str = DEFAULT_STYLE,
    ) -> EngineMoveResult:
        """Choose a legal move based on heuristic score, ELO-adjusted randomness, and style."""
        legal_moves = list(board.legal_moves)
        if not legal_moves:
            raise ValueError("No legal moves available in current board state")

        moving_color = board.turn
        scored_moves: List[Tuple[chess.Move, int, str]] = []

        for move in legal_moves:
            board.push(move)
            # Base positional score from moving_color's perspective
            eval_score = self.evaluate_board(board, for_color=moving_color)
            board.pop()

            style_bonus = 0
            explanation_parts = []

            # Check detection
            board.push(move)
            gives_check = board.is_check()
            is_mate = board.is_checkmate()
            board.pop()

            if is_mate:
                eval_score += 10000
                explanation_parts.append("delivers checkmate")
            elif gives_check:
                if style == "aggressive":
                    style_bonus += 120
                else:
                    style_bonus += 30
                explanation_parts.append("checks enemy king")

            # Capture detection
            if board.is_capture(move):
                captured_piece = board.piece_at(move.to_square)
                cap_val = (
                    PIECE_VALUES.get(
                        captured_piece.piece_type if captured_piece else chess.PAWN, 100
                    )
                    if captured_piece
                    else 100
                )
                if style == "aggressive":
                    style_bonus += cap_val // 2
                    explanation_parts.append("attacks and captures enemy material")
                elif style == "defensive":
                    style_bonus += cap_val // 4
                    explanation_parts.append("liquidates material cleanly")
                else:
                    style_bonus += cap_val // 3
                    explanation_parts.append("captures material")

            # Castling
            if board.is_castling(move):
                if style == "defensive":
                    style_bonus += 150
                    explanation_parts.append(
                        "safeguards king and connects rooks by castling"
                    )
                else:
                    style_bonus += 80
                    explanation_parts.append("castles for king safety")

            # Center development
            if move.to_square in [
                chess.E4,
                chess.D4,
                chess.E5,
                chess.D5,
                chess.C4,
                chess.F4,
                chess.C5,
                chess.F5,
            ]:
                if style == "aggressive":
                    style_bonus += 40
                    explanation_parts.append("stakes claim in the center")
                else:
                    style_bonus += 20
                    explanation_parts.append("develops towards the center")

            total_score = eval_score + style_bonus
            exp_text = (
                ", ".join(explanation_parts)
                if explanation_parts
                else "develops piece into an active position"
            )
            scored_moves.append((move, total_score, exp_text))

        # Sort moves by score descending
        scored_moves.sort(key=lambda x: x[1], reverse=True)

        # ELO simulation: lower ELO increases randomness
        # Clamped ELO 800 - 2800
        elo_clamped = max(MIN_ELO, min(MAX_ELO, elo))
        blunder_prob = max(0.0, (2200 - elo_clamped) / 2000.0)

        if random.random() < blunder_prob and len(scored_moves) > 1:
            # Pick from top-N suboptimal moves
            pool_size = min(len(scored_moves), max(2, int(blunder_prob * 6)))
            chosen_move, chosen_score, base_exp = random.choice(
                scored_moves[:pool_size]
            )
        else:
            chosen_move, chosen_score, base_exp = scored_moves[0]

        san = board.san(chosen_move)
        explanation = (
            f"Plays {san} ({style} style): {base_exp}. [Built-in Fallback Engine]"
        )

        warning = (
            "NOTICE: Stockfish binary is not installed on this system. "
            "ChessMate AI is running its built-in fallback engine. "
            "To enable the full Stockfish engine, install Stockfish."
        )

        return EngineMoveResult(
            move=chosen_move,
            uci=chosen_move.uci(),
            san=san,
            explanation=explanation,
            is_stockfish=False,
            evaluation={"score_cp": chosen_score, "depth": depth, "style": style},
            warning=warning,
        )


class StockfishEngine:
    """Wrapper for Stockfish UCI chess engine via python-chess.

    Features:
    - UCI_LimitStrength + UCI_Elo (800 - 2800)
    - Depth & think time limits
    - Style configuration (aggressive, balanced, defensive) using Multi-PV lines
    """

    def __init__(self, binary_path: str):
        self.binary_path = binary_path
        self._verify_binary()

    def _verify_binary(self) -> None:
        """Verify that the Stockfish binary exists and is executable."""
        if not shutil.which(self.binary_path) and not (
            find_stockfish_binary(self.binary_path)
        ):
            raise FileNotFoundError(
                f"Stockfish binary not found at '{self.binary_path}'.\n"
                f"{get_stockfish_install_instructions()}"
            )

    def _apply_engine_options(self, engine: chess.engine.SimpleEngine, elo: int) -> None:
        """Configure Stockfish UCI options for target ELO and skill level."""
        clamped_elo = max(MIN_ELO, min(MAX_ELO, elo))
        # Skill level mapped from 0 to 20
        skill_level = int(((clamped_elo - MIN_ELO) / (MAX_ELO - MIN_ELO)) * 20)

        options: Dict[str, Any] = {}
        supported = engine.options

        if "UCI_LimitStrength" in supported:
            options["UCI_LimitStrength"] = True
        if "UCI_Elo" in supported:
            options["UCI_Elo"] = clamped_elo
        if "Skill Level" in supported:
            options["Skill Level"] = skill_level

        if options:
            engine.configure(options)
            logger.info(f"Configured Stockfish with options: {options}")

    def select_move(
        self,
        board: chess.Board,
        elo: int = DEFAULT_ELO,
        depth: int = DEFAULT_DEPTH,
        think_time: float = DEFAULT_THINK_TIME,
        style: str = DEFAULT_STYLE,
    ) -> EngineMoveResult:
        """Calculate and select the best move matching ELO, depth, time, and style."""
        if not board.legal_moves:
            raise ValueError("No legal moves available in current board state")

        resolved_path = find_stockfish_binary(self.binary_path) or self.binary_path
        with chess.engine.SimpleEngine.popen_uci(resolved_path) as engine:
            self._apply_engine_options(engine, elo)

            # Limit specification
            limit = chess.engine.Limit(time=think_time, depth=depth)

            num_legal = len(list(board.legal_moves))
            multipv = min(3, num_legal) if style in ["aggressive", "defensive"] else 1

            analysis = engine.analyse(board, limit, multipv=multipv)

            if isinstance(analysis, dict):
                lines = [analysis]
            else:
                lines = analysis

            if not lines or "pv" not in lines[0] or not lines[0]["pv"]:
                # Fallback to engine.play
                result = engine.play(board, limit)
                chosen_move = result.move
                if not chosen_move:
                    chosen_move = random.choice(list(board.legal_moves))
                san = board.san(chosen_move)
                return EngineMoveResult(
                    move=chosen_move,
                    uci=chosen_move.uci(),
                    san=san,
                    explanation=f"Stockfish selects {san} (ELO {elo}).",
                    is_stockfish=True,
                    evaluation={"depth": depth, "elo": elo},
                    warning=None,
                )

            # Candidate selection based on style
            chosen_line = lines[0]
            chosen_move = chosen_line["pv"][0]

            if style in ["aggressive", "defensive"] and len(lines) > 1:
                best_score = (
                    lines[0]["score"].white().score(mate_score=10000)
                    if board.turn == chess.WHITE
                    else lines[0]["score"].black().score(mate_score=10000)
                )

                candidate_scores = []
                for line in lines:
                    move = line["pv"][0]
                    score_obj = line["score"]
                    turn_score = (
                        score_obj.white().score(mate_score=10000)
                        if board.turn == chess.WHITE
                        else score_obj.black().score(mate_score=10000)
                    )

                    # Do not pick a move that drops > 100 centipawns compared to top move
                    if best_score is not None and turn_score is not None:
                        if best_score - turn_score > 100:
                            continue

                    style_weight = 0
                    board.push(move)
                    is_check = board.is_check()
                    is_mate = board.is_checkmate()
                    board.pop()

                    if is_mate:
                        style_weight += 500
                    if is_check:
                        style_weight += 100 if style == "aggressive" else 20
                    if board.is_capture(move):
                        style_weight += 80 if style == "aggressive" else 40
                    if board.is_castling(move):
                        style_weight += 120 if style == "defensive" else 50

                    candidate_scores.append((line, style_weight))

                if candidate_scores:
                    candidate_scores.sort(key=lambda x: x[1], reverse=True)
                    chosen_line = candidate_scores[0][0]
                    chosen_move = chosen_line["pv"][0]

            san = board.san(chosen_move)
            score_data = chosen_line.get("score")
            score_cp = (
                score_data.white().score(mate_score=10000) if score_data else None
            )

            explanation = self._build_explanation(
                board, chosen_move, san, style, elo, score_cp
            )

            return EngineMoveResult(
                move=chosen_move,
                uci=chosen_move.uci(),
                san=san,
                explanation=explanation,
                is_stockfish=True,
                evaluation={
                    "score_cp": score_cp,
                    "depth": chosen_line.get("depth", depth),
                    "elo": elo,
                    "style": style,
                },
                warning=None,
            )

    def _build_explanation(
        self,
        board: chess.Board,
        move: chess.Move,
        san: str,
        style: str,
        elo: int,
        score_cp: Optional[int],
    ) -> str:
        """Create informative move explanation for user display."""
        board.push(move)
        is_checkmate = board.is_checkmate()
        is_check = board.is_check()
        board.pop()

        reasons = []
        if is_checkmate:
            return f"Stockfish plays {san} delivering checkmate!"
        if is_check:
            reasons.append("puts king in check")
        if board.is_capture(move):
            reasons.append("captures material")
        if board.is_castling(move):
            reasons.append("castles for king safety")

        reason_str = f" ({', '.join(reasons)})" if reasons else ""
        eval_str = f" [Eval: {score_cp/100:+.2f}]" if score_cp is not None else ""
        return f"Stockfish ({elo} ELO, {style}){eval_str}: plays {san}{reason_str}."


def get_chess_engine(
    configured_path: Optional[str] = None,
) -> Tuple[Any, bool, Optional[str]]:
    """Return an initialized engine (Stockfish if available, otherwise FallbackChessEngine).

    Returns:
        (engine_instance, is_stockfish, optional_warning)
    """
    stockfish_bin = find_stockfish_binary(configured_path)
    if stockfish_bin:
        try:
            sf = StockfishEngine(stockfish_bin)
            return sf, True, None
        except Exception as e:
            logger.warning(
                f"Failed initializing Stockfish binary at {stockfish_bin}: {e}"
            )

    instructions = get_stockfish_install_instructions()
    logger.info(
        "Stockfish binary not detected. Using built-in FallbackChessEngine.\n"
        + instructions
    )
    return FallbackChessEngine(), False, instructions
