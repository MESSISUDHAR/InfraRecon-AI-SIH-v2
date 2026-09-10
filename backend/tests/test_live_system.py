import requests
import json
import time

BASE_API = "http://127.0.0.1:8000/api"
HEALTH_URL = "http://127.0.0.1:8000/health"
FRONTEND_URL = "http://127.0.0.1:5173"

def run_system_verification():
    print("\n--- [TEST 0: System & Frontend Reachability] ---")
    h_res = requests.get(HEALTH_URL)
    print("Health Status:", h_res.status_code, h_res.json())
    assert h_res.status_code == 200

    f_res = requests.get(FRONTEND_URL)
    print("Frontend Dev Server Status:", f_res.status_code)
    assert f_res.status_code == 200
    assert "InfraRecon AI" in f_res.text or "<div id=\"root\">" in f_res.text

    print("\n--- [TEST 1 & 2: Unauthenticated Route Protection] ---")
    # GET /api/auth/me without token -> 401
    me_unauth = requests.get(f"{BASE_API}/auth/me")
    print("Unauthenticated /api/auth/me Status:", me_unauth.status_code, me_unauth.json())
    assert me_unauth.status_code == 401

    print("\n--- [TEST 3: User Signup] ---")
    unique_email = f"lead.engineer.{int(time.time())}@infrarecon.org"
    signup_data = {
        "full_name": "Marcus Vance",
        "email": unique_email,
        "password": "ProductionPassword#2026",
        "confirm_password": "ProductionPassword#2026",
        "role": "Lead Project Engineer"
    }
    signup_res = requests.post(f"{BASE_API}/auth/signup", json=signup_data)
    print("Signup Status:", signup_res.status_code, signup_res.json())
    assert signup_res.status_code == 201
    assert signup_res.json()["status"] == "success"
    assert signup_res.json()["user"]["email"] == unique_email

    print("\n--- [TEST 4: Duplicate Email Rejection] ---")
    dup_res = requests.post(f"{BASE_API}/auth/signup", json=signup_data)
    print("Duplicate Signup Status:", dup_res.status_code, dup_res.json())
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

    print("\n--- [TEST 5: Incorrect Password Rejection] ---")
    wrong_login = requests.post(f"{BASE_API}/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword123"
    })
    print("Wrong Password Login Status:", wrong_login.status_code, wrong_login.json())
    assert wrong_login.status_code == 401
    assert "Invalid email or password" in wrong_login.json()["detail"]

    print("\n--- [TEST 6: Correct Credentials Login & JWT Issuance] ---")
    login_res = requests.post(f"{BASE_API}/auth/login", json={
        "email": unique_email,
        "password": "ProductionPassword#2026"
    })
    print("Valid Login Status:", login_res.status_code)
    assert login_res.status_code == 200
    auth_data = login_res.json()
    assert "access_token" in auth_data
    token = auth_data["access_token"]
    print("JWT Token Type:", auth_data["token_type"])
    print("User Data:", auth_data["user"])

    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- [TEST 7: Token Session Verification (/api/auth/me)] ---")
    me_res = requests.get(f"{BASE_API}/auth/me", headers=headers)
    print("Session Check Status:", me_res.status_code, me_res.json())
    assert me_res.status_code == 200
    assert me_res.json()["email"] == unique_email

    print("\n--- [TEST 8 & 9: Verification of Prototype Modules with Auth] ---")
    # Projects
    prjs = requests.get(f"{BASE_API}/projects", headers=headers)
    assert prjs.status_code == 200
    print(f"Projects API: {len(prjs.json())} projects loaded")

    # Schedule Activities
    sched = requests.get(f"{BASE_API}/schedule/activities?project_id=PRJ-REF-04", headers=headers)
    assert sched.status_code == 200
    print(f"Schedule API: {len(sched.json())} activities loaded")

    # Execution Events
    exec_events = requests.get(f"{BASE_API}/execution-events?project_id=PRJ-REF-04", headers=headers)
    assert exec_events.status_code == 200
    print(f"Execution Events API: {exec_events.status_code} OK")

    # Execution State
    exec_state = requests.get(f"{BASE_API}/execution-state/summary?project_id=PRJ-REF-04", headers=headers)
    assert exec_state.status_code == 200
    print(f"Execution State Summary API: Status {exec_state.status_code} OK")

    # Audit Logs
    audit = requests.get(f"{BASE_API}/audit/logs?project_id=PRJ-REF-04", headers=headers)
    assert audit.status_code == 200
    print(f"Audit API: Status {audit.status_code} OK")

    # Dashboard
    dash = requests.get(f"{BASE_API}/dashboard/summary?project_id=PRJ-REF-04", headers=headers)
    assert dash.status_code == 200
    print(f"Dashboard Summary API: Status {dash.status_code} OK")

    print("\n>>> ALL 13 AUTHENTICATION & PROTOTYPE INTEGRITY TESTS PASSED SUCCESSFULLY! <<<\n")

if __name__ == "__main__":
    run_system_verification()
