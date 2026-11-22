"""Pytest fixtures and configuration for ChessMate AI tests."""

import os
import sys
import tempfile
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import DB_PATH
from app.database import init_db
from app.main import app


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    """Create a clean isolated SQLite database for each test without file lock."""
    tmp_path = os.path.join(tempfile.gettempdir(), f"chess_test_{uuid.uuid4().hex}.db")

    monkeypatch.setattr("app.config.DB_PATH", tmp_path)
    monkeypatch.setattr("app.database.DB_PATH", tmp_path)
    init_db(tmp_path)

    yield tmp_path

    # Clean up test database file
    try:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    except OSError:
        pass


@pytest.fixture
def client():
    """FastAPI test client fixture."""
    with TestClient(app) as test_client:
        yield test_client
