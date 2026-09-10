import os
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.models.activity import Activity
from app.models.execution_state import ExecutionState
from app.models.project import Project

@pytest.fixture(autouse=True)
def setup_database():
    init_db()

client = TestClient(app)

def test_120_activity_schedule_ingestion_and_full_lifecycle():
    """
    Test suite verifying memory-optimized schedule ingestion for 120 activities
    and ensuring semantic reconciliation, planner review, and execution state
    operate flawlessly.
    """
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "schedule_activities_120.csv"))
    assert os.path.exists(csv_path), "schedule_activities_120.csv should exist"

    # 1. Upload 120-activity schedule
    with open(csv_path, "rb") as f:
        file_bytes = f.read()

    upload_response = client.post(
        "/api/schedule/upload",
        files={"file": ("schedule_activities_120.csv", file_bytes, "text/csv")},
        data={
            "project_id": "PRJ-120-TEST",
            "project_name": "120 Activity Benchmark Project",
            "schedule_version": "v1.0"
        }
    )
    assert upload_response.status_code == 200
    res_data = upload_response.json()
    assert res_data["success"] is True
    assert res_data["summary"]["total_activities"] == 120

    # 2. Verify all 120 activities have valid 384-dimensional embeddings stored in SQLite
    db = SessionLocal()
    try:
        activities = db.query(Activity).filter(
            Activity.project_id == "PRJ-120-TEST",
            Activity.schedule_version == "v1.0"
        ).all()
        assert len(activities) == 120, f"Expected 120 activities, found {len(activities)}"

        for act in activities:
            assert act.embedding_json is not None, f"Activity {act.activity_id} missing embedding_json"
            vec = json.loads(act.embedding_json)
            assert len(vec) == 384, f"Activity {act.activity_id} embedding dimension is {len(vec)}, expected 384"

        # 3. Verify ExecutionState records initialized for all 120 activities
        states = db.query(ExecutionState).filter(ExecutionState.project_id == "PRJ-120-TEST").all()
        assert len(states) == 120, f"Expected 120 execution states, found {len(states)}"
    finally:
        db.close()

    # 4. Ingest an execution event to trigger extraction and reconciliation
    event_payload = {
        "project_id": "PRJ-120-TEST",
        "raw_text": "Completed installation of 24-inch spool at Area PR-04 line 24-XX with 100% progress.",
        "source_type": "DPR_TEXT",
        "source_id": "DPR-2026-09-08-01"
    }
    event_res = client.post("/api/execution-events/submit", json=event_payload)
    assert event_res.status_code == 200
    evt_json = event_res.json()
    event_id = evt_json["event"]["id"]

    # 5. Extract structured facts
    extract_res = client.post(f"/api/execution-events/{event_id}/extract")
    assert extract_res.status_code == 200
    ext_data = extract_res.json()
    assert ext_data["extracted_data"] is not None

    # 6. Run Reconciliation over the 120 activities
    rec_payload = {
        "event_id": event_id,
        "project_id": "PRJ-120-TEST",
        "top_k": 5
    }
    rec_res = client.post("/api/matches/reconcile", json=rec_payload)
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["success"] is True
    assert rec_data["total_activities_evaluated"] == 120
    assert rec_data["total_candidates"] >= 1

    top_cand = rec_data["top_candidate"]
    assert top_cand is not None
    assert top_cand["semantic_score"] > 0.40
    assert top_cand["final_confidence"] > 0.50
    assert "discipline_score" in top_cand
    assert "location_score" in top_cand
    assert "positive_signals" in top_cand
    assert len(top_cand["positive_signals"]) > 0

    # 7. Check Review Queue & Approve Match
    queue_res = client.get(f"/api/review/queue?project_id=PRJ-120-TEST")
    assert queue_res.status_code == 200
    queue_items = queue_res.json()["items"]
    assert len(queue_items) >= 1

    approve_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "reviewer_id": "LEAD_PLANNER",
        "notes": "Verified against daily piping report."
    })
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["success"] is True
    assert app_data["action_type"] == "PLANNER_APPROVAL"

    # 8. Test Execution State Transition
    state_res = client.get(f"/api/execution-state/summary?project_id=PRJ-120-TEST")
    assert state_res.status_code == 200
    state_summary = state_res.json()["data"]
    assert state_summary["total_activities"] == 120

    # 9. Test Dashboard Summary
    dash_res = client.get(f"/api/dashboard/summary?project_id=PRJ-120-TEST")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["success"] is True
    assert dash_data["project_id"] == "PRJ-120-TEST"
    assert dash_data["kpis"]["total_schedule_activities"] == 120
