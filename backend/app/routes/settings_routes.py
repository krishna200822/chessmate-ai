"""Settings API routes for ChessMate AI."""

from fastapi import APIRouter
from app.config import find_stockfish_binary, get_stockfish_install_instructions
from app.database import get_settings, update_settings
from app.schemas import SettingsResponse, SettingsUpdate

router = APIRouter(tags=["Settings"])


@router.get("/settings", response_model=SettingsResponse)
def get_current_settings():
    """Retrieve current engine and game settings along with Stockfish status."""
    settings = get_settings()
    configured_path = settings.get("stockfish_path")
    binary_found = find_stockfish_binary(configured_path)
    instructions = None if binary_found else get_stockfish_install_instructions()

    return SettingsResponse(
        elo=settings["elo"],
        depth=settings["depth"],
        think_time=settings["think_time"],
        style=settings["style"],
        human_color=settings["human_color"],
        stockfish_path=binary_found or configured_path,
        stockfish_available=bool(binary_found),
        install_instructions=instructions,
        updated_at=settings.get("updated_at"),
    )


@router.put("/settings", response_model=SettingsResponse)
def update_current_settings(payload: SettingsUpdate):
    """Update engine and game configuration."""
    update_data = payload.model_dump(exclude_unset=True)
    updated = update_settings(update_data)

    configured_path = updated.get("stockfish_path")
    binary_found = find_stockfish_binary(configured_path)
    instructions = None if binary_found else get_stockfish_install_instructions()

    return SettingsResponse(
        elo=updated["elo"],
        depth=updated["depth"],
        think_time=updated["think_time"],
        style=updated["style"],
        human_color=updated["human_color"],
        stockfish_path=binary_found or configured_path,
        stockfish_available=bool(binary_found),
        install_instructions=instructions,
        updated_at=updated.get("updated_at"),
    )
