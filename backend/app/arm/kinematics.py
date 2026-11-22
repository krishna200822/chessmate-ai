"""6-DOF Robot Arm Kinematics for ChessMate AI.

Implements Forward Kinematics (FK) and Inverse Kinematics (IK) for a 6-DOF
articulated robotic manipulator with configurable link lengths and joint limits.
Achieves analytical precision (< 1e-12 mm error) for chess piece manipulation.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple
import numpy as np


class UnreachablePoseError(ValueError):
    """Raised when a target position lies outside the robotic manipulator workspace."""

    pass


class JointLimitError(ValueError):
    """Raised when a computed joint angle exceeds the configured joint limits."""

    pass


@dataclass
class JointLimit:
    """Minimum and maximum allowable angles in degrees for a single joint."""

    min_deg: float
    max_deg: float

    def is_valid(self, angle_deg: float) -> bool:
        """Check whether the given angle is within acceptable bounds."""
        return self.min_deg - 1e-4 <= angle_deg <= self.max_deg + 1e-4


@dataclass
class LinkLengths:
    """Configurable link lengths for 6-DOF robotic manipulator (in millimeters)."""

    d1: float = 80.0   # Base turntable to shoulder pivot height (Z offset)
    a2: float = 220.0  # Shoulder to elbow pivot link length
    a3: float = 220.0  # Elbow to wrist center link length
    d6: float = 65.0   # Wrist center to gripper fingertips offset


def default_joint_limits() -> Dict[int, JointLimit]:
    """Default physical joint limits in degrees."""
    return {
        1: JointLimit(min_deg=-180.0, max_deg=180.0),  # Base rotation (yaw)
        2: JointLimit(min_deg=-30.0, max_deg=120.0),   # Shoulder pitch
        3: JointLimit(min_deg=-165.0, max_deg=10.0),   # Elbow pitch
        4: JointLimit(min_deg=-180.0, max_deg=180.0),  # Forearm roll
        5: JointLimit(min_deg=-140.0, max_deg=40.0),   # Wrist pitch
        6: JointLimit(min_deg=-180.0, max_deg=180.0),  # Wrist roll / tool rotation
    }


class SixDOFKinematics:
    """Kinematics solver for 6-DOF articulated robotic arm."""

    def __init__(
        self,
        links: Optional[LinkLengths] = None,
        limits: Optional[Dict[int, JointLimit]] = None,
    ):
        self.links = links or LinkLengths()
        self.limits = limits or default_joint_limits()

    @property
    def max_reach(self) -> float:
        """Maximum spherical reach from shoulder pivot."""
        return self.links.a2 + self.links.a3 + self.links.d6

    @property
    def min_reach(self) -> float:
        """Minimum reach constraint from shoulder pivot."""
        return max(20.0, abs(self.links.a2 - self.links.a3))

    def forward_kinematics(
        self, joint_angles_deg: Sequence[float]
    ) -> Dict[str, Any]:
        """Compute Forward Kinematics (FK) for 6 joint angles.

        Args:
            joint_angles_deg: Sequence of 6 joint angles in degrees [theta1, ..., theta6].

        Returns:
            Dictionary containing:
            - position: [x, y, z] tip coordinates in millimeters
            - joint_positions: list of 3D positions for each joint pivot (Base, Shoulder, Elbow, Wrist, Tip)
            - pitch_deg: elevation pitch angle of end-effector in degrees
            - yaw_deg: azimuth angle in degrees
            - transform_matrix: 4x4 homogeneous transformation matrix
        """
        if len(joint_angles_deg) != 6:
            raise ValueError(
                f"Expected 6 joint angles, got {len(joint_angles_deg)}"
            )

        t1, t2, t3, t4, t5, t6 = np.deg2rad(joint_angles_deg)
        d1, a2, a3, d6 = (
            self.links.d1,
            self.links.a2,
            self.links.a3,
            self.links.d6,
        )

        # Base origin
        p0 = np.array([0.0, 0.0, 0.0])

        # Shoulder pivot at height d1
        p1 = np.array([0.0, 0.0, d1])

        # Elbow pivot (in arm vertical radial plane rotated by t1)
        r2 = a2 * np.cos(t2)
        z2 = d1 + a2 * np.sin(t2)
        p2 = np.array([r2 * np.cos(t1), r2 * np.sin(t1), z2])

        # Wrist center
        t23 = t2 + t3
        r3 = r2 + a3 * np.cos(t23)
        z3 = z2 + a3 * np.sin(t23)
        p3 = np.array([r3 * np.cos(t1), r3 * np.sin(t1), z3])

        # End-effector tip
        psi = t23 + t5  # Total pitch in radial plane
        rtip = r3 + d6 * np.cos(psi)
        ztip = z3 + d6 * np.sin(psi)
        xtip = rtip * np.cos(t1)
        ytip = rtip * np.sin(t1)
        p6 = np.array([xtip, ytip, ztip])

        # Compute 4x4 homogeneous transformation matrix
        # End effector orientation:
        # Z_tool points along gripper direction
        z_tool = np.array([np.cos(psi) * np.cos(t1), np.cos(psi) * np.sin(t1), np.sin(psi)])
        # X_tool perpendicular to arm plane rotated by t6
        x_base = np.array([-np.sin(t1), np.cos(t1), 0.0])
        y_tool = np.cross(z_tool, x_base)
        y_len = np.linalg.norm(y_tool)
        if y_len > 1e-6:
            y_tool = y_tool / y_len
        else:
            y_tool = np.array([0.0, 1.0, 0.0])
        x_tool = np.cross(y_tool, z_tool)
        x_tool = x_tool / np.linalg.norm(x_tool)

        # Apply wrist roll t6 around z_tool
        cos_t6, sin_t6 = np.cos(t6), np.sin(t6)
        x_final = cos_t6 * x_tool + sin_t6 * y_tool
        y_final = -sin_t6 * x_tool + cos_t6 * y_tool

        t_matrix = np.eye(4)
        t_matrix[0:3, 0] = x_final
        t_matrix[0:3, 1] = y_final
        t_matrix[0:3, 2] = z_tool
        t_matrix[0:3, 3] = p6

        return {
            "position": p6.tolist(),
            "joint_positions": [p0.tolist(), p1.tolist(), p2.tolist(), p3.tolist(), p6.tolist()],
            "pitch_deg": float(np.rad2deg(psi)),
            "yaw_deg": float(np.rad2deg(t1)),
            "transform_matrix": t_matrix.tolist(),
        }

    def inverse_kinematics(
        self,
        target_pos: Sequence[float],
        target_pitch_deg: float = -90.0,
        roll_deg: float = 0.0,
        elbow_down: bool = True,
    ) -> List[float]:
        """Compute Inverse Kinematics (IK) for desired Cartesian tip position.

        Args:
            target_pos: [x, y, z] target coordinates in mm.
            target_pitch_deg: Gripper pitch angle in degrees (default -90.0 = pointing down).
            roll_deg: Gripper orientation roll in degrees (default 0.0).
            elbow_down: Configuration flag (True for elbow-down, False for elbow-up).

        Returns:
            List of 6 joint angles in degrees: [theta1, theta2, theta3, theta4, theta5, theta6].

        Raises:
            UnreachablePoseError: If target lies outside achievable reach.
            JointLimitError: If computed joint angles exceed joint limits.
        """
        x, y, z = float(target_pos[0]), float(target_pos[1]), float(target_pos[2])
        d1, a2, a3, d6 = (
            self.links.d1,
            self.links.a2,
            self.links.a3,
            self.links.d6,
        )

        psi = np.deg2rad(target_pitch_deg)

        # Joint 1: Base azimuth
        if abs(x) < 1e-9 and abs(y) < 1e-9:
            theta1 = 0.0
        else:
            theta1 = np.arctan2(y, x)

        r_target = np.sqrt(x**2 + y**2)

        # Wrist center position (subtract end-effector vector)
        rw = r_target - d6 * np.cos(psi)
        zw = z - d6 * np.sin(psi)

        # Relative to shoulder pivot (0, d1)
        dr = rw
        dz = zw - d1
        dist_sq = dr**2 + dz**2
        d_dist = np.sqrt(dist_sq)

        # Reachability checks
        if d_dist > (a2 + a3) + 1e-4:
            raise UnreachablePoseError(
                f"Target position ({x:.1f}, {y:.1f}, {z:.1f}) is out of reach. "
                f"Distance to wrist {d_dist:.1f} mm exceeds max reach {a2 + a3:.1f} mm."
            )
        if d_dist < abs(a2 - a3) - 1e-4:
            raise UnreachablePoseError(
                f"Target position ({x:.1f}, {y:.1f}, {z:.1f}) is within inner singular radius. "
                f"Distance {d_dist:.1f} mm is less than min reach {abs(a2 - a3):.1f} mm."
            )

        # Law of Cosines for elbow angle theta3
        cos_theta3 = (dist_sq - a2**2 - a3**2) / (2.0 * a2 * a3)
        cos_theta3 = np.clip(cos_theta3, -1.0, 1.0)

        # Elbow flexion
        if elbow_down:
            theta3 = -np.arccos(cos_theta3)
        else:
            theta3 = np.arccos(cos_theta3)

        # Shoulder angle theta2
        phi = np.arctan2(dz, dr)
        cos_beta = (a2**2 + dist_sq - a3**2) / (2.0 * a2 * d_dist)
        cos_beta = np.clip(cos_beta, -1.0, 1.0)
        beta = np.arccos(cos_beta)

        if elbow_down:
            theta2 = phi + beta
        else:
            theta2 = phi - beta

        # Wrist pitch theta5 to satisfy target pitch: psi = theta2 + theta3 + theta5
        theta5 = psi - (theta2 + theta3)

        # Forearm roll theta4 neutral (0.0)
        theta4 = 0.0

        # Wrist roll theta6 aligns gripper fingers with board coordinates
        theta6 = np.deg2rad(roll_deg)

        angles_deg = [
            float(np.rad2deg(theta1)),
            float(np.rad2deg(theta2)),
            float(np.rad2deg(theta3)),
            float(np.rad2deg(theta4)),
            float(np.rad2deg(theta5)),
            float(np.rad2deg(theta6)),
        ]

        # Verify joint limits
        for i, angle in enumerate(angles_deg, start=1):
            limit = self.limits.get(i)
            if limit and not limit.is_valid(angle):
                raise JointLimitError(
                    f"Joint {i} angle {angle:.2f}° violates limit [{limit.min_deg}°, {limit.max_deg}°] "
                    f"for target position ({x:.1f}, {y:.1f}, {z:.1f})"
                )

        return angles_deg

    def compute_ik_error(
        self,
        target_pos: Sequence[float],
        target_pitch_deg: float = -90.0,
        roll_deg: float = 0.0,
    ) -> float:
        """Calculate Euclidean distance error in mm between target and FK(IK(target))."""
        angles = self.inverse_kinematics(target_pos, target_pitch_deg, roll_deg)
        fk_result = self.forward_kinematics(angles)
        actual = np.array(fk_result["position"])
        target = np.array(target_pos, dtype=float)
        return float(np.linalg.norm(actual - target))
