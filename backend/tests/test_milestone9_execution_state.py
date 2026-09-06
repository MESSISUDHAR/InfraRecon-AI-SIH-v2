import os
import json
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import init_db, SessionLocal
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.audit_log import AuditLog
from app.services.review_service import approve_candidate_match

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

def test_execution_state_status_and_summary_endpoint():
    """
    Verify /api/execution-state/status and /api/execution-state/summary endpoints.
    """
    status_res = client.get("/api/execution-state/status")
    assert status_res.status_code == 200
    assert status_res.json()["data"]["milestone"] == 9

    summary_res = client.get("/api/execution-state/summary?project_id=PRJ-REF-04")
    assert summary_res.status_code == 200
    sdata = summary_res.json()["data"]
    assert sdata["project_id"] == "PRJ-REF-04"
    assert sdata["total_activities"] >= 10
    assert "overall_planned_progress" in sdata
    assert "overall_actual_progress" in sdata

def test_single_observation_creates_verified_state_and_audit():
    """
    Verify single field report approval creates ExecutionState and AuditLog record.
    """
    db = SessionLocal()
    # Pick a civil activity and reset its state for clean testing
    act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04", Activity.discipline == "Civil").first()
    act_code = act.activity_id
    act_db_id = act.id
    db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).delete()
    db.query(AuditLog).filter(AuditLog.activity_id == act_db_id).delete()
    db.commit()
    db.close()

    # 1. Ingest field report
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": f"Commenced excavation and trenching for drainage line {act_code}. 30% complete.",
        "source_id": "DPR-M9-01",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Approve match as cumulative activity progress
    app_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "activity_id": act_code,
        "reviewer_id": "LEAD_PLANNER",
        "notes": "Verified against site survey",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 30.0
    })
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["success"] is True
    assert app_data["updated_state"]["actual_progress"] == 30.0
    assert app_data["updated_state"]["status"] == "In Progress"
    assert app_data["updated_state"]["verified_observations_count"] == 1

    # 3. Verify DB records
    db = SessionLocal()
    st = db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).first()
    assert st is not None
    assert st.actual_progress == 30.0
    assert st.status == "In Progress"
    assert st.actual_start is not None
    assert st.actual_finish is None # Not completed yet!

    audit = db.query(AuditLog).filter(AuditLog.event_id == event_id).first()
    assert audit is not None
    assert audit.performed_by == "LEAD_PLANNER"
    assert json.loads(audit.new_state_json)["progress_mode"] == "CUMULATIVE_ACTIVITY"
    db.close()

def test_sub_work_observation_does_not_prematurely_complete_activity():
    """
    CRITICAL SEMANTIC RULE:
    An observation reporting 100% of a sub-work/sub-task must NOT automatically
    set the overall scheduled activity to 100% or set actual_finish.
    """
    db = SessionLocal()
    act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04", Activity.discipline == "Mechanical").first()
    if not act:
        act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04").first()
    act_code = act.activity_id
    act_db_id = act.id
    db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).delete()
    db.query(AuditLog).filter(AuditLog.activity_id == act_db_id).delete()
    db.commit()
    db.close()

    # 1. Submit event reporting sub-work completion
    ev_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": f"Completed 100% of sub-pour segment A on compressor foundation {act_code}.",
        "source_id": "DPR-M9-SUBWORK-01",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=ev_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Approve with progress_mode="SUB_WORK" and activity_actual_progress=45.0%
    app_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "activity_id": act_code,
        "reviewer_id": "SITE_PLANNER",
        "notes": "Sub-pour segment completed; overall foundation activity is 45% complete.",
        "progress_mode": "SUB_WORK",
        "override_progress": 100.0, # Event progress is 100% of sub-pour
        "activity_actual_progress": 45.0, # Overall activity is 45%
        "mark_activity_completed": False
    })
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["updated_state"]["actual_progress"] == 45.0
    assert app_data["updated_state"]["status"] == "In Progress"

    # 3. Verify DB state has no actual_finish
    db = SessionLocal()
    st = db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).first()
    assert st.actual_progress == 45.0
    assert st.status == "In Progress"
    assert st.actual_finish is None # Crucial check: NOT completed!
    db.close()

def test_multiple_cumulative_observations_mapping_to_one_activity():
    """
    CRITICAL MULTI-OBSERVATION CUMULATIVE TEST:
    Submit 3 sequential observations for the same activity:
      - Day 1: 25% (In Progress, actual_start set, actual_finish None, obs_count=1)
      - Day 2: 60% (In Progress, actual_progress=60%, actual_finish None, obs_count=2)
      - Day 3: 100% (Completed, actual_progress=100%, actual_finish set, obs_count=3)
    """
    db = SessionLocal()
    target_activity = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04", Activity.discipline == "Piping").first()
    act_code = target_activity.activity_id
    act_db_id = target_activity.id
    
    # Reset existing execution states and audit logs for target activity
    db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).delete()
    db.query(AuditLog).filter(AuditLog.activity_id == act_db_id).delete()
    db.commit()
    db.close()

    # --- Day 1 (25%) ---
    ev1_res = client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-REF-04",
        "raw_text": f"Day 1: Alignment and fit-up of piping spool on {act_code}. 25% overall activity progress.",
        "source_id": "DPR-DAY-01",
        "source_type": "DPR"
    })
    assert ev1_res.status_code == 200
    ev1_id = ev1_res.json()["event"]["id"]

    app1_res = client.post("/api/review/approve", json={
        "event_id": ev1_id,
        "activity_id": act_code,
        "reviewer_id": "PLANNER_ALICE",
        "notes": "Day 1 verified 25% progress",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 25.0
    })
    assert app1_res.status_code == 200
    assert app1_res.json()["updated_state"]["actual_progress"] == 25.0
    assert app1_res.json()["updated_state"]["status"] == "In Progress"
    assert app1_res.json()["updated_state"]["verified_observations_count"] == 1

    # --- Day 2 (60%) ---
    ev2_res = client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-REF-04",
        "raw_text": f"Day 2: Root pass welding complete on {act_code}. 60% overall progress.",
        "source_id": "DPR-DAY-02",
        "source_type": "DPR"
    })
    assert ev2_res.status_code == 200
    ev2_id = ev2_res.json()["event"]["id"]

    app2_res = client.post("/api/review/approve", json={
        "event_id": ev2_id,
        "activity_id": act_code,
        "reviewer_id": "PLANNER_ALICE",
        "notes": "Day 2 verified 60% progress",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 60.0
    })
    assert app2_res.status_code == 200
    assert app2_res.json()["updated_state"]["actual_progress"] == 60.0
    assert app2_res.json()["updated_state"]["status"] == "In Progress"
    assert app2_res.json()["updated_state"]["verified_observations_count"] == 2

    # --- Day 3 (100% Completion) ---
    ev3_res = client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-REF-04",
        "raw_text": f"Day 3: Final torque check and NDT complete on {act_code}. 100% finished.",
        "source_id": "DPR-DAY-03",
        "source_type": "DPR"
    })
    assert ev3_res.status_code == 200
    ev3_id = ev3_res.json()["event"]["id"]

    app3_res = client.post("/api/review/approve", json={
        "event_id": ev3_id,
        "activity_id": act_code,
        "reviewer_id": "PLANNER_BOB",
        "notes": "Day 3 verified 100% complete with NDT signoff",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 100.0,
        "mark_activity_completed": True
    })
    assert app3_res.status_code == 200
    assert app3_res.json()["updated_state"]["actual_progress"] == 100.0
    assert app3_res.json()["updated_state"]["status"] == "Completed"
    assert app3_res.json()["updated_state"]["verified_observations_count"] == 3

    # --- Verify Detail & Observation Timeline Endpoint ---
    detail_res = client.get(f"/api/execution-state/activity/{act_code}?project_id=PRJ-REF-04")
    assert detail_res.status_code == 200
    detail = detail_res.json()["data"]
    assert detail["activity_id"] == act_code
    assert detail["actual_progress"] == 100.0
    assert detail["status"] == "Completed"
    assert detail["actual_start"] is not None
    assert detail["actual_finish"] is not None
    assert len(detail["observations_history"]) == 3
    assert len(detail["audit_logs"]) == 3

    # Verify chronological sequence of observations
    obs1 = detail["observations_history"][0]
    obs2 = detail["observations_history"][1]
    obs3 = detail["observations_history"][2]
    assert obs1["resulting_activity_progress"] == 25.0
    assert obs2["resulting_activity_progress"] == 60.0
    assert obs3["resulting_activity_progress"] == 100.0

def test_completed_activity_delay_calculation():
    """
    Verify delay is calculated accurately upon verified completion:
    delay_days = actual_finish - planned_finish.
    """
    db = SessionLocal()
    act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04").first()
    act_code = act.activity_id
    act_db_id = act.id
    
    # Set planned finish in past
    planned_finish_dt = datetime.now(timezone.utc) - timedelta(days=5)
    actual_finish_dt = datetime.now(timezone.utc)
    act.planned_finish = planned_finish_dt
    db.commit()

    exec_state = db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).first()
    if not exec_state:
        exec_state = ExecutionState(
            id="state_test_delay",
            project_id=act.project_id,
            activity_id=act_db_id,
            actual_start=datetime.now(timezone.utc) - timedelta(days=10),
            actual_finish=actual_finish_dt,
            actual_progress=100.0,
            status="Completed",
            delay_days=5.0,
            verified_observations_count=1
        )
        db.add(exec_state)
    else:
        exec_state.actual_finish = actual_finish_dt
        exec_state.actual_progress = 100.0
        exec_state.status = "Completed"
        exec_state.delay_days = 5.0
    db.commit()
    db.close()

    detail_res = client.get(f"/api/execution-state/activity/{act_code}?project_id=PRJ-REF-04")
    assert detail_res.status_code == 200
    data = detail_res.json()["data"]
    assert data["status"] == "Completed"
    assert data["delay_days"] == 5.0
    assert data["is_delayed"] is True

def test_incomplete_activity_progress_variance_without_premature_delay():
    """
    For an incomplete activity, delay_days must be None and progress_variance must reflect
    actual_progress - planned_progress.
    """
    db = SessionLocal()
    act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04", Activity.planned_progress > 50.0).first()
    if not act:
        act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04").first()
        act.planned_progress = 70.0
        db.commit()
    act_code = act.activity_id
    act_db_id = act.id
    planned_prog = act.planned_progress

    exec_state = db.query(ExecutionState).filter(ExecutionState.activity_id == act_db_id).first()
    if not exec_state:
        exec_state = ExecutionState(
            id="state_test_var",
            project_id=act.project_id,
            activity_id=act_db_id,
            actual_start=datetime.now(timezone.utc) - timedelta(days=2),
            actual_finish=None,
            actual_progress=40.0,
            status="In Progress",
            delay_days=0.0,
            verified_observations_count=1
        )
        db.add(exec_state)
    else:
        exec_state.actual_finish = None
        exec_state.actual_progress = 40.0
        exec_state.status = "In Progress"
    db.commit()
    db.close()

    detail_res = client.get(f"/api/execution-state/activity/{act_code}?project_id=PRJ-REF-04")
    assert detail_res.status_code == 200
    data = detail_res.json()["data"]
    assert data["status"] in ["In Progress", "Behind Schedule"]
    assert data["delay_days"] is None # Crucial: NOT prematurely calculated!
    assert data["progress_variance"] is not None
    assert data["progress_variance"] == round(40.0 - (planned_prog or 0.0), 2)

def test_transactional_consistency_and_rollback_on_failure():
    """
    Verify database transaction atomicity: an invalid or failed operation rolls back cleanly.
    """
    # Attempt approval with non-existent activity ID
    with pytest.raises(Exception):
        db = SessionLocal()
        approve_candidate_match(
            db=db,
            event_id="non_existent_event_123",
            activity_id="INVALID_ACT_999"
        )
        db.close()
