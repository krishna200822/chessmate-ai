"""HardwareArm stub class for physical 6-DOF robotic manipulator integration.

Note:
Arm is simulated; hardware integration is the planned next phase.
This stub provides an identical interface to ArmPlanner and kinematics controllers,
allowing real physical hardware (e.g. PCA9685 PWM drivers, Arduino serial controllers,
or ROS2 / micro-ROS manipulators) to be swapped in seamlessly.
"""

import logging
import time
from typing import Any, Callable, Dict, List, Optional
import chess

from app.arm.kinematics import SixDOFKinematics
from app.arm.planner import ArmPlan, ArmPlanner, ArmTrajectoryStep

logger = logging.getLogger("chessmate.arm.hardware")


class HardwareArm:
    """Hardware driver stub for physical 6-DOF robotic chess manipulators.

    Implements the same control surface and step decomposition as the simulated
    ArmPlanner, interfacing with physical servo controllers via serial / bus.
    """

    def __init__(
        self,
        port: str = "COM3",
        baudrate: int = 115200,
        planner: Optional[ArmPlanner] = None,
        kinematics: Optional[SixDOFKinematics] = None,
        dry_run: bool = True,
    ):
        self.port = port
        self.baudrate = baudrate
        self.kinematics = kinematics or SixDOFKinematics()
        self.planner = planner or ArmPlanner(kinematics=self.kinematics)
        self.dry_run = dry_run
        self.connected = False
        self.current_angles = list(self.planner.home_angles)
        self.gripper_clamped = False
        self.emergency_stop_triggered = False

        logger.info(
            f"HardwareArm initialized (port={port}, baud={baudrate}, dry_run={dry_run}). "
            "Arm is simulated; hardware integration is the planned next phase."
        )

    def connect(self) -> bool:
        """Establish physical serial connection to microcontroller or servo bus."""
        if self.dry_run:
            logger.info(f"[HardwareArm] DRY RUN: Simulated connection to {self.port} OK.")
            self.connected = True
            return True

        # In production, initialize serial.Serial or smbus2
        try:
            # import serial
            # self._serial = serial.Serial(self.port, self.baudrate, timeout=1.0)
            self.connected = True
            logger.info(f"[HardwareArm] Connected to physical controller on {self.port}")
            return True
        except Exception as e:
            logger.error(f"[HardwareArm] Hardware connection failed: {e}")
            self.connected = False
            return False

    def disconnect(self) -> None:
        """Safely release servo holding torque and close serial port."""
        logger.info("[HardwareArm] Disconnecting physical arm and releasing torque.")
        self.connected = False

    def home(self) -> bool:
        """Drive all 6 joints to standard calibrated zero/standby position."""
        logger.info("[HardwareArm] Driving joints 1-6 to home angles.")
        return self.send_joint_angles(self.planner.home_angles)

    def send_joint_angles(self, angles_deg: List[float], move_time_sec: float = 0.5) -> bool:
        """Transmit target joint angles (degrees) to hardware actuator controllers."""
        if self.emergency_stop_triggered:
            logger.warning("[HardwareArm] Command rejected: EMERGENCY STOP ACTIVE.")
            return False

        if len(angles_deg) != 6:
            raise ValueError(f"Expected 6 joint angles, got {len(angles_deg)}")

        # Validate mechanical limits
        for i, angle in enumerate(angles_deg):
            joint_idx = i + 1
            if joint_idx in self.kinematics.limits:
                lim = self.kinematics.limits[joint_idx]
                if not lim.is_valid(angle):
                    logger.error(
                        f"[HardwareArm] Joint {joint_idx} angle {angle:.1f}° exceeds limit [{lim.min_deg}°, {lim.max_deg}°]"
                    )
                    return False

        self.current_angles = list(angles_deg)
        if self.dry_run:
            logger.debug(f"[HardwareArm] [DRY RUN] Joint targets: {[round(a, 1) for a in angles_deg]}")
            return True

        return True

    def set_gripper(self, clamp: bool) -> bool:
        """Actuate physical end-effector parallel jaw or solenoid gripper."""
        self.gripper_clamped = clamp
        logger.info(f"[HardwareArm] Gripper actuator: {'CLAMP' if clamp else 'RELEASE'}")
        return True

    def emergency_stop(self) -> None:
        """Immediately cut motor power and stop ongoing motion."""
        logger.warning("[HardwareArm] !!! EMERGENCY STOP TRIGGERED !!!")
        self.emergency_stop_triggered = True

    def reset_emergency_stop(self) -> None:
        """Clear emergency stop flag after safety inspection."""
        logger.info("[HardwareArm] Emergency stop reset.")
        self.emergency_stop_triggered = False

    def plan_move(self, board: chess.Board, move: chess.Move) -> ArmPlan:
        """Generate high-level pick-and-place step plan identical to ArmPlanner."""
        return self.planner.plan_move(board, move)

    def execute_plan(
        self,
        plan: ArmPlan,
        on_step_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> bool:
        """Execute planned multi-step chess move sequentially on physical arm."""
        if not self.connected:
            self.connect()

        total_steps = len(plan.steps)
        logger.info(f"[HardwareArm] Executing move {plan.move_uci} ({total_steps} steps)")

        for idx, step in enumerate(plan.steps):
            if self.emergency_stop_triggered:
                logger.error("[HardwareArm] Execution aborted due to emergency stop.")
                return False

            logger.info(f"[HardwareArm] Step {idx+1}/{total_steps}: {step.step_name} - {step.description}")

            # Send target angles
            success = self.send_joint_angles(step.joint_angles, move_time_sec=step.duration)
            if not success:
                return False

            # Actuate gripper
            self.set_gripper(clamp=step.gripper > 0.5)

            if on_step_progress:
                on_step_progress({
                    "step_name": step.step_name,
                    "description": step.description,
                    "index": idx + 1,
                    "total": total_steps,
                    "progress": round((idx + 1) / total_steps, 2),
                })

            time.sleep(step.duration if not self.dry_run else 0.05)

        logger.info(f"[HardwareArm] Move {plan.move_uci} executed successfully.")
        return True

    def get_telemetry(self) -> Dict[str, Any]:
        """Return real-time hardware status and joint position feedback."""
        return {
            "connected": self.connected,
            "dry_run": self.dry_run,
            "emergency_stop": self.emergency_stop_triggered,
            "joint_angles_deg": [round(a, 1) for a in self.current_angles],
            "joint_angles_rad": [round(a * 0.01745329, 3) for a in self.current_angles],
            "gripper_clamped": self.gripper_clamped,
            "note": "Arm is simulated; hardware integration is the planned next phase.",
        }
