"""WebSocket connection manager for real-time game events.

Streams:
- board_update: Broadcast after each move with current FEN, captures, legal moves, check status.
- engine_thinking: Broadcast when the engine starts calculating.
- arm_progress: Broadcast during simulated robotic arm movements.
- game_over: Broadcast when checkmate, stalemate, draw, or resignation occurs.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("chessmate.websocket")


class ConnectionManager:
    """Manages active WebSocket connections grouped by game_id."""

    def __init__(self):
        # game_id -> Set of active WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, game_id: str, websocket: WebSocket) -> None:
        """Accept connection and register websocket to game channel."""
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = set()
        self.active_connections[game_id].add(websocket)
        logger.info(
            f"WebSocket client connected to game '{game_id}'. Total: {len(self.active_connections[game_id])}"
        )

    def disconnect(self, game_id: str, websocket: WebSocket) -> None:
        """Remove disconnected websocket from channel."""
        if game_id in self.active_connections:
            self.active_connections[game_id].discard(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
        logger.info(f"WebSocket client disconnected from game '{game_id}'")

    async def broadcast_event(
        self, game_id: str, event_type: str, data: Dict[str, Any]
    ) -> None:
        """Broadcast a structured event message to all connected clients for a game."""
        if game_id not in self.active_connections:
            return

        message = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        raw_json = json.dumps(message)

        stale_connections: List[WebSocket] = []
        for connection in list(self.active_connections[game_id]):
            try:
                await connection.send_text(raw_json)
            except Exception as e:
                logger.warning(f"Failed to send to client in game {game_id}: {e}")
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(game_id, stale)

    async def send_board_update(
        self,
        game_id: str,
        game_state: Dict[str, Any],
        last_move: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Convenience method to stream board updates."""
        payload = {
            "game_id": game_id,
            "fen": game_state["fen"],
            "turn": game_state["turn"],
            "is_check": game_state["is_check"],
            "is_checkmate": game_state["is_checkmate"],
            "is_stalemate": game_state["is_stalemate"],
            "legal_moves": game_state["legal_moves"],
            "legal_moves_san": game_state["legal_moves_san"],
            "captures": game_state["captures"],
            "status": game_state["status"],
            "result": game_state["result"],
            "last_move": last_move,
        }
        await self.broadcast_event(game_id, "board_update", payload)

    async def send_engine_thinking(
        self, game_id: str, elo: int, depth: int, think_time: float, style: str
    ) -> None:
        """Convenience method to notify clients that engine is computing."""
        payload = {
            "game_id": game_id,
            "elo": elo,
            "depth": depth,
            "think_time": think_time,
            "style": style,
            "status": "thinking",
        }
        await self.broadcast_event(game_id, "engine_thinking", payload)

    async def send_arm_progress(
        self,
        game_id: str,
        step: str,
        step_index: int,
        total_steps: int,
        progress: float,
        description: str,
        joint_angles: Optional[List[float]] = None,
    ) -> None:
        """Broadcast arm simulation progress event."""
        payload = {
            "game_id": game_id,
            "step": step,
            "step_index": step_index,
            "index": step_index,
            "total": total_steps,
            "total_steps": total_steps,
            "progress": round(progress, 3),
            "description": description,
            "joint_angles": joint_angles or [],
        }
        await self.broadcast_event(game_id, "arm_progress", payload)

    async def broadcast_arm_progress(
        self,
        game_id: str,
        step: str,
        index: int,
        total: int,
        description: str,
        progress: float,
        joint_angles: Optional[List[float]] = None,
    ) -> None:
        """Convenience alias for broadcasting arm trajectory progress."""
        await self.send_arm_progress(
            game_id=game_id,
            step=step,
            step_index=index,
            total_steps=total,
            progress=progress,
            description=description,
            joint_angles=joint_angles,
        )

    async def send_game_over(
        self, game_id: str, status: str, result: str, reason: str, pgn: str
    ) -> None:
        """Broadcast game over event."""
        payload = {
            "game_id": game_id,
            "status": status,
            "result": result,
            "reason": reason,
            "pgn": pgn,
        }
        await self.broadcast_event(game_id, "game_over", payload)


# Global singleton manager instance
ws_manager = ConnectionManager()
