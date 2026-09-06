import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_dashboard_test_data():
    """
    Ensures a clean, predictable project environment with schedule and execution data.
    """
    db: Session = SessionLocal()
    
    proj = db.query(Project).filter(Project.id == "PRJ-REF-04").first()
    if not proj:
        proj = Project(
            id="PRJ-REF-04",
            name="Refinery Expansion Phase 4",
            description="L5/L6 Intelligent Execution Reconciliation",
            active_schedule_version="v1.0"
        )
        db.add(proj)
        db.commit()

    db.close()
    yield

def test_dashboard_status_endpoint():
    """
    Verify the dashboard status and capability endpoint.
    """
    res = client.get("/api/dashboard/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert data["zero_fabrication"] is True
    assert "supported_charts" in data

def test_dashboard_summary_real_data_calculation():
    """
    Verify that dashboard summary metrics are calculated strictly from the database.
    """
    res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["project_id"] == "PRJ-REF-04"
    assert "kpis" in data

    kpis = data["kpis"]
    assert kpis["total_schedule_activities"] >= 10
    assert kpis["verified_activities"] >= 0
    assert kpis["overall_planned_progress"] >= 0.0
    assert kpis["overall_actual_progress"] >= 0.0
    # Variance is precisely actual - planned
    calculated_var = round(kpis["overall_actual_progress"] - kpis["overall_planned_progress"], 2)
    assert abs(kpis["overall_variance"] - calculated_var) < 0.01

def test_dashboard_s_curve_generation():
    """
    Verify S-curve points generation contains time-series progress data.
    """
    res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert res.status_code == 200
    data = res.json()
    
    s_curve = data["progress_s_curve"]
    assert len(s_curve) >= 2
    for pt in s_curve:
        assert "date" in pt
        assert "planned_cumulative" in pt
        assert "actual_cumulative" in pt
        assert 0.0 <= pt["planned_cumulative"] <= 100.0
        assert 0.0 <= pt["actual_cumulative"] <= 100.0

def test_dashboard_discipline_breakdown():
    """
    Verify discipline-level planned vs actual progress breakdown.
    """
    res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert res.status_code == 200
    data = res.json()

    disciplines = data["discipline_breakdown"]
    assert len(disciplines) > 0
    for disc in disciplines:
        assert "discipline" in disc
        assert disc["total_activities"] > 0
        assert 0.0 <= disc["planned_progress"] <= 100.0
        assert 0.0 <= disc["actual_progress"] <= 100.0
        assert "variance" in disc

def test_dashboard_delayed_activities_and_status_distribution():
    """
    Verify status distribution donut metrics and delayed activities list.
    """
    res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert res.status_code == 200
    data = res.json()

    # Status distribution
    status_dist = data["status_distribution"]
    assert len(status_dist) == 4
    total_pct = sum(s["percentage"] for s in status_dist)
    assert 99.0 <= total_pct <= 101.0  # Should sum to ~100%

    # Delayed activities
    delayed = data["delayed_activities"]
    assert isinstance(delayed, list)
    for item in delayed:
        assert "activity_id" in item
        assert "activity_name" in item
        assert "planned_finish" in item
        assert "actual_progress" in item

def test_dashboard_dynamic_update_after_approval():
    """
    Verify dashboard dynamically updates immediately after planner approves an event.
    """
    # 1. Fetch initial dashboard KPIs
    initial_res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert initial_res.status_code == 200
    initial_kpis = initial_res.json()["kpis"]
    initial_verified = initial_kpis["verified_activities"]
    initial_pending = initial_kpis["pending_reviews"]

    # 2. Ingest a new field report
    ev_res = client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed electrical glanding work on substation feeder panel.",
        "source_id": "DPR-DASH-DYN-01",
        "source_type": "DPR"
    })
    assert ev_res.status_code == 200
    event_id = ev_res.json()["event"]["id"]

    # Dashboard should reflect +1 pending review
    mid_res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert mid_res.status_code == 200
    assert mid_res.json()["kpis"]["pending_reviews"] == initial_pending + 1

    # 3. Reconcile and Approve candidate
    recon_res = client.post("/api/matches/reconcile", json={
        "project_id": "PRJ-REF-04",
        "event_id": event_id,
        "top_k": 3
    })
    assert recon_res.status_code == 200
    top_cand = recon_res.json()["top_candidate"]
    target_act_id = top_cand["activity_id"]

    appr_res = client.post("/api/review/approve", json={
        "event_id": event_id,
        "activity_id": target_act_id,
        "reviewer_id": "LEAD_DASHBOARD_TESTER",
        "progress_mode": "CUMULATIVE_ACTIVITY",
        "override_progress": 75.0,
        "notes": "Dynamic dashboard verification test approval"
    })
    assert appr_res.status_code == 200

    # 4. Fetch updated dashboard summary
    updated_res = client.get("/api/dashboard/summary?project_id=PRJ-REF-04")
    assert updated_res.status_code == 200
    updated_kpis = updated_res.json()["kpis"]

    # Pending reviews should have decremented
    assert updated_kpis["pending_reviews"] == initial_pending
    # Recent transitions should show our approval
    transitions = updated_res.json()["recent_transitions"]
    assert len(transitions) > 0
    assert transitions[0]["performed_by"] == "LEAD_DASHBOARD_TESTER"
    assert transitions[0]["action_type"] in ("PLANNER_APPROVAL", "PLANNER_OVERRIDE")
