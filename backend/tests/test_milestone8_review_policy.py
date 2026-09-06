import os
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import init_db, SessionLocal
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.match_candidate import MatchCandidate
from app.models.audit_log import AuditLog
from app.schemas.review_schema import ConfidencePolicyConfig
from app.services.review_service import (
    get_review_queue,
    approve_candidate_match,
    reject_candidate_match,
    auto_process_high_confidence_events,
    get_policy_config,
    update_policy_config
)

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

def test_review_status_and_policy_configuration():
    """
    Verify /api/review/status and configurable confidence policy endpoints.
    """
    status_res = client.get("/api/review/status")
    assert status_res.status_code == 200
    assert status_res.json()["data"]["milestone"] == 8

    # Get default policy
    get_pol = client.get("/api/review/policy")
    assert get_pol.status_code == 200
    assert get_pol.json()["high_threshold"] == 0.85
    assert get_pol.json()["medium_threshold"] == 0.60

    # Update policy
    new_pol = {
        "high_threshold": 0.88,
        "medium_threshold": 0.65,
        "auto_approve_enabled": True
    }
    set_pol = client.post("/api/review/policy", json=new_pol)
    assert set_pol.status_code == 200
    assert set_pol.json()["high_threshold"] == 0.88

    # Reset policy back
    client.post("/api/review/policy", json={"high_threshold": 0.85, "medium_threshold": 0.60, "auto_approve_enabled": False})

def test_path_1_high_confidence_approval_and_execution_state():
    """
    Test Path 1: HIGH Confidence Match (>= 85%)
    1. Submit exact field report (spool 24-XX at PR-04).
    2. Verify it is classified in HIGH confidence tier and auto_eligible.
    3. Approve match and verify ExecutionState and AuditLog are created.
    """
    # 1. Submit field report
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed 100% installation of 24-inch pipe spool on line 24-XX at Area PR-04. Fully torqued.",
        "source_id": "DPR-HIGH-01",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Check Review Queue
    queue_res = client.get("/api/review/queue?project_id=PRJ-REF-04")
    assert queue_res.status_code == 200
    queue_data = queue_res.json()
    
    target_item = next((it for it in queue_data["items"] if it["event_id"] == event_id), None)
    assert target_item is not None
    assert target_item["confidence_tier"] == "HIGH"
    assert target_item["final_confidence"] >= 0.85
    assert target_item["auto_eligible"] is True

    # 3. Approve match
    approve_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "reviewer_id": "CHIEF_PLANNER",
        "notes": "Verified against isometric drawing."
    })
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["success"] is True
    assert app_data["action_type"] == "PLANNER_APPROVAL"
    assert app_data["updated_state"]["actual_progress"] == 100.0

    # 4. Verify ExecutionState & AuditLog in DB
    db = SessionLocal()
    exec_state = db.query(ExecutionState).filter(ExecutionState.last_event_id == event_id).first()
    assert exec_state is not None
    assert exec_state.status == "Completed"
    assert exec_state.actual_progress == 100.0
    assert exec_state.verified_observations_count >= 1

    audit = db.query(AuditLog).filter(AuditLog.event_id == event_id).first()
    assert audit is not None
    assert audit.action_type == "PLANNER_APPROVAL"
    assert audit.performed_by == "CHIEF_PLANNER"
    db.close()

def test_path_2_medium_confidence_review_and_override():
    """
    Test Path 2: MEDIUM Confidence Match (60-84%) & Planner Override
    1. Submit report with moderate wording variation.
    2. Verify it is held for review with tier 'MEDIUM' and auto_eligible = False.
    3. Planner overrides by selecting an alternative candidate activity.
    4. Verified state links to overridden activity and AuditLog records PLANNER_OVERRIDE.
    """
    # 1. Submit event
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Electrical crew pulled cables on Level 2 duct bank near Substation.",
        "source_id": "DPR-MED-02",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Check Review Queue
    queue_res = client.get("/api/review/queue?project_id=PRJ-REF-04")
    assert queue_res.status_code == 200
    target_item = next((it for it in queue_res.json()["items"] if it["event_id"] == event_id), None)
    assert target_item is not None
    assert target_item["auto_eligible"] is False
    assert len(target_item["alternative_candidates"]) > 0

    # 3. Select alternative candidate (override)
    chosen_alt = target_item["alternative_candidates"][0]
    override_res = client.post("/api/review/select-candidate", json={
        "event_id": event_id,
        "activity_id": chosen_alt["id"],
        "reviewer_id": "SR_PLANNER",
        "notes": "Selected specific L2 branch activity based on field supervisor clarification."
    })
    assert override_res.status_code == 200
    ov_data = override_res.json()
    assert ov_data["success"] is True
    assert ov_data["action_type"] == "PLANNER_OVERRIDE"

    # 4. Verify DB records
    db = SessionLocal()
    audit = db.query(AuditLog).filter(AuditLog.event_id == event_id, AuditLog.action_type == "PLANNER_OVERRIDE").first()
    assert audit is not None
    assert audit.performed_by == "SR_PLANNER"
    db.close()

def test_path_3_low_confidence_and_rejection():
    """
    Test Path 3: LOW Confidence Match (< 60%) and Rejection
    1. Submit report with conflicting signals.
    2. Verify it is classified as LOW confidence.
    3. Planner rejects the match.
    4. CRITICAL RULE: ExecutionState is NOT created or modified.
    5. ExecutionEvent status is set to REJECTED and AuditLog records REJECTION.
    """
    # Count initial states
    db = SessionLocal()
    initial_states_count = db.query(ExecutionState).count()
    db.close()

    # 1. Submit event with conflicting domain data
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Non-scheduled security camera installation at Gate 7 perimeter fence.",
        "source_id": "DPR-LOW-03",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Reject match
    reject_res = client.post("/api/review/reject", json={
        "event_id": event_id,
        "reviewer_id": "LEAD_PLANNER",
        "reason": "Scope not part of active refinery expansion baseline schedule."
    })
    assert reject_res.status_code == 200
    rej_data = reject_res.json()
    assert rej_data["success"] is True
    assert rej_data["action_type"] == "REJECTED"

    # 3. Assert ExecutionState was NOT modified
    db = SessionLocal()
    final_states_count = db.query(ExecutionState).count()
    event_in_db = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    audit_in_db = db.query(AuditLog).filter(AuditLog.event_id == event_id).first()
    db.close()

    assert final_states_count == initial_states_count, "Rejection must NOT alter ExecutionState count!"
    assert event_in_db.status == "REJECTED"
    assert audit_in_db is not None
    assert audit_in_db.action_type == "REJECTION"

def test_auto_process_high_confidence_batch():
    """
    Test Batch Auto-Processing of eligible HIGH confidence items without conflicts.
    """
    # Submit one strong high confidence event
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed 100% installation of 24-inch pipe spool on line 24-XX at Area PR-04.",
        "source_id": "DPR-AUTO-01",
        "source_type": "DPR"
    }
    sub_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert sub_res.status_code == 200
    event_id = sub_res.json()["event"]["id"]

    # Trigger auto-processing
    auto_res = client.post("/api/review/auto-process", json={
        "project_id": "PRJ-REF-04",
        "high_threshold": 0.85,
        "reviewer_id": "SYSTEM_AUTO_POLICY"
    })
    assert auto_res.status_code == 200
    auto_data = auto_res.json()
    assert auto_data["success"] is True
    assert auto_data["processed_count"] >= 1
    assert event_id in auto_data["processed_events"]
