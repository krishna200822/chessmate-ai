"""Robotic arm package for ChessMate AI.

Provides kinematics, trajectory planning, and workspace mapping.
"""

from app.arm.kinematics import (
    SixDOFKinematics,
    LinkLengths,
    JointLimit,
    UnreachablePoseError,
    JointLimitError,
)
from app.arm.planner import (
    ArmPlanner,
    BoardMapper,
    ArmPlan,
    ArmTrajectoryStep,
    ArmWaypoint,
    arm_planner,
)

__all__ = [
    "SixDOFKinematics",
    "LinkLengths",
    "JointLimit",
    "UnreachablePoseError",
    "JointLimitError",
    "ArmPlanner",
    "BoardMapper",
    "ArmPlan",
    "ArmTrajectoryStep",
    "ArmWaypoint",
    "arm_planner",
]
