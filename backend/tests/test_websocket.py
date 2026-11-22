"""Tests for WebSocket real-time event streaming."""

import json
import pytest
from app.websocket import ws_manager


def test_websocket_connection_and_ping(client):
    """Test connecting to websocket and ping-pong message exchange."""
    with client.websocket_connect("/ws/game/test-game-123") as websocket:
        websocket.send_text("ping")
        data = websocket.receive_text()
        parsed = json.loads(data)
        assert parsed["event"] == "pong"


def test_websocket_broadcast_events(client):
    """Test streaming board_update, engine_thinking, arm_progress, and game_over."""
    game_id = "test-stream-game"

    with client.websocket_connect(f"/ws/game/{game_id}") as websocket:
        # 1. Trigger engine_thinking
        import asyncio

        asyncio.run(
            ws_manager.send_engine_thinking(
                game_id=game_id, elo=1500, depth=10, think_time=1.0, style="balanced"
            )
        )
        msg1 = json.loads(websocket.receive_text())
        assert msg1["event"] == "engine_thinking"
        assert msg1["data"]["game_id"] == game_id
        assert msg1["data"]["status"] == "thinking"

        # 2. Trigger arm_progress
        asyncio.run(
            ws_manager.send_arm_progress(
                game_id=game_id,
                step="hover",
                step_index=1,
                total_steps=8,
                progress=0.125,
                description="Hovering above source square e2",
                joint_angles=[0.0, 45.0, 90.0, 0.0, 0.0, 0.0],
            )
        )
        msg2 = json.loads(websocket.receive_text())
        assert msg2["event"] == "arm_progress"
        assert msg2["data"]["step"] == "hover"
        assert msg2["data"]["progress"] == 0.125

        # 3. Trigger board_update
        sample_state = {
            "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "turn": "black",
            "is_check": False,
            "is_checkmate": False,
            "is_stalemate": False,
            "legal_moves": ["e7e5", "e7e6"],
            "legal_moves_san": ["e5", "e6"],
            "captures": {"white": [], "black": []},
            "status": "in_progress",
            "result": "*",
        }
        asyncio.run(ws_manager.send_board_update(game_id, sample_state))
        msg3 = json.loads(websocket.receive_text())
        assert msg3["event"] == "board_update"
        assert msg3["data"]["turn"] == "black"

        # 4. Trigger game_over
        asyncio.run(
            ws_manager.send_game_over(
                game_id=game_id,
                status="checkmate",
                result="1-0",
                reason="Checkmate - 1-0",
                pgn='[Event "ChessMate AI Match"] 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',
            )
        )
        msg4 = json.loads(websocket.receive_text())
        assert msg4["event"] == "game_over"
        assert msg4["data"]["result"] == "1-0"


def test_arm_plan_streaming_over_websocket(client):
    """Verify that arm trajectory step progress streams over WebSocket."""
    import chess
    from app.arm.planner import arm_planner

    game_id = "test-ws-arm-stream"
    board = chess.Board()
    plan = arm_planner.plan_move(board, chess.Move.from_uci("e2e4"))

    with client.websocket_connect(f"/ws/game/{game_id}") as websocket:
        # Stream the 9 steps
        import asyncio
        asyncio.run(arm_planner.stream_plan_progress(game_id, plan, step_delay=0.001))

        # We should receive 9 arm_progress messages
        for i in range(len(plan.steps)):
            raw = websocket.receive_text()
            msg = json.loads(raw)
            assert msg["event"] == "arm_progress"
            assert msg["data"]["index"] == i + 1
            assert msg["data"]["total"] == len(plan.steps)
            assert 0.0 < msg["data"]["progress"] <= 1.0
