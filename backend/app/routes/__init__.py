"""API routes module."""

from app.routes.arm_routes import router as arm_router
from app.routes.game_routes import router as game_router
from app.routes.settings_routes import router as settings_router

__all__ = ["game_router", "settings_router", "arm_router"]
