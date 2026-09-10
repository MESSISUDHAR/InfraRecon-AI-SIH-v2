import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.services.auth_service import verify_password

@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as test_client:
        yield test_client

def test_signup_successful(client):
    unique_email = "planner.alex@infra-project.com"
    # Clean up test user if exists
    db = SessionLocal()
    db.query(User).filter(User.email == unique_email).delete()
    db.commit()
    db.close()

    signup_payload = {
        "full_name": "Alex Mercer",
        "email": unique_email,
        "password": "SecurePassword#2026",
        "confirm_password": "SecurePassword#2026",
        "role": "Lead Project Engineer"
    }

    response = client.post("/api/auth/signup", json=signup_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert "user" in data
    assert data["user"]["email"] == unique_email
    assert data["user"]["full_name"] == "Alex Mercer"
    assert data["user"]["role"] == "Lead Project Engineer"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify in DB that password is not plaintext
    db = SessionLocal()
    user_in_db = db.query(User).filter(User.email == unique_email).first()
    assert user_in_db is not None
    assert user_in_db.password_hash != "SecurePassword#2026"
    assert verify_password("SecurePassword#2026", user_in_db.password_hash) is True
    db.close()

def test_signup_duplicate_email_rejected(client):
    email = "duplicate.test@infra-project.com"
    db = SessionLocal()
    db.query(User).filter(User.email == email).delete()
    db.commit()
    db.close()

    payload = {
        "full_name": "Test User",
        "email": email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "Site Supervisor"
    }

    res1 = client.post("/api/auth/signup", json=payload)
    assert res1.status_code == 201

    # Attempt second registration with same email
    res2 = client.post("/api/auth/signup", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()

def test_signup_password_mismatch_rejected(client):
    payload = {
        "full_name": "Mismatch User",
        "email": "mismatch@infra-project.com",
        "password": "Password123!",
        "confirm_password": "DifferentPassword456!",
        "role": "Planner"
    }
    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code == 422

def test_login_successful_and_me_endpoint(client):
    email = "login.valid@infra-project.com"
    password = "CorrectSecretPassword2026!"
    
    # Register user first
    db = SessionLocal()
    db.query(User).filter(User.email == email).delete()
    db.commit()
    db.close()

    signup_res = client.post("/api/auth/signup", json={
        "full_name": "Sarah Connor",
        "email": email,
        "password": password,
        "confirm_password": password,
        "role": "Construction Planner"
    })
    assert signup_res.status_code == 201

    # Login
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_res.status_code == 200
    auth_data = login_res.json()
    assert "access_token" in auth_data
    assert auth_data["token_type"] == "bearer"
    assert auth_data["user"]["email"] == email
    assert auth_data["user"]["full_name"] == "Sarah Connor"

    token = auth_data["access_token"]

    # Call /api/auth/me with Bearer token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    user_info = me_res.json()
    assert user_info["email"] == email
    assert user_info["full_name"] == "Sarah Connor"
    assert user_info["role"] == "Construction Planner"

def test_login_invalid_credentials(client):
    # Non-existent user
    res = client.post("/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "SomePassword123"
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]

    # Wrong password for existing user
    res_wrong_pw = client.post("/api/auth/login", json={
        "email": "login.valid@infra-project.com",
        "password": "WrongPasswordHere"
    })
    assert res_wrong_pw.status_code == 401
    assert "Invalid email or password" in res_wrong_pw.json()["detail"]

def test_me_endpoint_unauthorized_without_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401

    res_bad_token = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_token_value_xyz"})
    assert res_bad_token.status_code == 401
