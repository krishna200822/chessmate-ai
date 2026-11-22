"""Unit and integration tests for 6-DOF robot arm kinematics and trajectory planner."""

import chess
import pytest
from fastapi.testclient import TestClient

from app.arm.kinematics import (
    JointLimit,
    JointLimitError,
    LinkLengths,
    SixDOFKinematics,
    UnreachablePoseError,
)
from app.arm.planner import ArmPlanner, BoardMapper
from app.config import (
    ARM_A2,
    ARM_A3,
    ARM_D1,
    ARM_D6,
    BOARD_CENTER_X,
    BOARD_CENTER_Y,
    HOVER_Z,
    PIECE_GRIP_Z,
    SQUARE_SIZE,
)


def test_ik_accuracy_all_64_squares():
    """Verify that inverse kinematics has < 1 mm error for ALL 64 chessboard squares."""
    kinematics = SixDOFKinematics()
    mapper = BoardMapper()

    max_error = 0.0
    for square in chess.SQUARES:
        square_name = chess.square_name(square)
        target_pos = mapper.square_to_coords(square, height_type="grip")

        # Compute IK
        joint_angles = kinematics.inverse_kinematics(target_pos, target_pitch_deg=-90.0)
        assert len(joint_angles) == 6

        # Compute FK on resulting joint angles
        fk_result = kinematics.forward_kinematics(joint_angles)
        actual_pos = fk_result["position"]

        # Compute Euclidean distance error
        err = kinematics.compute_ik_error(target_pos)
        assert err < 1.0, f"IK error {err} mm exceeded 1 mm threshold at square {square_name}"
        max_error = max(max_error, err)

    # In analytical IK, error should be near floating-point precision (< 1e-6 mm)
    assert max_error < 1e-6, f"Max IK error was {max_error:.2e} mm"


def test_ik_hover_height_all_64_squares():
    """Verify IK accuracy for all 64 squares at transit/hover height."""
    kinematics = SixDOFKinematics()
    mapper = BoardMapper()

    for square in chess.SQUARES:
        target_pos = mapper.square_to_coords(square, height_type="hover")
        err = kinematics.compute_ik_error(target_pos)
        assert err < 1.0


def test_joint_limits_validation():
    """Verify that JointLimit correctly validates angles within and outside bounds."""
    limit = JointLimit(min_deg=-90.0, max_deg=90.0)
    assert limit.is_valid(0.0)
    assert limit.is_valid(-90.0)
    assert limit.is_valid(90.0)
    assert not limit.is_valid(-90.1)
    assert not limit.is_valid(95.0)


def test_unreachable_pose_rejection():
    """Verify that points beyond the robot workspace raise UnreachablePoseError."""
    kinematics = SixDOFKinematics()

    # Extremely far position (10 meters away)
    with pytest.raises(UnreachablePoseError):
        kinematics.inverse_kinematics([10000.0, 10000.0, 0.0])

    # Extremely high position (beyond reach envelope)
    with pytest.raises(UnreachablePoseError):
        kinematics.inverse_kinematics([0.0, 200.0, 600.0])


def test_board_mapper_square_coordinates():
    """Verify BoardMapper spatial calculations for corners and center."""
    mapper = BoardMapper(
        square_size=30.0,
        center_x=0.0,
        center_y=270.0,
    )

    # Corner a1 (file 0, rank 0): x = -105, y = 165
    a1_xy = mapper.square_to_xy(chess.A1)
    assert a1_xy == (-105.0, 165.0)

    # Corner h8 (file 7, rank 7): x = +105, y = 375
    h8_xy = mapper.square_to_xy(chess.H8)
    assert h8_xy == (105.0, 375.0)

    # Center d4 (file 3, rank 3): x = -15, y = 255
    d4_xy = mapper.square_to_xy(chess.D4)
    assert d4_xy == (-15.0, 255.0)

    # Center e5 (file 4, rank 4): x = +15, y = 285
    e5_xy = mapper.square_to_xy(chess.E5)
    assert e5_xy == (15.0, 285.0)


def test_normal_move_planning():
    """Verify step decomposition for a standard piece move (e.g., e2 to e4)."""
    planner = ArmPlanner()
    board = chess.Board()
    move = chess.Move.from_uci("e2e4")

    plan = planner.plan_move(board, move)
    assert plan.move_type == "normal"
    assert plan.move_uci == "e2e4"
    assert plan.move_san == "e4"

    # Expect: hover_source, descend_source, grip, lift_source, move_above_target, descend_target, release, retract_hover, retract_home
    step_names = [s.step_name for s in plan.steps]
    expected_sequence = [
        "hover_source",
        "descend_source",
        "grip",
        "lift_source",
        "move_above_target",
        "descend_target",
        "release",
        "retract_hover",
        "retract_home",
    ]
    assert step_names == expected_sequence
    assert plan.total_waypoints > len(plan.steps)
    assert plan.total_duration > 0


def test_capture_move_planning():
    """Verify capture sequence: target cleared to side tray first, then attacker moves."""
    planner = ArmPlanner()
    # 1. e4 d5 2. exd5
    board = chess.Board("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2")
    move = chess.Move.from_uci("e4d5")

    plan = planner.plan_move(board, move)
    assert plan.move_type == "capture"
    step_names = [s.step_name for s in plan.steps]

    # Two pick-and-place actions (8 steps each) + 1 retract_home = 17 steps
    assert len(plan.steps) == 17
    # First pick and place moves captured piece to tray
    assert "captured piece" in plan.steps[0].description.lower()
    # Second pick and place moves e4 pawn to d5
    assert "e4" in plan.steps[8].description.lower()


def test_castling_kingside_planning():
    """Verify castling sequence: moves King first, then moves Rook."""
    planner = ArmPlanner()
    board = chess.Board("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
    move = chess.Move.from_uci("e1g1")  # Kingside castling O-O

    plan = planner.plan_move(board, move)
    assert plan.move_type == "castling"
    # King pick-and-place (8 steps) + Rook pick-and-place (8 steps) + retract_home (1 step) = 17 steps
    assert len(plan.steps) == 17
    assert "king" in plan.steps[0].description.lower()
    assert "rook" in plan.steps[8].description.lower()


def test_en_passant_planning():
    """Verify en passant: captured pawn removed from correct en passant square."""
    planner = ArmPlanner()
    board = chess.Board("rnbqkbnr/ppp2ppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3")
    move = chess.Move.from_uci("e5d6")  # en passant capture of d5 pawn

    plan = planner.plan_move(board, move)
    assert plan.move_type == "en_passant"
    assert len(plan.steps) == 17
    assert "en passant" in plan.steps[0].description.lower()


def test_promotion_planning():
    """Verify pawn promotion sequence: pawn removed to tray, Queen placed on promotion square."""
    planner = ArmPlanner()
    # White pawn on e7 ready to promote to Queen on e8
    board = chess.Board("8/4P3/8/8/8/8/8/4K2k w - - 0 1")
    move = chess.Move.from_uci("e7e8q")

    plan = planner.plan_move(board, move)
    assert plan.move_type == "promotion"
    # Promoting pawn moved to tray + Queen placed from reserve + retract home
    assert "promoted pawn" in plan.steps[0].description.lower()
    assert "queen" in plan.steps[8].description.lower()


def test_arm_rest_api_endpoints(client: TestClient):
    """Verify /arm/config, /arm/plan, /arm/ik, and /arm/fk endpoints."""
    # 1. GET /arm/config
    config_res = client.get("/arm/config")
    assert config_res.status_code == 200
    cfg = config_res.json()
    assert "link_lengths" in cfg
    assert "board_geometry" in cfg
    assert cfg["board_geometry"]["square_size"] == 30.0

    # 2. POST /arm/ik
    ik_res = client.post("/arm/ik", json=[0.0, 250.0, 18.0])
    assert ik_res.status_code == 200
    ik_data = ik_res.json()
    assert len(ik_data["joint_angles_deg"]) == 6
    assert ik_data["error_mm"] < 1.0

    # 3. POST /arm/fk
    fk_res = client.post("/arm/fk", json=ik_data["joint_angles_deg"])
    assert fk_res.status_code == 200
    fk_data = fk_res.json()
    assert "position" in fk_data
    # Reconstructed Y coordinate should match target 250.0 within 0.01 mm (10 microns)
    assert abs(fk_data["position"][1] - 250.0) < 0.01

    # 4. POST /arm/plan (Normal Move)
    plan_res = client.post(
        "/arm/plan",
        json={"move": "e2e4", "fen": chess.STARTING_FEN},
    )
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert plan_data["move_uci"] == "e2e4"
    assert plan_data["move_type"] == "normal"
    assert plan_data["total_steps"] == 9
    assert len(plan_data["steps"]) == 9

    # 5. POST /arm/plan (Capture Move with victim step tags)
    cap_res = client.post(
        "/arm/plan",
        json={"move": "e4d5", "fen": "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"},
    )
    assert cap_res.status_code == 200
    cap_data = cap_res.json()
    assert cap_data["move_type"] == "capture"
    assert cap_data["total_steps"] == 17
    step_names = [s["step_name"] for s in cap_data["steps"]]
    assert "grip_victim" in step_names
    assert "lift_victim" in step_names
    assert "tray_release_victim" in step_names
