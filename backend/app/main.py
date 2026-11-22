"""Main FastAPI application for ChessMate AI.

Provides REST and WebSocket interfaces for human vs engine chess play
and robotic arm trajectory simulation.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import (
    CORS_ORIGINS,
    find_stockfish_binary,
    get_stockfish_install_instructions,
)
from app.database import init_db, list_games
from app.routes.arm_routes import router as arm_router
from app.routes.game_routes import router as game_router
from app.routes.settings_routes import router as settings_router
from app.websocket import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("chessmate.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle handler."""
    logger.info("Initializing ChessMate AI SQLite database...")
    init_db()

    sf_path = find_stockfish_binary()
    if sf_path:
        logger.info(f"Stockfish engine detected at: {sf_path}")
    else:
        logger.warning(
            "\n" + "=" * 70 + "\n"
            "STOCKFISH BINARY NOT DETECTED!\n"
            + get_stockfish_install_instructions()
            + "\n"
            + "=" * 70
        )
    yield
    logger.info("ChessMate AI backend shutting down.")


app = FastAPI(
    title="ChessMate AI Backend",
    description="Software-only chess system with Stockfish engine and simulated robot arm physical move execution.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST Routers
app.include_router(game_router)
app.include_router(settings_router)
app.include_router(arm_router)


@app.get("/games", tags=["Game"])
def list_games_root(limit: int = 30, offset: int = 0):
    """Retrieve recent games history."""
    return list_games(limit=limit, offset=offset)


@app.get("/", tags=["System"])
def root(request: Request):
    """System health endpoint or browser UI entrypoint."""
    accept = request.headers.get("accept", "")
    if "text/html" in accept and FRONTEND_DIST.exists():
        return FileResponse(FRONTEND_DIST / "index.html")

    sf_path = find_stockfish_binary()
    return {
        "name": "ChessMate AI Backend",
        "version": "1.0.0",
        "status": "online",
        "stockfish_available": bool(sf_path),
        "stockfish_path": sf_path,
    }


@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws/game/{game_id}")
async def websocket_game_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint streaming live game updates, engine thoughts, and arm progress."""
    await ws_manager.connect(game_id, websocket)
    try:
        while True:
            # Keep connection alive and accept client commands if any
            data = await websocket.receive_text()
            # If client sends a ping or message, respond or acknowledge
            if data == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(game_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error on game '{game_id}': {e}")
        ws_manager.disconnect(game_id, websocket)


# Mount Frontend Dist if built
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(FRONTEND_DIST / "assets")),
            name="static_assets",
        )
    app.mount(
        "/app",
        StaticFiles(directory=str(FRONTEND_DIST), html=True),
        name="frontend_app",
    )
