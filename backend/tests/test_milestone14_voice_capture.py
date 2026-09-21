import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import Base, SessionLocal, init_db
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.audit_log import AuditLog
from app.services.embedding_service import generate_embedding
from app.services.review_service import approve_candidate_match
from app.services.historical_memory_service import search_historical_memory

client = TestClient(app)

@pytest.fixture
def db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_voice_event_ingestion_and_source_type(db_session: Session):
    """
    1. Test voice event ingestion via POST /api/execution-events/submit with source_type='VOICE'.
    Verify source_id generation with VOICE- prefix, source_type persistence, and INGESTED status.
    """
    # Create test project
    prj = db_session.query(Project).filter(Project.id == "PRJ-VOICE-01").first()
    if not prj:
        prj = Project(id="PRJ-VOICE-01", name="Voice Terminal Expansion", code="PRJ-VOICE-01")
        db_session.add(prj)
        db_session.commit()

    voice_payload = {
        "project_id": "PRJ-VOICE-01",
        "raw_text": "Yesterday we completed alignment of pump P-101. Work is being checked by the supervisor.",
        "source_type": "VOICE",
        "reporter_name": "Supervisor Sharma (Voice)"
    }

    res = client.post("/api/execution-events/submit", json=voice_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    event = data["event"]
    assert event["source_type"] == "VOICE"
    assert event["source_id"].startswith("VOICE-")
    assert event["status"] == "INGESTED"
    assert "alignment of pump P-101" in event["raw_text"]

def test_voice_event_structured_extraction(db_session: Session):
    """
    2. Test structured fact extraction from voice transcript text.
    Validates grounded entities (Mechanical discipline, P-101 equipment tag, 100% completion progress).
    """
    prj = db_session.query(Project).filter(Project.id == "PRJ-VOICE-01").first()
    if not prj:
        prj = Project(id="PRJ-VOICE-01", name="Voice Terminal Expansion", code="PRJ-VOICE-01")
        db_session.add(prj)
        db_session.commit()

    extract_payload = {
        "project_id": "PRJ-VOICE-01",
        "raw_text": "Yesterday we completed alignment of pump P-101. Work is being checked by the supervisor.",
        "source_type": "VOICE",
        "reporter_name": "Supervisor Sharma (Voice)",
        "save_to_db": True
    }

    res = client.post("/api/execution-events/extract", json=extract_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["extracted_data"]["discipline"] == "Mechanical"
    assert data["extracted_data"]["asset_id"] == "P-101"
    assert data["extracted_data"]["progress"] == 100.0
    assert data["extracted_data"]["event_type"] == "completion"
    assert data["event"]["source_type"] == "VOICE"
    assert data["event"]["status"] == "EXTRACTED"

def test_voice_reconciliation_and_planner_approval_flow(db_session: Session):
    """
    3. Test complete lifecycle: Voice capture -> Reconciliation against schedule -> Planner approval -> VERIFIED ExecutionState.
    """
    prj_id = "PRJ-VOICE-E2E"
    prj = db_session.query(Project).filter(Project.id == prj_id).first()
    if not prj:
        prj = Project(id=prj_id, name="Pump Station Hydrocarbon Line", code=prj_id)
        db_session.add(prj)
        db_session.commit()

    # Seed an activity for pump alignment
    act = db_session.query(Activity).filter(Activity.id == "ACT-PUMP-101").first()
    if not act:
        act = Activity(
            id="ACT-PUMP-101",
            activity_id="ACT-PUMP-101",
            project_id=prj_id,
            activity_name="Centrifugal Pump P-101 Alignment & Dial Check",
            wbs_code="1.4.2",
            wbs_name="Mechanical Equipment Installation",
            discipline="Mechanical",
            location="Pump House Bay 1",
            asset_id="P-101",
            planned_start=datetime.now(timezone.utc),
            planned_finish=datetime.now(timezone.utc),
            planned_duration=5,
            planned_progress=100.0,
            searchable_text="Centrifugal Pump P-101 Alignment & Dial Check Mechanical Pump House Bay 1 P-101",
            embedding=generate_embedding("Centrifugal Pump P-101 Alignment & Dial Check Mechanical Pump House Bay 1 P-101"),
            embedding_json=json.dumps(generate_embedding("Centrifugal Pump P-101 Alignment & Dial Check Mechanical Pump House Bay 1 P-101"))
        )
        db_session.add(act)
        db_session.commit()

    # Ingest and extract voice event
    extract_payload = {
        "project_id": prj_id,
        "source_id": "VOICE-20260921-01",
        "raw_text": "Yesterday we completed alignment of pump P-101. Work is being checked by the supervisor.",
        "source_type": "VOICE",
        "reporter_name": "Lead Supervisor Sharma (Voice)",
        "save_to_db": True
    }
    extract_res = client.post("/api/execution-events/extract", json=extract_payload)
    assert extract_res.status_code == 200
    event_id = extract_res.json()["event"]["id"]

    # Reconcile candidates
    recon_res = client.post("/api/matches/reconcile", json={"event_id": event_id, "project_id": prj_id})
    assert recon_res.status_code == 200
    recon_data = recon_res.json()
    assert recon_data["top_candidate"] is not None
    top_candidate = recon_data["top_candidate"]
    assert top_candidate["activity_id"] == "ACT-PUMP-101"

    # Planner approves candidate match via API
    approve_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "activity_id": "ACT-PUMP-101",
        "reviewer_id": "PLANNER_LEAD",
        "notes": "Approved field voice recording. Alignment verified with QC.",
        "override_progress": 100.0,
        "mark_activity_completed": True
    })
    assert approve_res.status_code == 200, approve_res.text
    approve_data = approve_res.json()
    assert approve_data["success"] is True

    # Check ExecutionEvent updated to VERIFIED
    ev = db_session.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    assert ev is not None
    assert ev.status == "VERIFIED"
    assert ev.source_type == "VOICE"

    # Check ExecutionState updated
    st = db_session.query(ExecutionState).filter(ExecutionState.activity_id == "ACT-PUMP-101").first()
    assert st is not None
    assert st.actual_progress == 100.0
    assert st.status == "Completed"

    # Check AuditLog recorded
    audit = db_session.query(AuditLog).filter(AuditLog.activity_id == "ACT-PUMP-101").first()
    assert audit is not None
    assert audit.action_type in ["PLANNER_APPROVAL", "PLANNER_OVERRIDE"]

def test_voice_event_in_historical_memory_lifecycle(db_session: Session):
    """
    4. Test that once approved, the verified voice event is discoverable in Institutional Memory via API search.
    """
    res = client.post("/api/historical-memory/search", json={
        "project_id": "PRJ-VOICE-E2E",
        "raw_text": "Yesterday we completed alignment of pump P-101",
        "discipline": "Mechanical",
        "top_k": 10,
        "min_similarity": 0.20
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["total_results"] >= 1
    matched_ids = [m["activity_id"] for m in data["results"]]
    assert "ACT-PUMP-101" in matched_ids
    voice_match = next((m for m in data["results"] if m["activity_id"] == "ACT-PUMP-101"), None)
    assert voice_match is not None
    assert voice_match["actual_progress"] == 100.0
    assert voice_match["verification_status"] == "VERIFIED"

def test_voice_filter_endpoint(db_session: Session):
    """
    5. Test GET /api/execution-events?source_type=VOICE endpoint filtering.
    """
    res = client.get("/api/execution-events?project_id=PRJ-VOICE-01&source_type=VOICE")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert all(ev["source_type"] == "VOICE" for ev in data["events"])
