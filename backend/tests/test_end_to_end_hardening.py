import pytest
import io
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import get_db, SessionLocal
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.audit_log import AuditLog

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_01_complete_flow_with_arbitrary_new_schedule(db_session: Session):
    """
    Test complete lifecycle on a completely new arbitrary non-demo project:
    'PRJ-SOLAR-99' (500MW Solar Farm) with custom non-demo activity IDs.
    """
    project_id = "PRJ-SOLAR-99"
    project_name = "Rajasthan 500MW Solar Mega Park"
    
    # 1. Clean up any existing records for PRJ-SOLAR-99
    db_session.query(AuditLog).filter(AuditLog.project_id == project_id).delete()
    db_session.query(ExecutionState).filter(ExecutionState.project_id == project_id).delete()
    db_session.query(ExecutionEvent).filter(ExecutionEvent.project_id == project_id).delete()
    db_session.query(Activity).filter(Activity.project_id == project_id).delete()
    db_session.query(Project).filter(Project.id == project_id).delete()
    db_session.commit()

    # 2. Upload brand new schedule CSV with fuzzy column names and CPM links
    csv_content = """Task Code,Task Description,Work Package,Area / Block,Equipment Tag,Planned Start Date,Target Finish Date,Planned Duration,Predecessors
SOL-L5-001,Piling and foundation Ramming for Solar Trackers,Civil Works,Block B,TRK-B12,2026-08-01,2026-08-15,14,
SOL-L5-002,Mounting and Module Mounting Structure (MMS) Erection,Mechanical,Block B,TRK-B12,2026-08-16,2026-08-30,14,SOL-L5-001
SOL-L5-003,Solar PV Module Installation and String Cabling,Solar PV,Block B,INV-04,2026-09-01,2026-09-15,14,SOL-L5-002
SOL-L5-004,Central Inverter Station Termination and DC DB Box,Electrical,Block B,INV-04,2026-09-16,2026-09-30,14,SOL-L5-003
SOL-L5-005,33kV Step-up Transformer and HT Cable Laying to Pooling Substation,Electrical HV,Switchyard,TR-33KV-01,2026-10-01,2026-10-20,19,SOL-L5-004
"""
    files = {
        'file': ('solar_park_schedule.csv', csv_content.encode('utf-8'), 'text/csv')
    }
    data = {
        'project_id': project_id,
        'project_name': project_name,
        'schedule_version': 'v1.0'
    }
    
    upload_res = client.post("/api/schedule/upload", files=files, data=data)
    assert upload_res.status_code == 200, upload_res.text
    upload_json = upload_res.json()
    assert upload_json["success"] is True
    assert upload_json["summary"]["total_activities"] == 5
    assert upload_json["summary"]["project_id"] == project_id

    # Verify activities and vector embeddings are stored in database
    acts = db_session.query(Activity).filter(Activity.project_id == project_id).all()
    assert len(acts) == 5
    for act in acts:
        assert act.embedding_json is not None
        vec = json.loads(act.embedding_json)
        assert len(vec) == 384

    # 3. Submit raw field evidence report for the new project
    dpr_payload = {
        "raw_text": "Completed solar PV module installation and string cabling on tracker table TRK-B12 connected to inverter INV-04 at Block B. Installed 320 bifacial PV modules with QA torque testing completed.",
        "project_id": project_id,
        "source_type": "DPR_TEXT",
        "reporter_name": "Solar Site Incharge Vikram"
    }
    event_res = client.post("/api/execution-events/submit", json=dpr_payload)
    assert event_res.status_code == 200, event_res.text
    event_json = event_res.json()
    assert event_json["success"] is True
    event_id = event_json["event"]["id"]

    # 4. Perform Candidate Retrieval & Semantic Similarity
    candidates_res = client.post(
        "/api/matches/retrieve-candidates",
        json={
            "raw_text": dpr_payload["raw_text"],
            "project_id": project_id,
            "top_k": 5
        }
    )
    assert candidates_res.status_code == 200
    cands_json = candidates_res.json()
    assert cands_json["total_candidates"] >= 1
    top_cand = cands_json["top_candidate"]
    assert top_cand is not None
    # The top candidate should match SOL-L5-003
    assert "SOL-L5-003" in top_cand["activity_id"]

    # 5. Multi-Signal Contextual Reconciliation
    recon_res = client.post(
        "/api/matches/reconcile",
        json={
            "raw_text": dpr_payload["raw_text"],
            "project_id": project_id,
            "top_k": 3
        }
    )
    assert recon_res.status_code == 200
    recon_json = recon_res.json()
    assert recon_json["success"] is True
    rec_cand = recon_json["top_candidate"]
    assert rec_cand is not None
    assert "SOL-L5-003" in rec_cand["activity_id"]
    assert rec_cand["final_confidence"] > 0.50
    assert len(rec_cand["positive_signals"]) > 0 or len(rec_cand["reasoning"]) > 0

    # 6. Planner Human-in-the-Loop Review Gate
    queue_res = client.get(f"/api/review/queue?project_id={project_id}")
    assert queue_res.status_code == 200
    q_data = queue_res.json()
    assert q_data["total_items"] >= 1

    # Planner approves the match
    approve_res = client.post(
        "/api/review/approve",
        json={
            "event_id": event_id,
            "activity_id": rec_cand["activity_id"],
            "reviewer_id": "Senior Solar Planner Patel",
            "notes": "Verified against daily string layout drawings",
            "progress_mode": "CUMULATIVE_ACTIVITY",
            "override_progress": 60.0
        }
    )
    assert approve_res.status_code == 200
    app_json = approve_res.json()
    assert app_json["success"] is True
    assert app_json["audit_log_id"] is not None

    # 7. Verify Verified Execution State and Cumulative Multi-Observation Updates
    state_res = client.get(f"/api/execution-state/activity/{rec_cand['activity_id']}?project_id={project_id}")
    assert state_res.status_code == 200
    state_data = state_res.json()["data"]
    assert state_data["verified_observations_count"] == 1
    assert state_data["status"] in ["In Progress", "Completed", "Behind Schedule"]

    # Submit second observation (cumulative progression to 100%)
    dpr2_res = client.post(
        "/api/execution-events/submit",
        json={
            "raw_text": "Final string connections and labeling completed for inverter INV-04 circuit in Block B. 100% of modules on table TRK-B12 now ready for DC commissioning.",
            "project_id": project_id,
            "source_type": "DPR_TEXT",
            "reporter_name": "QA Lead Sharma"
        }
    )
    event2_id = dpr2_res.json()["event"]["id"]
    client.post(
        "/api/review/approve",
        json={
            "event_id": event2_id,
            "activity_id": rec_cand["activity_id"],
            "reviewer_id": "Senior Solar Planner Patel",
            "notes": "Final field signoff completed",
            "progress_mode": "CUMULATIVE_ACTIVITY",
            "override_progress": 100.0,
            "mark_activity_completed": True
        }
    )

    state2_res = client.get(f"/api/execution-state/activity/{rec_cand['activity_id']}?project_id={project_id}")
    state2_data = state2_res.json()["data"]
    assert state2_data["verified_observations_count"] == 2
    assert len(state2_data["observations_history"]) == 2
    assert state2_data["actual_progress"] == 100.0
    assert state2_data["status"] == "Completed"

    # 8. Dependency Intelligence Traversal
    dep_summary_res = client.get(f"/api/dependencies/impact-summary?project_id={project_id}")
    assert dep_summary_res.status_code == 200
    dep_summary = dep_summary_res.json()
    assert dep_summary["project_id"] == project_id
    assert "Deterministic" in dep_summary["disclaimer"]

    # 9. Project Intelligence Dashboard Dynamic Aggregation
    dash_res = client.get(f"/api/dashboard/summary?project_id={project_id}")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["project_id"] == project_id
    assert dash_data["kpis"]["total_schedule_activities"] == 5
    assert dash_data["kpis"]["verified_activities"] >= 1
    assert len(dash_data["discipline_breakdown"]) >= 3

    # 10. Immutable Audit Trail & Zero Leak Verification
    audit_res = client.get(f"/api/audit/logs?project_id={project_id}")
    assert audit_res.status_code == 200
    audit_records = audit_res.json()["items"]
    assert len(audit_records) >= 2
    for record in audit_records:
        rec_str = json.dumps(record)
        assert "api_key" not in rec_str.lower()
        assert "secret" not in rec_str.lower()
        assert "token" not in rec_str.lower()
        assert "bearer" not in rec_str.lower()

def test_02_zero_hardcoding_and_secret_safety_check(db_session: Session):
    """
    Verifies that no API keys or secrets are ever exposed in any endpoint response.
    """
    endpoints = [
        "/api/schedule/summary?project_id=PRJ-REF-04",
        "/api/dashboard/summary?project_id=PRJ-REF-04",
        "/api/dependencies/impact-summary?project_id=PRJ-REF-04",
        "/api/audit/status",
        "/api/review/policy"
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 200, f"Failed on {ep}"
        text = res.text.lower()
        assert "api_key" not in text
        assert "private_key" not in text
        assert "secret_key" not in text
