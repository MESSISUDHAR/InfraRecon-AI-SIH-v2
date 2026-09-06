import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database_connected"] is True
    assert "app_name" in data

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"

def test_projects_lifecycle():
    # Create project
    project_payload = {
        "id": "PRJ-TEST-01",
        "name": "Test Infrastructure Project",
        "code": "TEST-01",
        "description": "Integration testing project"
    }
    response = client.post("/api/projects", json=project_payload)
    assert response.status_code in [200, 400] # 200 on first create, 400 if already exists

    # List projects
    response = client.get("/api/projects")
    assert response.status_code == 200
    projects = response.json()
    assert isinstance(projects, list)
    assert any(p["id"] == "PRJ-TEST-01" for p in projects)
