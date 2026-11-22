"""Unit tests for HardwareArm stub class."""

import chess
import pytest

from app.arm.hardware import HardwareArm
from app.arm.planner import ArmPlan


def test_hardware_arm_initialization():
    arm = HardwareArm(port="COM4", baudrate=115200, dry_run=True)
    assert arm.dry_run is True
    assert arm.connected is False
    assert len(arm.current_angles) == 6
    assert arm.emergency_stop_triggered is False

    telemetry = arm.get_telemetry()
    assert "Arm is simulated; hardware integration is the planned next phase." in telemetry["note"]


def test_hardware_arm_connect_and_home():
    arm = HardwareArm(dry_run=True)
    assert arm.connect() is True
    assert arm.connected is True
    assert arm.home() is True


def test_hardware_arm_plan_and_execute():
    arm = HardwareArm(dry_run=True)
    board = chess.Board()
    move = chess.Move.from_uci("e2e4")

    plan = arm.plan_move(board, move)
    assert isinstance(plan, ArmPlan)
    assert plan.move_uci == "e2e4"
    assert len(plan.steps) >= 8

    progress_events = []

    def on_progress(evt):
        progress_events.append(evt)

    res = arm.execute_plan(plan, on_step_progress=on_progress)
    assert res is True
    assert len(progress_events) == len(plan.steps)
    assert progress_events[-1]["progress"] == 1.0


def test_hardware_arm_emergency_stop():
    arm = HardwareArm(dry_run=True)
    arm.emergency_stop()
    assert arm.emergency_stop_triggered is True
    assert arm.send_joint_angles([0, 0, 0, 0, 0, 0]) is False

    arm.reset_emergency_stop()
    assert arm.emergency_stop_triggered is False
    assert arm.send_joint_angles([0, 0, 0, 0, 0, 0]) is True
