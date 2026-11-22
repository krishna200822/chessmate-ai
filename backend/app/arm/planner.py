"""Robot Arm Trajectory Planner for ChessMate AI.

Translates high-level chess moves (including captures, castling, en passant,
and promotions) into discrete pick-and-place manipulation steps, computes
inverse kinematics, and generates smooth joint-angle trajectories for the 6-DOF arm.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple
import asyncio
import chess
import numpy as np

from app.arm.kinematics import SixDOFKinematics
from app.config import (
    SQUARE_SIZE,
    BOARD_CENTER_X,
    BOARD_CENTER_Y,
    BOARD_Z,
    PIECE_GRIP_Z,
    HOVER_Z,
    TRAY_Z,
    SIDE_TRAY_WHITE,
    SIDE_TRAY_BLACK,
    ARM_HOME_POS,
)
from app.websocket import ws_manager


@dataclass
class ArmWaypoint:
    """Single interpolated point along the arm trajectory."""

    time: float
    joint_angles: List[float]  # [theta1, ..., theta6] in degrees
    position: List[float]      # [x, y, z] tip coordinates in mm
    gripper: float             # 0.0 (open) to 1.0 (closed)
    step_name: str


@dataclass
class ArmTrajectoryStep:
    """Discrete step within a piece manipulation plan."""

    step_name: str
    description: str
    target_pos: List[float]
    joint_angles: List[float]
    gripper: float
    duration: float
    waypoints: List[ArmWaypoint] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert step to dictionary."""
        return {
            "step_name": self.step_name,
            "description": self.description,
            "target_pos": [round(c, 2) for c in self.target_pos],
            "joint_angles": [round(a, 2) for a in self.joint_angles],
            "gripper": self.gripper,
            "duration": self.duration,
            "waypoints": [
                {
                    "time": round(w.time, 3),
                    "joint_angles": [round(a, 2) for a in w.joint_angles],
                    "position": [round(p, 2) for p in w.position],
                    "gripper": w.gripper,
                    "step_name": w.step_name,
                }
                for w in self.waypoints
            ],
        }


@dataclass
class ArmPlan:
    """Complete multi-step manipulation plan for a chess move."""

    move_uci: str
    move_san: str
    move_type: str  # normal, capture, castling, en_passant, promotion
    steps: List[ArmTrajectoryStep]
    total_duration: float
    total_waypoints: int

    def to_dict(self) -> Dict[str, Any]:
        """Convert full plan to dictionary."""
        return {
            "move_uci": self.move_uci,
            "move_san": self.move_san,
            "move_type": self.move_type,
            "steps": [s.to_dict() for s in self.steps],
            "total_steps": len(self.steps),
            "total_duration": round(self.total_duration, 2),
            "total_waypoints": self.total_waypoints,
        }


class BoardMapper:
    """Maps algebraic chess squares (a1-h8) and trays to 3D Cartesian coordinates."""

    def __init__(
        self,
        square_size: float = SQUARE_SIZE,
        center_x: float = BOARD_CENTER_X,
        center_y: float = BOARD_CENTER_Y,
        board_z: float = BOARD_Z,
        grip_z: float = PIECE_GRIP_Z,
        hover_z: float = HOVER_Z,
        tray_white: Tuple[float, float, float] = SIDE_TRAY_WHITE,
        tray_black: Tuple[float, float, float] = SIDE_TRAY_BLACK,
    ):
        self.square_size = square_size
        self.center_x = center_x
        self.center_y = center_y
        self.board_z = board_z
        self.grip_z = grip_z
        self.hover_z = hover_z
        self.tray_white = tray_white
        self.tray_black = tray_black

    def square_to_xy(self, square: chess.Square) -> Tuple[float, float]:
        """Calculate board-plane (X, Y) center coordinates for a given chess.Square."""
        file_idx = chess.square_file(square)  # 0 (a) to 7 (h)
        rank_idx = chess.square_rank(square)  # 0 (1) to 7 (8)

        # File a to h mapped to X (centered at center_x)
        x = self.center_x + (file_idx - 3.5) * self.square_size
        # Rank 1 to 8 mapped to Y (centered at center_y)
        y = self.center_y + (rank_idx - 3.5) * self.square_size

        return round(x, 3), round(y, 3)

    def square_to_coords(
        self, square: chess.Square, height_type: str = "grip"
    ) -> List[float]:
        """Return [x, y, z] coordinates for a square at 'grip' or 'hover' height."""
        x, y = self.square_to_xy(square)
        z = self.hover_z if height_type == "hover" else self.grip_z
        return [x, y, z]

    def get_tray_coords(
        self, color: chess.Color, height_type: str = "grip", slot_index: int = 0
    ) -> List[float]:
        """Return coordinates for captured piece tray."""
        base_tray = self.tray_white if color == chess.WHITE else self.tray_black
        x = base_tray[0]
        # Offset slightly along Y for each subsequent captured piece
        y = base_tray[1] + (slot_index % 8) * 10.0 - 35.0
        z = self.hover_z if height_type == "hover" else base_tray[2]
        return [round(x, 2), round(y, 2), round(z, 2)]

    def get_promotion_reserve_coords(
        self, color: chess.Color, height_type: str = "grip"
    ) -> List[float]:
        """Return coordinates for promotion reserve queen piece."""
        # Placed near side trays
        x = -170.0 if color == chess.WHITE else 170.0
        y = 330.0
        z = self.hover_z if height_type == "hover" else self.grip_z
        return [x, y, z]


class ArmPlanner:
    """Plans 6-DOF trajectories for chess moves and manages execution streaming."""

    def __init__(
        self,
        kinematics: Optional[SixDOFKinematics] = None,
        mapper: Optional[BoardMapper] = None,
        waypoints_per_step: int = 8,
    ):
        self.kinematics = kinematics or SixDOFKinematics()
        self.mapper = mapper or BoardMapper()
        self.waypoints_per_step = max(3, waypoints_per_step)
        self.home_pos = list(ARM_HOME_POS)
        self.home_angles = self.kinematics.inverse_kinematics(self.home_pos)

    def _interpolate_waypoints(
        self,
        start_angles: List[float],
        end_angles: List[float],
        start_pos: List[float],
        end_pos: List[float],
        start_time: float,
        duration: float,
        gripper: float,
        step_name: str,
    ) -> List[ArmWaypoint]:
        """Generate smooth S-curve interpolated joint waypoints between two configurations."""
        waypoints: List[ArmWaypoint] = []
        n = self.waypoints_per_step

        for i in range(n + 1):
            tau = i / float(n)
            # Smooth cubic polynomial S-curve: s(t) = 3t^2 - 2t^3
            s = 3.0 * (tau**2) - 2.0 * (tau**3)

            # Interpolate joint angles
            curr_angles = [
                start_angles[j] + s * (end_angles[j] - start_angles[j])
                for j in range(6)
            ]
            # Interpolate Cartesian position
            curr_pos = [
                start_pos[j] + s * (end_pos[j] - start_pos[j])
                for j in range(3)
            ]
            t = start_time + tau * duration

            waypoints.append(
                ArmWaypoint(
                    time=t,
                    joint_angles=curr_angles,
                    position=curr_pos,
                    gripper=gripper,
                    step_name=step_name,
                )
            )

        return waypoints

    def _create_step(
        self,
        step_name: str,
        description: str,
        target_pos: List[float],
        gripper: float,
        prev_angles: List[float],
        prev_pos: List[float],
        current_time: float,
        duration: float = 0.5,
    ) -> Tuple[ArmTrajectoryStep, float]:
        """Compute IK and interpolate waypoints for a single step."""
        target_angles = self.kinematics.inverse_kinematics(target_pos)
        waypoints = self._interpolate_waypoints(
            start_angles=prev_angles,
            end_angles=target_angles,
            start_pos=prev_pos,
            end_pos=target_pos,
            start_time=current_time,
            duration=duration,
            gripper=gripper,
            step_name=step_name,
        )

        step = ArmTrajectoryStep(
            step_name=step_name,
            description=description,
            target_pos=target_pos,
            joint_angles=target_angles,
            gripper=gripper,
            duration=duration,
            waypoints=waypoints,
        )

        return step, current_time + duration

    def _plan_pick_and_place(
        self,
        source_pos_hover: List[float],
        source_pos_grip: List[float],
        target_pos_hover: List[float],
        target_pos_grip: List[float],
        piece_label: str,
        steps: List[ArmTrajectoryStep],
        prev_angles: List[float],
        prev_pos: List[float],
        current_time: float,
        is_victim: bool = False,
    ) -> Tuple[List[float], List[float], float]:
        """Helper to generate standard pick-and-place sequence."""
        # 1. Hover above source
        step1_name = "hover_victim" if is_victim else "hover_source"
        step1_desc = f"Hover above {piece_label} to capture" if is_victim else f"Hover above {piece_label} source"
        step1, current_time = self._create_step(
            step_name=step1_name,
            description=step1_desc,
            target_pos=source_pos_hover,
            gripper=0.0,
            prev_angles=prev_angles,
            prev_pos=prev_pos,
            current_time=current_time,
            duration=0.6,
        )
        steps.append(step1)

        # 2. Descend to grip
        step2_name = "descend_victim" if is_victim else "descend_source"
        step2_desc = f"Descend to grip victim {piece_label}" if is_victim else f"Descend to grip {piece_label}"
        step2, current_time = self._create_step(
            step_name=step2_name,
            description=step2_desc,
            target_pos=source_pos_grip,
            gripper=0.0,
            prev_angles=step1.joint_angles,
            prev_pos=source_pos_hover,
            current_time=current_time,
            duration=0.4,
        )
        steps.append(step2)

        # 3. Grip piece (close claw)
        step3_name = "grip_victim" if is_victim else "grip"
        step3_desc = f"Grip victim {piece_label}" if is_victim else f"Grip {piece_label}"
        step3, current_time = self._create_step(
            step_name=step3_name,
            description=step3_desc,
            target_pos=source_pos_grip,
            gripper=1.0,
            prev_angles=step2.joint_angles,
            prev_pos=source_pos_grip,
            current_time=current_time,
            duration=0.3,
        )
        steps.append(step3)

        # 4. Lift to hover
        step4_name = "lift_victim" if is_victim else "lift_source"
        step4_desc = f"Lift victim {piece_label} to transit height" if is_victim else f"Lift {piece_label} to transit height"
        step4, current_time = self._create_step(
            step_name=step4_name,
            description=step4_desc,
            target_pos=source_pos_hover,
            gripper=1.0,
            prev_angles=step3.joint_angles,
            prev_pos=source_pos_grip,
            current_time=current_time,
            duration=0.4,
        )
        steps.append(step4)

        # 5. Move above destination
        step5_name = "move_victim_to_tray" if is_victim else "move_above_target"
        step5_desc = f"Move victim {piece_label} to side tray" if is_victim else f"Move {piece_label} above target"
        step5, current_time = self._create_step(
            step_name=step5_name,
            description=step5_desc,
            target_pos=target_pos_hover,
            gripper=1.0,
            prev_angles=step4.joint_angles,
            prev_pos=source_pos_hover,
            current_time=current_time,
            duration=0.8,
        )
        steps.append(step5)

        # 6. Descend to target
        step6_name = "descend_victim_to_tray" if is_victim else "descend_target"
        step6_desc = f"Descend victim {piece_label} into side tray" if is_victim else f"Descend {piece_label} onto target position"
        step6, current_time = self._create_step(
            step_name=step6_name,
            description=step6_desc,
            target_pos=target_pos_grip,
            gripper=1.0,
            prev_angles=step5.joint_angles,
            prev_pos=target_pos_hover,
            current_time=current_time,
            duration=0.4,
        )
        steps.append(step6)

        # 7. Release piece (open claw)
        step7_name = "tray_release_victim" if is_victim else "release"
        step7_desc = f"Release victim {piece_label} in side tray" if is_victim else f"Release {piece_label}"
        step7, current_time = self._create_step(
            step_name=step7_name,
            description=step7_desc,
            target_pos=target_pos_grip,
            gripper=0.0,
            prev_angles=step6.joint_angles,
            prev_pos=target_pos_grip,
            current_time=current_time,
            duration=0.3,
        )
        steps.append(step7)

        # 8. Retract back to hover
        step8_name = "retract_tray_victim" if is_victim else "retract_hover"
        step8_desc = "Retract gripper from side tray to clearance height" if is_victim else "Retract gripper to clearance height"
        step8, current_time = self._create_step(
            step_name=step8_name,
            description=step8_desc,
            target_pos=target_pos_hover,
            gripper=0.0,
            prev_angles=step7.joint_angles,
            prev_pos=target_pos_grip,
            current_time=current_time,
            duration=0.4,
        )
        steps.append(step8)

        return step8.joint_angles, target_pos_hover, current_time

    def _plan_capture(
        self,
        from_sq: chess.Square,
        to_sq: chess.Square,
        moving_color: chess.Color,
        steps: List[ArmTrajectoryStep],
        prev_angles: List[float],
        prev_pos: List[float],
        current_time: float,
    ) -> Tuple[List[float], List[float], float]:
        """Plan 2-stage capture: remove victim piece to side tray, then move attacking piece."""
        # 1. Remove captured piece (victim) to side tray
        cap_hover = self.mapper.square_to_coords(to_sq, "hover")
        cap_grip = self.mapper.square_to_coords(to_sq, "grip")
        tray_hover = self.mapper.get_tray_coords(moving_color, "hover")
        tray_grip = self.mapper.get_tray_coords(moving_color, "grip")

        curr_angles, curr_pos, current_time = self._plan_pick_and_place(
            source_pos_hover=cap_hover,
            source_pos_grip=cap_grip,
            target_pos_hover=tray_hover,
            target_pos_grip=tray_grip,
            piece_label="captured piece",
            steps=steps,
            prev_angles=prev_angles,
            prev_pos=prev_pos,
            current_time=current_time,
            is_victim=True,
        )

        # 2. Move attacking piece from source to target
        src_hover = self.mapper.square_to_coords(from_sq, "hover")
        src_grip = self.mapper.square_to_coords(from_sq, "grip")
        dst_hover = self.mapper.square_to_coords(to_sq, "hover")
        dst_grip = self.mapper.square_to_coords(to_sq, "grip")

        curr_angles, curr_pos, current_time = self._plan_pick_and_place(
            source_pos_hover=src_hover,
            source_pos_grip=src_grip,
            target_pos_hover=dst_hover,
            target_pos_grip=dst_grip,
            piece_label=chess.square_name(from_sq),
            steps=steps,
            prev_angles=curr_angles,
            prev_pos=curr_pos,
            current_time=current_time,
            is_victim=False,
        )
        return curr_angles, curr_pos, current_time

    def plan_move(self, board: chess.Board, move: chess.Move) -> ArmPlan:
        """Create full robotic trajectory plan for a chess move on board."""
        try:
            san = board.san(move)
        except Exception:
            san = move.uci()

        uci = move.uci()
        from_sq = move.from_square
        to_sq = move.to_square

        try:
            is_castling = board.is_castling(move)
        except Exception:
            is_castling = False

        try:
            is_en_passant = board.is_en_passant(move)
        except Exception:
            is_en_passant = False

        piece_at_src = board.piece_at(from_sq)
        piece_at_dst = board.piece_at(to_sq)
        moving_color = piece_at_src.color if piece_at_src else board.turn

        try:
            is_capture = board.is_capture(move)
        except Exception:
            is_capture = False

        if not is_capture and piece_at_dst is not None:
            if piece_at_src is None or piece_at_dst.color != piece_at_src.color:
                is_capture = True

        is_promotion = move.promotion is not None

        if is_castling:
            move_type = "castling"
        elif is_en_passant:
            move_type = "en_passant"
        elif is_promotion:
            move_type = "promotion"
        elif is_capture:
            move_type = "capture"
        else:
            move_type = "normal"

        steps: List[ArmTrajectoryStep] = []
        curr_angles = self.home_angles
        curr_pos = list(self.home_pos)
        current_time = 0.0

        # --- CASE 1: EN PASSANT ---
        if is_en_passant:
            # Captured pawn is on target's file, source's rank
            captured_sq = chess.square(chess.square_file(to_sq), chess.square_rank(from_sq))
            cap_hover = self.mapper.square_to_coords(captured_sq, "hover")
            cap_grip = self.mapper.square_to_coords(captured_sq, "grip")
            tray_hover = self.mapper.get_tray_coords(moving_color, "hover")
            tray_grip = self.mapper.get_tray_coords(moving_color, "grip")

            # Remove captured pawn to side tray
            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=cap_hover,
                source_pos_grip=cap_grip,
                target_pos_hover=tray_hover,
                target_pos_grip=tray_grip,
                piece_label="captured pawn (en passant)",
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
                is_victim=True,
            )

            # Move capturing pawn from source to target
            src_hover = self.mapper.square_to_coords(from_sq, "hover")
            src_grip = self.mapper.square_to_coords(from_sq, "grip")
            dst_hover = self.mapper.square_to_coords(to_sq, "hover")
            dst_grip = self.mapper.square_to_coords(to_sq, "grip")

            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=src_hover,
                source_pos_grip=src_grip,
                target_pos_hover=dst_hover,
                target_pos_grip=dst_grip,
                piece_label="pawn",
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

        # --- CASE 2: CASTLING ---
        elif is_castling:
            # 1. King Move
            king_src_hover = self.mapper.square_to_coords(from_sq, "hover")
            king_src_grip = self.mapper.square_to_coords(from_sq, "grip")
            king_dst_hover = self.mapper.square_to_coords(to_sq, "hover")
            king_dst_grip = self.mapper.square_to_coords(to_sq, "grip")

            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=king_src_hover,
                source_pos_grip=king_src_grip,
                target_pos_hover=king_dst_hover,
                target_pos_grip=king_dst_grip,
                piece_label="King",
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

            # 2. Rook Move
            is_kingside = chess.square_file(to_sq) > chess.square_file(from_sq)
            rank = chess.square_rank(from_sq)
            rook_from_sq = chess.square(7 if is_kingside else 0, rank)
            rook_to_sq = chess.square(5 if is_kingside else 3, rank)

            rook_src_hover = self.mapper.square_to_coords(rook_from_sq, "hover")
            rook_src_grip = self.mapper.square_to_coords(rook_from_sq, "grip")
            rook_dst_hover = self.mapper.square_to_coords(rook_to_sq, "hover")
            rook_dst_grip = self.mapper.square_to_coords(rook_to_sq, "grip")

            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=rook_src_hover,
                source_pos_grip=rook_src_grip,
                target_pos_hover=rook_dst_hover,
                target_pos_grip=rook_dst_grip,
                piece_label="Rook",
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

        # --- CASE 3: PROMOTION ---
        elif is_promotion:
            # If capture on promotion square, first remove captured piece
            if is_capture:
                cap_hover = self.mapper.square_to_coords(to_sq, "hover")
                cap_grip = self.mapper.square_to_coords(to_sq, "grip")
                tray_hover = self.mapper.get_tray_coords(moving_color, "hover")
                tray_grip = self.mapper.get_tray_coords(moving_color, "grip")

                curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                    source_pos_hover=cap_hover,
                    source_pos_grip=cap_grip,
                    target_pos_hover=tray_hover,
                    target_pos_grip=tray_grip,
                    piece_label="captured piece",
                    steps=steps,
                    prev_angles=curr_angles,
                    prev_pos=curr_pos,
                    current_time=current_time,
                    is_victim=True,
                )

            # Remove promoting pawn to side tray
            pawn_hover = self.mapper.square_to_coords(from_sq, "hover")
            pawn_grip = self.mapper.square_to_coords(from_sq, "grip")
            pawn_tray_hover = self.mapper.get_tray_coords(not moving_color, "hover")
            pawn_tray_grip = self.mapper.get_tray_coords(not moving_color, "grip")

            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=pawn_hover,
                source_pos_grip=pawn_grip,
                target_pos_hover=pawn_tray_hover,
                target_pos_grip=pawn_tray_grip,
                piece_label="promoted pawn",
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

            # Retrieve Queen from reserve and place on promotion square
            queen_res_hover = self.mapper.get_promotion_reserve_coords(moving_color, "hover")
            queen_res_grip = self.mapper.get_promotion_reserve_coords(moving_color, "grip")
            dst_hover = self.mapper.square_to_coords(to_sq, "hover")
            dst_grip = self.mapper.square_to_coords(to_sq, "grip")

            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=queen_res_hover,
                source_pos_grip=queen_res_grip,
                target_pos_hover=dst_hover,
                target_pos_grip=dst_grip,
                piece_label="promoted Queen",
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

        # --- CASE 4: STANDARD CAPTURE ---
        elif is_capture:
            curr_angles, curr_pos, current_time = self._plan_capture(
                from_sq=from_sq,
                to_sq=to_sq,
                moving_color=moving_color,
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

        # --- CASE 5: NORMAL MOVE ---
        else:
            src_hover = self.mapper.square_to_coords(from_sq, "hover")
            src_grip = self.mapper.square_to_coords(from_sq, "grip")
            dst_hover = self.mapper.square_to_coords(to_sq, "hover")
            dst_grip = self.mapper.square_to_coords(to_sq, "grip")

            curr_angles, curr_pos, current_time = self._plan_pick_and_place(
                source_pos_hover=src_hover,
                source_pos_grip=src_grip,
                target_pos_hover=dst_hover,
                target_pos_grip=dst_grip,
                piece_label=chess.square_name(from_sq),
                steps=steps,
                prev_angles=curr_angles,
                prev_pos=curr_pos,
                current_time=current_time,
            )

        # Final retract to Home position
        final_retract, current_time = self._create_step(
            step_name="retract_home",
            description="Return arm to standby home position",
            target_pos=self.home_pos,
            gripper=0.0,
            prev_angles=curr_angles,
            prev_pos=curr_pos,
            current_time=current_time,
            duration=0.6,
        )
        steps.append(final_retract)

        total_waypoints = sum(len(s.waypoints) for s in steps)

        return ArmPlan(
            move_uci=uci,
            move_san=san,
            move_type=move_type,
            steps=steps,
            total_duration=current_time,
            total_waypoints=total_waypoints,
        )

    async def stream_plan_progress(
        self,
        game_id: str,
        plan: ArmPlan,
        step_delay: float = 0.05,
    ) -> None:
        """Stream real-time arm execution progress over the WebSocket."""
        total_steps = len(plan.steps)
        for idx, step in enumerate(plan.steps, start=1):
            progress = idx / float(total_steps)
            await ws_manager.broadcast_arm_progress(
                game_id=game_id,
                step=step.step_name,
                index=idx,
                total=total_steps,
                description=step.description,
                progress=progress,
            )
            if step_delay > 0:
                await asyncio.sleep(step_delay)


# Default singleton planner instance
arm_planner = ArmPlanner()
