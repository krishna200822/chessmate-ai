"""API endpoints for simulated robot arm trajectory planning and kinematics."""

import asyncio
from typing import Any, Dict, List, Optional
import chess
from fastapi import APIRouter, HTTPException, status

from app.arm.kinematics import (
    JointLimitError,
    SixDOFKinematics,
    UnreachablePoseError,
)
from app.arm.planner import arm_planner
from app.config import (
    ARM_A2,
    ARM_A3,
    ARM_D1,
    ARM_D6,
    ARM_HOME_POS,
    BOARD_CENTER_X,
    BOARD_CENTER_Y,
    HOVER_Z,
    PIECE_GRIP_Z,
    SIDE_TRAY_BLACK,
    SIDE_TRAY_WHITE,
    SQUARE_SIZE,
)
from app.database import get_game
from app.schemas import ArmPlanRequest, ArmPlanResponse

router = APIRouter(prefix="/arm", tags=["arm"])


@router.post("/plan", response_model=ArmPlanResponse)
async def generate_arm_plan(payload: ArmPlanRequest) -> ArmPlanResponse:
    """Generate joint-angle trajectories for a physical robot arm move.

    Maps squares to board Cartesian coordinates, decomposes move into pick-and-place
    steps (handling captures, castling, en passant, promotion), and computes IK.
    Optionally streams step progress over WebSocket /ws/game/{game_id}.
    """
    board = chess.Board()

    if payload.fen:
        try:
            board = chess.Board(payload.fen)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid FEN string: {e}",
            )
    elif payload.game_id:
        game_data = get_game(payload.game_id)
        if not game_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Game '{payload.game_id}' not found.",
            )
        # Check moves history: if clean_move is the latest move already played in game_data,
        # replay all moves except the last one so the arm plans the move on the pre-move board!
        moves_list = game_data.get("moves", [])
        clean_move_check = payload.move.strip()
        if moves_list and (
            moves_list[-1].get("uci") == clean_move_check
            or moves_list[-1].get("san") == clean_move_check
        ):
            reconstructed = chess.Board()
            for m in moves_list[:-1]:
                reconstructed.push_uci(m["uci"])
            board = reconstructed
        else:
            board = chess.Board(game_data["fen"])

    # Parse move as UCI or SAN without requiring cand in board.legal_moves
    clean_move = payload.move.strip()
    chess_move = None

    try:
        # Always allow direct UCI move parsing first so captures never throw 400
        chess_move = chess.Move.from_uci(clean_move)
    except Exception:
        try:
            chess_move = board.parse_san(clean_move)
        except Exception:
            try:
                chess_move = chess.Move.from_uci(clean_move.lower())
            except Exception:
                pass

    if not chess_move:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Move '{clean_move}' cannot be parsed for current board state.",
        )

    try:
        plan = arm_planner.plan_move(board, chess_move)
    except (UnreachablePoseError, JointLimitError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Robot arm kinematics constraint violated: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Trajectory planning failed: {str(e)}",
        )

    # Trigger background WebSocket progress streaming if requested
    if payload.stream and payload.game_id:
        asyncio.create_task(
            arm_planner.stream_plan_progress(
                game_id=payload.game_id,
                plan=plan,
                step_delay=0.08,
            )
        )

    return ArmPlanResponse(**plan.to_dict())


@router.get("/config")
def get_arm_config() -> Dict[str, Any]:
    """Inspect robot arm kinematics, link lengths, joint limits, and board geometry."""
    kin = arm_planner.kinematics
    return {
        "model": "6-DOF Articulated Manipulator",
        "link_lengths": {
            "d1_base_height": kin.links.d1,
            "a2_upper_arm": kin.links.a2,
            "a3_forearm": kin.links.a3,
            "d6_wrist_to_tip": kin.links.d6,
        },
        "joint_limits": {
            joint_id: {"min_deg": limit.min_deg, "max_deg": limit.max_deg}
            for joint_id, limit in kin.limits.items()
        },
        "board_geometry": {
            "square_size": SQUARE_SIZE,
            "center_x": BOARD_CENTER_X,
            "center_y": BOARD_CENTER_Y,
            "grip_z": PIECE_GRIP_Z,
            "hover_z": HOVER_Z,
            "side_tray_white": list(SIDE_TRAY_WHITE),
            "side_tray_black": list(SIDE_TRAY_BLACK),
        },
        "home_position": list(ARM_HOME_POS),
        "home_angles": [round(a, 2) for a in arm_planner.home_angles],
    }


@router.post("/ik")
def calculate_ik(
    target_pos: List[float],
    pitch_deg: float = -90.0,
    roll_deg: float = 0.0,
) -> Dict[str, Any]:
    """Calculate inverse kinematics directly for a target 3D Cartesian position."""
    if len(target_pos) != 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_pos must be a list of 3 coordinates [x, y, z]",
        )
    try:
        angles = arm_planner.kinematics.inverse_kinematics(
            target_pos=target_pos,
            target_pitch_deg=pitch_deg,
            roll_deg=roll_deg,
        )
        error_mm = arm_planner.kinematics.compute_ik_error(
            target_pos=target_pos,
            target_pitch_deg=pitch_deg,
            roll_deg=roll_deg,
        )
        return {
            "target_pos": target_pos,
            "joint_angles_deg": [round(a, 5) for a in angles],
            "error_mm": error_mm,
        }
    except (UnreachablePoseError, JointLimitError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        )


@router.post("/fk")
def calculate_fk(joint_angles_deg: List[float]) -> Dict[str, Any]:
    """Calculate forward kinematics directly for 6 joint angles."""
    if len(joint_angles_deg) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="joint_angles_deg must contain exactly 6 angles in degrees",
        )
    result = arm_planner.kinematics.forward_kinematics(joint_angles_deg)
    return result
