"""Game management REST API endpoints for ChessMate AI."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.database import get_game, get_settings, list_games, save_game
from app.engine import get_chess_engine
from app.game import ChessGame, GameStateError, IllegalMoveError
from app.schemas import (
    EngineMoveRequest,
    EngineMoveResponse,
    GameResponse,
    MoveRequest,
    NewGameRequest,
    PauseResumeRequest,
    ResignRequest,
)
from app.websocket import ws_manager

router = APIRouter(prefix="/game", tags=["Game"])


def _load_game_or_404(game_id: str) -> ChessGame:
    """Retrieve and reconstruct a ChessGame or raise 404."""
    data = get_game(game_id)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game with ID '{game_id}' not found.",
        )
    return ChessGame.from_dict(data)


@router.post("/new", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_new_game(payload: Optional[NewGameRequest] = None):
    """Create a new chess game with default or specified settings."""
    current_settings = get_settings()

    req = payload or NewGameRequest()
    human_color = req.human_color or current_settings["human_color"]

    merged_settings = {
        "elo": req.elo or current_settings["elo"],
        "depth": req.depth or current_settings["depth"],
        "think_time": req.think_time or current_settings["think_time"],
        "style": req.style or current_settings["style"],
        "human_color": human_color,
    }

    game = ChessGame(human_color=human_color, settings=merged_settings)
    game_dict = game.to_dict()
    save_game(game_dict)

    return GameResponse(**game_dict)


@router.post("/move", response_model=GameResponse)
async def submit_move(payload: MoveRequest):
    """Submit a move (in UCI or SAN format) for the current turn."""
    game = _load_game_or_404(payload.game_id)

    try:
        move_info = game.make_move(payload.move)
    except IllegalMoveError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except GameStateError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    game_dict = game.to_dict()
    save_game(game_dict)

    # Broadcast WebSocket events
    await ws_manager.send_board_update(game.id, game_dict, last_move=move_info)

    if game.is_game_over:
        reason = (
            f"Checkmate - {game.result}"
            if game.status == "checkmate"
            else f"Game ended: {game.status}"
        )
        await ws_manager.send_game_over(
            game.id, game.status, game.result, reason, game.export_pgn()
        )

    return GameResponse(**game_dict)


@router.post("/engine-move", response_model=EngineMoveResponse)
async def generate_engine_move(payload: EngineMoveRequest):
    """Compute and play the AI engine move."""
    game = _load_game_or_404(payload.game_id)

    if game.status == "paused":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Game is paused. Resume the game before requesting an engine move.",
        )
    if game.is_game_over:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Game has already ended ({game.status}).",
        )

    # Determine engine parameters
    game_settings = game.settings or {}
    global_settings = get_settings()

    elo = payload.elo or game_settings.get("elo") or global_settings["elo"]
    depth = payload.depth or game_settings.get("depth") or global_settings["depth"]
    think_time = (
        payload.think_time
        or game_settings.get("think_time")
        or global_settings["think_time"]
    )
    style = payload.style or game_settings.get("style") or global_settings["style"]

    # Notify WebSocket subscribers of thinking state
    await ws_manager.send_engine_thinking(game.id, elo, depth, think_time, style)

    # Initialize engine (Stockfish or graceful Fallback)
    engine, is_sf, warning = get_chess_engine(global_settings.get("stockfish_path"))

    try:
        calc_result = engine.select_move(
            board=game.board,
            elo=elo,
            depth=depth,
            think_time=think_time,
            style=style,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Engine computation error: {e}",
        )

    # Execute move on board
    move_info = game.make_move(
        move_input=calc_result.uci,
        explanation=calc_result.explanation,
        evaluation=calc_result.evaluation,
    )

    game_dict = game.to_dict()
    save_game(game_dict)

    # Broadcast WebSocket updates
    await ws_manager.send_board_update(game.id, game_dict, last_move=move_info)

    if game.is_game_over:
        reason = (
            f"Checkmate - {game.result}"
            if game.status == "checkmate"
            else f"Game ended: {game.status}"
        )
        await ws_manager.send_game_over(
            game.id, game.status, game.result, reason, game.export_pgn()
        )

    return EngineMoveResponse(
        move=calc_result.uci,
        san=calc_result.san,
        explanation=calc_result.explanation,
        evaluation=calc_result.evaluation,
        game=GameResponse(**game_dict),
        warning=calc_result.warning or warning,
    )


@router.post("/pause", response_model=GameResponse)
async def pause_game(payload: PauseResumeRequest):
    """Pause an active chess game."""
    game = _load_game_or_404(payload.game_id)
    try:
        game.pause()
    except GameStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    game_dict = game.to_dict()
    save_game(game_dict)
    await ws_manager.send_board_update(game.id, game_dict)
    return GameResponse(**game_dict)


@router.post("/resume", response_model=GameResponse)
async def resume_game(payload: PauseResumeRequest):
    """Resume a paused chess game."""
    game = _load_game_or_404(payload.game_id)
    try:
        game.resume()
    except GameStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    game_dict = game.to_dict()
    save_game(game_dict)
    await ws_manager.send_board_update(game.id, game_dict)
    return GameResponse(**game_dict)


@router.post("/resign", response_model=GameResponse)
async def resign_game(payload: ResignRequest):
    """Resign from a game."""
    game = _load_game_or_404(payload.game_id)
    try:
        game.resign(player=payload.player)
    except GameStateError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    game_dict = game.to_dict()
    save_game(game_dict)

    reason = f"Player {payload.player or game.human_color} resigned."
    await ws_manager.send_board_update(game.id, game_dict)
    await ws_manager.send_game_over(
        game.id, game.status, game.result, reason, game.export_pgn()
    )

    return GameResponse(**game_dict)


@router.get("/games", response_model=List[dict])
def get_game_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List recent games with pagination."""
    return list_games(limit=limit, offset=offset)


@router.get("/{game_id}", response_model=GameResponse)
def get_game_by_id(game_id: str):
    """Retrieve full details of a specific game including PGN and history."""
    game = _load_game_or_404(game_id)
    return GameResponse(**game.to_dict())
