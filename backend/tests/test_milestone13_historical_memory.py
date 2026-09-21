import json
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, init_db, is_postgresql
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.match_candidate import MatchCandidate
from app.models.audit_log import AuditLog
from app.services.embedding_service import generate_embedding
from app.services.review_service import approve_candidate_match, reject_candidate_match
from app.services.historical_memory_service import (
    search_historical_memory,
    get_historical_memory_stats,
    seed_demo_historical_memory
)
from app.schemas.historical_memory_schema import HistoricalMemorySearchRequest

@pytest.fixture
def db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_seed_demo_historical_memory_creates_verified_records(db_session: Session):
    """
    1. Verify deterministic seeding produces genuine VERIFIED historical events,
    activities, execution states, and audit logs across multiple projects.
    """
    count = seed_demo_historical_memory(db_session)
    assert count >= 6

    # Verify Project Alpha and Beta records exist and have VERIFIED status
    alpha_events = db_session.query(ExecutionEvent).filter(
        ExecutionEvent.project_id == "PRJ-ALPHA",
        ExecutionEvent.status == "VERIFIED"
    ).all()
    assert len(alpha_events) >= 3

    beta_events = db_session.query(ExecutionEvent).filter(
        ExecutionEvent.project_id == "PRJ-BETA",
        ExecutionEvent.status == "VERIFIED"
    ).all()
    assert len(beta_events) >= 3

    for ev in alpha_events + beta_events:
        assert ev.status == "VERIFIED"
        assert ev.activity_description is not None
        assert ev.embedding_json is not None

def test_only_verified_events_enter_institutional_memory(db_session: Session):
    """
    2. Crucial Gate Rule: Unverified (INGESTED, EXTRACTED, PENDING_REVIEW)
    and REJECTED events are strictly excluded from institutional memory.
    """
    project_id = "PRJ-TEST-GATE"
    proj = Project(id=project_id, name="Gate Test Project", code=project_id)
    db_session.merge(proj)

    now = datetime.now(timezone.utc)
    
    # 1. Draft/Ingested Event
    ev_draft = ExecutionEvent(
        id="EV-TEST-DRAFT-01",
        project_id=project_id,
        raw_text="Rough turbine alignment in progress",
        activity_description="Rough turbine alignment",
        discipline="Mechanical",
        status="INGESTED",
        report_date=now
    )
    # 2. Extracted/Pending Event
    ev_pending = ExecutionEvent(
        id="EV-TEST-PENDING-02",
        project_id=project_id,
        raw_text="Turbine alignment completed by contractor",
        activity_description="Turbine alignment",
        discipline="Mechanical",
        status="PENDING_REVIEW",
        report_date=now
    )
    # 3. Rejected Event
    ev_rejected = ExecutionEvent(
        id="EV-TEST-REJECTED-03",
        project_id=project_id,
        raw_text="Turbine alignment rejected due to wrong location",
        activity_description="Turbine alignment",
        discipline="Mechanical",
        status="REJECTED",
        report_date=now
    )
    # 4. Verified Event
    emb = generate_embedding("Turbine shaft laser alignment and runout check Mechanical")
    ev_verified = ExecutionEvent(
        id="EV-TEST-VERIFIED-04",
        project_id=project_id,
        raw_text="Verified turbine shaft laser alignment and runout check passed.",
        activity_description="Turbine shaft laser alignment",
        discipline="Mechanical",
        status="VERIFIED",
        report_date=now,
        embedding=emb,
        embedding_json=json.dumps(emb)
    )

    db_session.merge(ev_draft)
    db_session.merge(ev_pending)
    db_session.merge(ev_rejected)
    db_session.merge(ev_verified)
    db_session.commit()

    # Search historical memory for turbine alignment
    res = search_historical_memory(
        db=db_session,
        raw_text="Turbine shaft alignment work",
        extracted_facts={"activity_description": "Turbine shaft alignment", "discipline": "Mechanical"},
        min_similarity=0.40
    )

    retrieved_ids = [r.historical_event_id for r in res.results]
    assert "EV-TEST-VERIFIED-04" in retrieved_ids
    assert "EV-TEST-DRAFT-01" not in retrieved_ids
    assert "EV-TEST-PENDING-02" not in retrieved_ids
    assert "EV-TEST-REJECTED-03" not in retrieved_ids

def test_current_event_excluded_from_its_own_results(db_session: Session):
    """
    3. Verify current event is strictly excluded from its own historical retrieval results.
    """
    seed_demo_historical_memory(db_session)

    # Use existing HIST-EV-ALPHA-01 as query event_id
    res = search_historical_memory(
        db=db_session,
        event_id="HIST-EV-ALPHA-01",
        top_k=5,
        min_similarity=0.40
    )

    retrieved_ids = [r.historical_event_id for r in res.results]
    assert "HIST-EV-ALPHA-01" not in retrieved_ids

def test_historical_similarity_retrieval_ranking_and_top_k(db_session: Session):
    """
    4. Verify semantic similarity ranking, Top-K constraint, and explainable signals.
    """
    seed_demo_historical_memory(db_session)

    # Search for pump alignment
    res = search_historical_memory(
        db=db_session,
        raw_text="Centrifugal pump alignment and dial gauge runout check in Pump House",
        extracted_facts={
            "activity_description": "Centrifugal pump alignment and runout",
            "discipline": "Mechanical",
            "location": "Pump House Bay 1",
            "asset_id": "P-101A"
        },
        top_k=2,
        min_similarity=0.50
    )

    assert res.success is True
    assert len(res.results) <= 2
    assert len(res.results) > 0

    top_result = res.results[0]
    assert top_result.similarity >= 0.70
    assert top_result.discipline == "Mechanical"
    assert top_result.verification_status == "VERIFIED"
    assert len(top_result.matched_signals) > 0

    # Ensure descending rank order
    if len(res.results) > 1:
        assert res.results[0].similarity >= res.results[1].similarity

def test_clean_no_results_handling(db_session: Session):
    """
    5. Verify clean handling when no relevant history exists.
    """
    res = search_historical_memory(
        db=db_session,
        raw_text="Quantum nuclear particle accelerator cryo-magnet calibration in deep underground cavern",
        extracted_facts={"discipline": "Cryogenics", "location": "Sub-Basement 99"},
        min_similarity=0.85
    )

    assert res.success is True
    assert res.total_results == 0
    assert len(res.results) == 0
    assert res.message == "No relevant verified historical evidence found."

def test_descriptive_historical_delay_summary(db_session: Session):
    """
    6. Verify descriptive delay pattern summary without predictive AI.
    """
    seed_demo_historical_memory(db_session)

    # HIST-EV-ALPHA-01 has a recorded delay ("Alignment rework and soft foot correction")
    res = search_historical_memory(
        db=db_session,
        raw_text="Centrifugal pump alignment and dial indicator inspection",
        extracted_facts={"discipline": "Mechanical", "asset_id": "P-101A"},
        top_k=4,
        min_similarity=0.50
    )

    assert res.success is True
    if len(res.results) > 0:
        assert res.historical_delay_summary is not None
        assert "Historical pattern:" in res.historical_delay_summary
        assert "probability" not in res.historical_delay_summary.lower()
        assert "chance" not in res.historical_delay_summary.lower()

def test_missing_metadata_evaluated_neutrally(db_session: Session):
    """
    7. Verify missing fields in query or history are evaluated neutrally (no crashes or false rejections).
    """
    seed_demo_historical_memory(db_session)

    # Empty query facts with minimal raw text
    res = search_historical_memory(
        db=db_session,
        raw_text="Pipe welding",
        extracted_facts={},
        min_similarity=0.30
    )

    assert res.success is True
    assert isinstance(res.results, list)

def test_historical_memory_stats_aggregation(db_session: Session):
    """
    8. Verify real DB aggregation for leadership metrics.
    """
    seed_demo_historical_memory(db_session)

    stats = get_historical_memory_stats(db_session)
    assert stats.success is True
    assert stats.total_verified_historical_events >= 6
    assert stats.projects_count >= 2
    assert stats.disciplines_count >= 3
    assert stats.verified_events_with_delays > 0
    assert stats.delay_incidence_rate > 0.0
    assert len(stats.top_delay_reasons) > 0

def test_approval_promotes_event_to_searchable_historical_memory(db_session: Session):
    """
    9. End-to-end Verification: When a planner approves a candidate match,
    the event enters VERIFIED state and becomes immediately retrievable in institutional memory.
    """
    project_id = "PRJ-E2E-PROMO"
    proj = Project(id=project_id, name="E2E Promo Project", code=project_id, active_schedule_version="v1.0")
    db_session.merge(proj)

    emb_act = generate_embedding("Substation Transformer TR-99 Foundation Concrete Pouring Civil")
    act = Activity(
        id=f"{project_id}_v1.0_CIV-TR-99",
        project_id=project_id,
        schedule_version="v1.0",
        activity_id="CIV-TR-99",
        activity_name="Substation Transformer TR-99 Foundation Concrete Pouring",
        discipline="Civil",
        location="Substation Yard",
        asset_id="TR-99",
        planned_duration=3.0,
        searchable_text="Activity: Substation Transformer TR-99 Foundation | Discipline: Civil",
        embedding=emb_act,
        embedding_json=json.dumps(emb_act)
    )
    db_session.merge(act)

    now = datetime.now(timezone.utc)
    ev = ExecutionEvent(
        id="EV-E2E-NEW-01",
        project_id=project_id,
        raw_text="Completed concrete pouring for transformer foundation TR-99 yesterday without delays.",
        activity_description="Transformer foundation concrete pouring",
        discipline="Civil",
        location="Substation Yard",
        asset_id="TR-99",
        event_progress=100.0,
        event_type="completion",
        actual_start=now - timedelta(days=2),
        actual_finish=now,
        status="PENDING_REVIEW",
        report_date=now
    )
    db_session.merge(ev)
    db_session.commit()

    # 1. Before approval: event is PENDING_REVIEW -> MUST NOT be in historical memory
    res_before = search_historical_memory(
        db=db_session,
        raw_text="Transformer foundation concrete pouring",
        extracted_facts={"discipline": "Civil", "asset_id": "TR-99"},
        min_similarity=0.50
    )
    assert "EV-E2E-NEW-01" not in [r.historical_event_id for r in res_before.results]

    # 2. Planner approves event
    action_res = approve_candidate_match(
        db=db_session,
        event_id="EV-E2E-NEW-01",
        activity_id=act.id,
        reviewer_id="PLANNER_CHIEF",
        notes="Validated transformer foundation completion"
    )
    assert action_res.success is True

    # 3. After approval: event is VERIFIED -> MUST BE RETRIEVABLE in institutional memory
    res_after = search_historical_memory(
        db=db_session,
        raw_text="Transformer foundation concrete pouring",
        extracted_facts={"discipline": "Civil", "asset_id": "TR-99"},
        min_similarity=0.50
    )
    retrieved_after_ids = [r.historical_event_id for r in res_after.results]
    assert "EV-E2E-NEW-01" in retrieved_after_ids

    # Check that provenance is preserved
    found_item = next(r for r in res_after.results if r.historical_event_id == "EV-E2E-NEW-01")
    assert found_item.project_id == project_id
    assert found_item.discipline == "Civil"
    assert found_item.verification_status == "VERIFIED"
    assert found_item.actual_progress == 100.0
    assert found_item.duration_days == 2.0
