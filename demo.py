"""Standalone CLI Demo Script for ChessMate AI.

Demonstrates an autonomous Engine vs Engine chess game with 6-DOF
robotic manipulator trajectory planning and step decomposition.
"""

import sys
import time
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

import chess
from app.arm.kinematics import SixDOFKinematics
from app.arm.planner import ArmPlanner
from app.arm.hardware import HardwareArm
from app.engine import get_chess_engine
from app.config import find_stockfish_binary


def run_cli_demo(max_moves: int = 10):
    print("=" * 72)
    print("         CHESSMATE AI - 6-DOF ROBOTIC CHESS DEMONSTRATION")
    print("=" * 72)
    print("Note: Arm is simulated; hardware integration is the planned next phase.\n")

    kinematics = SixDOFKinematics()
    planner = ArmPlanner(kinematics=kinematics)
    hardware_arm = HardwareArm(planner=planner, kinematics=kinematics, dry_run=True)
    hardware_arm.connect()

    sf_path = find_stockfish_binary()
    engine, is_sf, warning = get_chess_engine(sf_path)
    print(f"Engine Loaded: {'Stockfish UCI' if is_sf else 'Fallback Heuristic Engine'}")
    if warning:
        print(f"Engine Notice: {warning}\n")

    board = chess.Board()
    print("Initial Board Position:")
    print(board)
    print("\nStarting Autonomous Game...\n" + "-" * 72)

    move_num = 1
    start_time = time.time()

    while not board.is_game_over() and move_num <= max_moves:
        turn_color = "White" if board.turn == chess.WHITE else "Black"
        style = "aggressive" if board.turn == chess.WHITE else "balanced"
        elo = 2000 if board.turn == chess.WHITE else 1800

        # Engine selects move
        calc_result = engine.select_move(
            board=board,
            elo=elo,
            depth=10,
            think_time=0.5,
            style=style,
        )

        chosen_move = chess.Move.from_uci(calc_result.uci)
        san = board.san(chosen_move)

        print(f"\n[Move {move_num}] {turn_color} ({style.capitalize()}, ELO {elo}): {san} ({calc_result.uci})")
        print(f"  Rationale : {calc_result.explanation}")

        # Plan 6-DOF Robotic Trajectory
        plan = planner.plan_move(board, chosen_move)
        print(f"  Kinematics: {plan.move_type.upper()} move | {len(plan.steps)} steps | {plan.total_waypoints} waypoints")

        # Execute on hardware/simulated arm stub
        def on_step(evt):
            print(f"    -> Step {evt['index']}/{evt['total']}: {evt['step_name']} ({evt['description']})")

        hardware_arm.execute_plan(plan, on_step_progress=on_step)

        # Apply move to board
        board.push(chosen_move)
        move_num += 1

    total_time = time.time() - start_time
    print("\n" + "=" * 72)
    print("                    DEMO MISSION REPORT")
    print("=" * 72)
    print(f"Total Moves Executed : {move_num - 1}")
    print(f"Total Elapsed Time   : {total_time:.2f} seconds")
    print(f"Game Status          : {'Checkmate' if board.is_checkmate() else 'Stalemate' if board.is_stalemate() else 'In Progress'}")
    print(f"Final Board FEN      : {board.fen()}")
    print(f"Robotic Arm Status   : HOMED & STANDBY")
    print("Note: Arm is simulated; hardware integration is the planned next phase.")
    print("=" * 72)


if __name__ == "__main__":
    moves_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    run_cli_demo(max_moves=moves_limit)
