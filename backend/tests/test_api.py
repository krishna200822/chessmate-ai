"""Integration tests for ChessMate AI REST API endpoints."""


def test_create_new_game(client):
    """Test POST /game/new creates a valid game and stores it."""
    payload = {
        "human_color": "white",
        "elo": 1600,
        "depth": 8,
        "think_time": 0.5,
        "style": "aggressive",
    }
    response = client.post("/game/new", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "id" in data
    assert data["human_color"] == "white"
    assert data["turn"] == "white"
    assert data["status"] == "in_progress"
    assert len(data["legal_moves"]) == 20
    assert data["settings"]["elo"] == 1600


def test_submit_legal_and_illegal_move(client):
    """Test POST /game/move with both legal and illegal moves."""
    new_resp = client.post("/game/new", json={"human_color": "white"})
    game_id = new_resp.json()["id"]

    # 1. Legal move
    move_resp = client.post("/game/move", json={"game_id": game_id, "move": "e2e4"})
    assert move_resp.status_code == 200
    move_data = move_resp.json()
    assert move_data["turn"] == "black"
    assert len(move_data["moves"]) == 1
    assert move_data["moves"][0]["san"] == "e4"

    # 2. Illegal move
    bad_move_resp = client.post(
        "/game/move", json={"game_id": game_id, "move": "e2e5"}
    )
    assert bad_move_resp.status_code == 400
    detail = bad_move_resp.json()["detail"]
    assert "illegal or invalid" in detail


def test_engine_move(client):
    """Test POST /game/engine-move triggers AI move and updates board state."""
    new_resp = client.post("/game/new", json={"human_color": "white"})
    game_id = new_resp.json()["id"]

    # Human moves e4
    client.post("/game/move", json={"game_id": game_id, "move": "e4"})

    # Engine responds
    engine_resp = client.post(
        "/game/engine-move",
        json={
            "game_id": game_id,
            "elo": 1500,
            "depth": 5,
            "think_time": 0.5,
            "style": "balanced",
        },
    )
    assert engine_resp.status_code == 200
    data = engine_resp.json()

    assert "move" in data
    assert "san" in data
    assert "explanation" in data
    assert len(data["game"]["moves"]) == 2
    assert data["game"]["turn"] == "white"


def test_pause_and_resume_game(client):
    """Test POST /game/pause and POST /game/resume."""
    new_resp = client.post("/game/new")
    game_id = new_resp.json()["id"]

    # Pause
    pause_resp = client.post("/game/pause", json={"game_id": game_id})
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "paused"

    # Move while paused should fail with 409 Conflict
    move_resp = client.post("/game/move", json={"game_id": game_id, "move": "e4"})
    assert move_resp.status_code == 409

    # Resume
    resume_resp = client.post("/game/resume", json={"game_id": game_id})
    assert resume_resp.status_code == 200
    assert resume_resp.json()["status"] == "in_progress"

    # Move now succeeds
    move_resp2 = client.post("/game/move", json={"game_id": game_id, "move": "e4"})
    assert move_resp2.status_code == 200


def test_resign_game(client):
    """Test POST /game/resign."""
    new_resp = client.post("/game/new", json={"human_color": "white"})
    game_id = new_resp.json()["id"]

    resign_resp = client.post(
        "/game/resign", json={"game_id": game_id, "player": "white"}
    )
    assert resign_resp.status_code == 200
    data = resign_resp.json()
    assert data["status"] == "resigned"
    assert data["result"] == "0-1"


def test_get_game_by_id_and_list_games(client):
    """Test GET /game/{id} and GET /game/games."""
    new_resp = client.post("/game/new")
    game_id = new_resp.json()["id"]

    # Get by ID
    get_resp = client.get(f"/game/{game_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == game_id

    # List games
    list_resp = client.get("/game/games")
    assert list_resp.status_code == 200
    games = list_resp.json()
    assert isinstance(games, list)
    assert any(g["id"] == game_id for g in games)


def test_settings_get_and_put(client):
    """Test GET /settings and PUT /settings."""
    get_resp = client.get("/settings")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "elo" in data
    assert "stockfish_available" in data

    # Update settings
    put_resp = client.put(
        "/settings",
        json={"elo": 2100, "style": "aggressive", "think_time": 2.5, "depth": 14},
    )
    assert put_resp.status_code == 200
    updated = put_resp.json()
    assert updated["elo"] == 2100
    assert updated["style"] == "aggressive"
    assert updated["think_time"] == 2.5
    assert updated["depth"] == 14


def test_frontend_serving(client):
    """Verify that built frontend HTML and assets are served properly."""
    res = client.get("/app")
    if res.status_code in [301, 307, 308]:
        res = client.get("/app/")
    assert res.status_code == 200
    assert "ChessMate AI" in res.text
    assert '<div id="root">' in res.text
