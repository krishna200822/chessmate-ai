/**
 * API client service for ChessMate AI REST endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function handleResponse(res) {
  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      errorDetail = data.detail || errorDetail;
    } catch (_) {
      // Use fallback error message
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  // Game Endpoints
  async newGame(params = {}) {
    const res = await fetch(`${BASE_URL}/game/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  async createGame(params = {}) {
    return this.newGame(params);
  },

  async makeMove(gameId, move) {
    const res = await fetch(`${BASE_URL}/game/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, move }),
    });
    return handleResponse(res);
  },

  async engineMove(gameId, overrides = {}) {
    const res = await fetch(`${BASE_URL}/game/engine-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, ...overrides }),
    });
    return handleResponse(res);
  },

  async pauseGame(gameId) {
    const res = await fetch(`${BASE_URL}/game/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId }),
    });
    return handleResponse(res);
  },

  async resumeGame(gameId) {
    const res = await fetch(`${BASE_URL}/game/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId }),
    });
    return handleResponse(res);
  },

  async resignGame(gameId, player = null) {
    const res = await fetch(`${BASE_URL}/game/resign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, player }),
    });
    return handleResponse(res);
  },

  async getGame(gameId) {
    const res = await fetch(`${BASE_URL}/game/${gameId}`);
    return handleResponse(res);
  },

  async listGames(limit = 20, offset = 0) {
    const res = await fetch(`${BASE_URL}/games?limit=${limit}&offset=${offset}`);
    return handleResponse(res);
  },

  // Settings Endpoints
  async getSettings() {
    const res = await fetch(`${BASE_URL}/settings`);
    return handleResponse(res);
  },

  async updateSettings(data) {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Arm Endpoints
  async getArmPlan(move, fen = null, gameId = null, stream = false) {
    const res = await fetch(`${BASE_URL}/arm/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move, fen, game_id: gameId, stream }),
    });
    return handleResponse(res);
  },

  async getArmConfig() {
    const res = await fetch(`${BASE_URL}/arm/config`);
    return handleResponse(res);
  },

  async calculateIK(targetPos, pitchDeg = -90.0, rollDeg = 0.0) {
    const res = await fetch(`${BASE_URL}/arm/ik`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_pos: targetPos, pitch_deg: pitchDeg, roll_deg: rollDeg }),
    });
    return handleResponse(res);
  },
};
