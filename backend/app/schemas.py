"""Pydantic data schemas for ChessMate AI API requests and responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from app.config import (
    MIN_ELO,
    MAX_ELO,
    MIN_DEPTH,
    MAX_DEPTH,
    MIN_THINK_TIME,
    MAX_THINK_TIME,
    VALID_STYLES,
    VALID_COLORS,
)


class NewGameRequest(BaseModel):
    """Payload to initiate a new chess game."""

    human_color: Optional[str] = Field(
        default="white", description="Color chosen by human ('white' or 'black')"
    )
    elo: Optional[int] = Field(
        default=None,
        ge=MIN_ELO,
        le=MAX_ELO,
        description=f"Stockfish target ELO ({MIN_ELO}-{MAX_ELO})",
    )
    depth: Optional[int] = Field(
        default=None,
        ge=MIN_DEPTH,
        le=MAX_DEPTH,
        description=f"Engine search depth ({MIN_DEPTH}-{MAX_DEPTH})",
    )
    think_time: Optional[float] = Field(
        default=None,
        ge=MIN_THINK_TIME,
        le=MAX_THINK_TIME,
        description=f"Engine think time limit in seconds ({MIN_THINK_TIME}-{MAX_THINK_TIME})",
    )
    style: Optional[str] = Field(
        default=None,
        description="Playing style ('aggressive', 'balanced', 'defensive')",
    )

    @field_validator("human_color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_COLORS:
            raise ValueError(f"human_color must be one of {VALID_COLORS}")
        return v.lower() if v else "white"

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_STYLES:
            raise ValueError(f"style must be one of {VALID_STYLES}")
        return v.lower() if v else None


class MoveRequest(BaseModel):
    """Payload to submit a move (human move)."""

    game_id: str = Field(..., description="Unique game identifier")
    move: str = Field(..., description="Move in UCI ('e2e4') or SAN ('e4') format")


class EngineMoveRequest(BaseModel):
    """Payload to trigger an AI engine move."""

    game_id: str = Field(..., description="Unique game identifier")
    depth: Optional[int] = Field(default=None, ge=MIN_DEPTH, le=MAX_DEPTH)
    think_time: Optional[float] = Field(
        default=None, ge=MIN_THINK_TIME, le=MAX_THINK_TIME
    )
    elo: Optional[int] = Field(default=None, ge=MIN_ELO, le=MAX_ELO)
    style: Optional[str] = Field(default=None)

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_STYLES:
            raise ValueError(f"style must be one of {VALID_STYLES}")
        return v.lower() if v else None


class PauseResumeRequest(BaseModel):
    """Payload to pause or resume a game."""

    game_id: str = Field(..., description="Unique game identifier")


class ResignRequest(BaseModel):
    """Payload to resign a game."""

    game_id: str = Field(..., description="Unique game identifier")
    player: Optional[str] = Field(
        default=None, description="Resigning player ('white' or 'black')"
    )


class SettingsUpdate(BaseModel):
    """Payload to update engine and game settings."""

    elo: Optional[int] = Field(default=None, ge=MIN_ELO, le=MAX_ELO)
    depth: Optional[int] = Field(default=None, ge=MIN_DEPTH, le=MAX_DEPTH)
    think_time: Optional[float] = Field(
        default=None, ge=MIN_THINK_TIME, le=MAX_THINK_TIME
    )
    style: Optional[str] = Field(default=None)
    human_color: Optional[str] = Field(default=None)
    stockfish_path: Optional[str] = Field(default=None)

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_STYLES:
            raise ValueError(f"style must be one of {VALID_STYLES}")
        return v.lower() if v else None

    @field_validator("human_color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_COLORS:
            raise ValueError(f"human_color must be one of {VALID_COLORS}")
        return v.lower() if v else None


class SettingsResponse(BaseModel):
    """Response containing current engine and game settings."""

    elo: int
    depth: int
    think_time: float
    style: str
    human_color: str
    stockfish_path: Optional[str] = None
    stockfish_available: bool
    install_instructions: Optional[str] = None
    updated_at: Optional[str] = None


class GameResponse(BaseModel):
    """Full serialized state of a chess game."""

    id: str
    fen: str
    status: str
    human_color: str
    turn: str
    result: str
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool
    legal_moves: List[str]
    legal_moves_san: List[str]
    moves: List[Dict[str, Any]]
    captures: Dict[str, List[str]]
    pgn: str
    settings: Dict[str, Any]
    created_at: str
    updated_at: str


class EngineMoveResponse(BaseModel):
    """Response returned when an engine move is executed."""

    move: str
    san: str
    explanation: str
    evaluation: Optional[Dict[str, Any]] = None
    game: GameResponse
    warning: Optional[str] = None


class ArmPlanRequest(BaseModel):
    """Payload to generate robot arm trajectory plan for a chess move."""

    game_id: Optional[str] = Field(
        default=None, description="Game ID to load board state from"
    )
    move: str = Field(..., description="Move in UCI or SAN notation (e.g. 'e2e4', 'e4')")
    fen: Optional[str] = Field(
        default=None,
        description="Optional FEN to plan move on (if game_id not provided)",
    )
    stream: Optional[bool] = Field(
        default=False,
        description="Whether to stream progress events over WebSocket",
    )


class ArmWaypointResponse(BaseModel):
    """Single interpolated point along the arm trajectory."""

    time: float
    joint_angles: List[float]
    position: List[float]
    gripper: float
    step_name: str


class ArmStepResponse(BaseModel):
    """Discrete step within a piece manipulation plan."""

    step_name: str
    description: str
    target_pos: List[float]
    joint_angles: List[float]
    gripper: float
    duration: float
    waypoints: List[ArmWaypointResponse] = Field(default_factory=list)


class ArmPlanResponse(BaseModel):
    """Complete multi-step trajectory plan for a robotic chess move."""

    move_uci: str
    move_san: str
    move_type: str
    steps: List[ArmStepResponse]
    total_steps: int
    total_duration: float
    total_waypoints: int
