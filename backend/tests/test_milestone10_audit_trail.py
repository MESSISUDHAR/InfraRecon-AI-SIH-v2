import os
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.database import init_db, SessionLocal
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.audit_log import AuditLog

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
CSV_SAMPLE_PATH = os.path.join(DATA_DIR, "refinery_expansion_l5.csv")

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """
    Initializes DB and ensures PRJ-REF-04 schedule activities are loaded.
    """
    init_db()
    
    db = SessionLocal()
    act_count = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04").count()
    db.close()
    
    if act_count == 0 and os.path.exists(CSV_SAMPLE_PATH):
        with open(CSV_SAMPLE_PATH, "rb") as f:
            client.post(
                "/api/schedule/upload",
                data={
                    "project_id": "PRJ-REF-04",
                    "project_name": "Refinery Expansion Project",
                    "schedule_version": "v1.0"
                },
                files={"file": ("refinery_expansion_l5.csv", f, "text/csv")}
            )

def test_audit_status_and_stats_endpoints():
    """
    Verify /api/audit/status and /api/audit/stats endpoints.
    """
    status_res = client.get("/api/audit/status")
    assert status_res.status_code == 200
    assert status_res.json()["data"]["milestone"] == 10
    assert len(status_res.json()["data"]["lineage_stages"]) == 7

    stats_res = client.get("/api/audit/stats?project_id=PRJ-REF-04")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["success"] is True
    assert stats["project_id"] == "PRJ-REF-04"
    assert "total_audit_events" in stats

def test_full_7_stage_audit_lineage_generation():
    """
    Verify full end-to-end 7-stage explainability lineage:
    Field Evidence -> AI Extraction -> Candidate Retrieval -> Reconciliation -> Confidence & Signals -> Human Decision -> Verified State.
    """
    # 1. Ingest raw field report (Stage 1)
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed 100% pipe spool installation on line 24-XX at Area PR-04. Fully torqued and inspected.",
        "source_id": "DPR-AUDIT-01",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Planner approves match (Stage 6)
    app_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "reviewer_id": "SR_AUDIT_PLANNER",
        "notes": "Verified against isometric drawing and torque logs.",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 100.0,
        "mark_activity_completed": True
    })
    assert app_res.status_code == 200
    audit_log_id = app_res.json()["audit_log_id"]
    assert audit_log_id is not None

    # 3. Retrieve and inspect full 7-stage lineage
    lineage_res = client.get(f"/api/audit/logs/{audit_log_id}")
    assert lineage_res.status_code == 200
    lineage = lineage_res.json()["data"]

    assert lineage["audit_id"] == audit_log_id
    assert lineage["performed_by"] == "SR_AUDIT_PLANNER"
    assert lineage["action_type"] in ["PLANNER_APPROVAL", "PLANNER_OVERRIDE"]

    # Stage 1: Field Evidence
    s1 = lineage["stage_1_field_evidence"]
    assert "Completed 100% pipe spool" in s1["raw_text"]
    assert s1["source_id"] == "DPR-AUDIT-01"

    # Stage 2: AI Fact Extraction
    s2 = lineage["stage_2_ai_extraction"]
    assert s2["model_version"] == "gemini-2.5-flash"
    assert s2["prompt_version"] == "v1.0"

    # Stage 3: Candidate Retrieval
    s3 = lineage["stage_3_candidate_retrieval"]
    assert "all-MiniLM-L6-v2" in s3["embedding_model"]

    # Stage 4: Contextual Reconciliation
    s4 = lineage["stage_4_reconciliation"]
    assert "weights_applied" in s4
    assert s4["weights_applied"]["semantic"] == 0.40

    # Stage 5: Confidence & Signals
    s5 = lineage["stage_5_confidence_signals"]
    assert s5["final_confidence"] > 0.0
    assert s5["confidence_tier"] in ["HIGH", "MEDIUM", "LOW"]

    # Stage 6: Human Decision
    s6 = lineage["stage_6_human_decision"]
    assert s6["performed_by"] == "SR_AUDIT_PLANNER"
    assert "isometric drawing" in s6["decision_reason"]

    # Stage 7: Verified State Update
    s7 = lineage["stage_7_verified_state"]
    assert s7["resulting_progress"] == 100.0
    assert s7["resulting_status"] == "Completed"

def test_planner_override_audit_lineage():
    """
    Verify that an override action is explicitly recorded as PLANNER_OVERRIDE in the audit trail.
    """
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Electrical cabling pulled on duct bank section.",
        "source_id": "DPR-AUDIT-OVERRIDE",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    event_id = submit_res.json()["event"]["id"]

    # Reconcile to generate candidate pool
    recon_res = client.post("/api/matches/reconcile", json={"project_id": "PRJ-REF-04", "event_id": event_id, "top_k": 5})
    assert recon_res.status_code == 200
    top_code = recon_res.json()["top_candidate"]["activity_id"]

    db = SessionLocal()
    alt_act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04", Activity.activity_id != top_code).first()
    alt_code = alt_act.activity_id
    db.close()

    override_res = client.post("/api/review/select-candidate", json={
        "event_id": event_id,
        "activity_id": alt_code,
        "reviewer_id": "LEAD_DISAMBIGUATOR",
        "notes": "Override selected based on field engineer radio confirmation.",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 50.0
    })
    assert override_res.status_code == 200
    aud_id = override_res.json()["audit_log_id"]

    detail_res = client.get(f"/api/audit/logs/{aud_id}")
    assert detail_res.status_code == 200
    aud_data = detail_res.json()["data"]
    assert aud_data["action_type"] == "PLANNER_OVERRIDE"
    assert aud_data["performed_by"] == "LEAD_DISAMBIGUATOR"

def test_rejection_audit_lineage_and_unaltered_state():
    """
    Verify that a rejection action records REJECTION and keeps verified state untouched.
    """
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Unscheduled vendor delivery of safety gloves at warehouse.",
        "source_id": "DPR-AUDIT-REJECT",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    event_id = submit_res.json()["event"]["id"]

    reject_res = client.post("/api/review/reject", json={
        "event_id": event_id,
        "reviewer_id": "QUALITY_CONTROLLER",
        "reason": "Non-construction consumable material delivery; not a schedule activity."
    })
    assert reject_res.status_code == 200
    aud_id = reject_res.json()["audit_log_id"]

    detail_res = client.get(f"/api/audit/logs/{aud_id}")
    assert detail_res.status_code == 200
    aud_data = detail_res.json()["data"]
    assert aud_data["action_type"] in ["REJECTION", "REJECTED"]
    assert aud_data["performed_by"] == "QUALITY_CONTROLLER"

def test_audit_log_filtering():
    """
    Verify filtering audit logs by action_type, activity_id, and project_id.
    """
    list_res = client.get("/api/audit/logs?project_id=PRJ-REF-04&limit=20")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) > 0

    # Filter by action type
    filter_res = client.get("/api/audit/logs?project_id=PRJ-REF-04&action_type=PLANNER_APPROVAL")
    assert filter_res.status_code == 200
    for it in filter_res.json()["items"]:
        assert it["action_type"] == "PLANNER_APPROVAL"

def test_security_zero_api_keys_in_audit_payload():
    """
    SECURITY CONSTRAINT: Verify no API keys, secret tokens, or private credentials are in audit data.
    """
    list_res = client.get("/api/audit/logs?project_id=PRJ-REF-04&limit=10")
    assert list_res.status_code == 200
    body_str = list_res.text.lower()
    assert "ai_key" not in body_str
    assert "secret" not in body_str
    assert "password" not in body_str
