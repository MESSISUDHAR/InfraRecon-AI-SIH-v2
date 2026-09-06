import pytest
import os
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_state import ExecutionState

client = TestClient(app)

TEST_PROJECT_ID = "PRJ-DEP-TEST"

@pytest.fixture(scope="module", autouse=True)
def setup_dependency_test_data():
    """
    Ensures a clean project with the rich L5 schedule containing known dependency chains:
    CIV-L5-088 (Foundation) -> PIP-L5-034 (Spool Install) -> HYD-L5-012 (Hydrotest)
    """
    db: Session = SessionLocal()
    
    proj = db.query(Project).filter(Project.id == TEST_PROJECT_ID).first()
    if not proj:
        proj = Project(
            id=TEST_PROJECT_ID,
            name="Dependency Intelligence Test Project",
            code=TEST_PROJECT_ID,
            active_schedule_version="v1.0"
        )
        db.add(proj)
        db.commit()


    # Upload schedule CSV to TEST_PROJECT_ID
    csv_candidates = [
        "backend/data/refinery_expansion_l5.csv",
        "data/refinery_expansion_l5.csv"
    ]
    csv_path = next((p for p in csv_candidates if os.path.exists(p)), None)
    if csv_path:
        with open(csv_path, "rb") as f:
            res = client.post(
                "/api/schedule/upload",
                data={"project_id": TEST_PROJECT_ID, "schedule_version": "v1.0"},
                files={"file": ("refinery_expansion_l5.csv", f.read(), "text/csv")}
            )
            assert res.status_code == 200

    db.close()
    yield

def test_dependency_status_endpoint():
    """
    Verify dependency intelligence status and non-predictive algorithm disclosure.
    """
    res = client.get("/api/dependencies/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert "Deterministic" in data["engine"]
    assert "None" in data["forecasting_claim"]
    assert "FS" in data["supported_relationship_types"]

def test_dependency_graph_building_from_schedule():
    """
    Verify predecessor and successor relationships are parsed from schedule activities.
    """
    res = client.get(f"/api/dependencies/activity/PIP-L5-034?project_id={TEST_PROJECT_ID}")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["activity_id"] == "PIP-L5-034"
    
    # Predecessor of PIP-L5-034 should include CIV-L5-088
    pred_ids = [p["activity_id"] for p in data["predecessors"]]
    assert "CIV-L5-088" in pred_ids

    # Immediate successors of PIP-L5-034 should include HYD-L5-012
    succ_ids = [s["successor_activity_id"] for s in data["immediate_successors"]]
    assert "HYD-L5-012" in succ_ids

def test_downstream_impact_calculation_on_delayed_activity():
    """
    Verify potential slippage and risk severity calculation when an activity is delayed.
    """
    db = SessionLocal()
    # Set PIP-L5-034 to have a verified completion delay of 4 days
    pip_act = db.query(Activity).filter(Activity.project_id == TEST_PROJECT_ID, Activity.activity_id == "PIP-L5-034").first()
    assert pip_act is not None

    pip_state = db.query(ExecutionState).filter(
        (ExecutionState.activity_id == pip_act.id) | (ExecutionState.activity_id == pip_act.activity_id)
    ).first()

    if not pip_state:
        pip_state = ExecutionState(
            id=f"state_{pip_act.id}",
            project_id=TEST_PROJECT_ID,
            activity_id=pip_act.id,
            actual_progress=100.0,
            status="Completed",
            delay_days=4.0,
            verified_observations_count=1
        )
        db.add(pip_state)
    else:
        pip_state.actual_progress = 100.0
        pip_state.status = "Completed"
        pip_state.delay_days = 4.0
        pip_state.verified_observations_count = max(1, pip_state.verified_observations_count)
    
    db.commit()
    db.close()

    res = client.get(f"/api/dependencies/activity/PIP-L5-034?project_id={TEST_PROJECT_ID}")
    assert res.status_code == 200
    data = res.json()
    assert data["is_delayed"] is True
    assert data["delay_days"] == 4.0
    assert data["total_downstream_at_risk"] >= 1
    assert data["max_downstream_slippage_days"] >= 3.0

    hyd_impact = next((s for s in data["immediate_successors"] if s["successor_activity_id"] == "HYD-L5-012"), None)
    assert hyd_impact is not None
    assert hyd_impact["potential_delay_impact_days"] == 3.0  # 4.0 delay - 1.0 buffer
    assert hyd_impact["risk_severity"] in ("CRITICAL", "HIGH", "MEDIUM")
    assert "PIP-L5-034" in hyd_impact["impact_explanation"]

def test_multi_tier_cascade_traversal():
    """
    Verify multi-tier downstream impact cascade: CIV-L5-088 (Tier 0) -> PIP-L5-034 (Tier 1) -> HYD-L5-012 (Tier 2).
    """
    db = SessionLocal()
    civ_act = db.query(Activity).filter(Activity.project_id == TEST_PROJECT_ID, Activity.activity_id == "CIV-L5-088").first()
    assert civ_act is not None

    civ_state = db.query(ExecutionState).filter(
        (ExecutionState.activity_id == civ_act.id) | (ExecutionState.activity_id == civ_act.activity_id)
    ).first()

    if not civ_state:
        civ_state = ExecutionState(
            id=f"state_{civ_act.id}",
            project_id=TEST_PROJECT_ID,
            activity_id=civ_act.id,
            actual_progress=100.0,
            status="Completed",
            delay_days=5.0,
            verified_observations_count=1
        )
        db.add(civ_state)
    else:
        civ_state.actual_progress = 100.0
        civ_state.status = "Completed"
        civ_state.delay_days = 5.0
        civ_state.verified_observations_count = max(1, civ_state.verified_observations_count)
    db.commit()
    db.close()

    res = client.get(f"/api/dependencies/activity/CIV-L5-088?project_id={TEST_PROJECT_ID}")
    assert res.status_code == 200
    data = res.json()
    assert data["is_delayed"] is True
    
    # Downstream cascade should contain both Tier 1 (PIP-L5-034, CIV-L5-095, MEC-L5-060) and Tier 2 (HYD-L5-012)
    cascade_ids = [c["successor_activity_id"] for c in data["downstream_cascade"]]
    assert "PIP-L5-034" in cascade_ids
    assert "HYD-L5-012" in cascade_ids

    # Tier 1 check: CIV-L5-088 delay 5d, buffer to PIP-L5-034 is 2d -> slippage 3d
    tier1_pip = next(c for c in data["downstream_cascade"] if c["successor_activity_id"] == "PIP-L5-034")
    assert tier1_pip["tier"] == 1
    assert tier1_pip["potential_delay_impact_days"] == 3.0

    # Tier 2 check: PIP-L5-034 incoming 3d, buffer to HYD-L5-012 is 1d -> slippage 2d
    tier2_hyd = next(c for c in data["downstream_cascade"] if c["successor_activity_id"] == "HYD-L5-012")
    assert tier2_hyd["tier"] == 2
    assert tier2_hyd["potential_delay_impact_days"] == 2.0

def test_buffered_successor_handling():
    """
    Verify that when float buffer absorbs a small delay, slippage is 0 and severity is BUFFERED.
    """
    db = SessionLocal()
    # CIV-L5-088 has 2 days buffer to PIP-L5-034. A 1-day delay should be fully absorbed.
    civ_act = db.query(Activity).filter(Activity.project_id == TEST_PROJECT_ID, Activity.activity_id == "CIV-L5-088").first()
    civ_state = db.query(ExecutionState).filter(
        (ExecutionState.activity_id == civ_act.id) | (ExecutionState.activity_id == civ_act.activity_id)
    ).first()
    if civ_state:
        civ_state.delay_days = 1.0  # Delay is 1 day, Buffer is 2 days
        db.commit()
    db.close()

    res = client.get(f"/api/dependencies/activity/CIV-L5-088?project_id={TEST_PROJECT_ID}")
    assert res.status_code == 200
    data = res.json()
    assert data["activity_id"] == "CIV-L5-088"
    
    pip_impact = next(s for s in data["immediate_successors"] if s["successor_activity_id"] == "PIP-L5-034")
    assert pip_impact["potential_delay_impact_days"] == 0.0
    assert pip_impact["risk_severity"] == "BUFFERED"

def test_project_dependency_impact_summary_endpoint():
    """
    Verify project-wide rollup of dependency impact chains.
    """
    db = SessionLocal()
    # Ensure at least one activity has delay with successors
    civ_act = db.query(Activity).filter(Activity.project_id == TEST_PROJECT_ID, Activity.activity_id == "CIV-L5-088").first()
    civ_state = db.query(ExecutionState).filter(
        (ExecutionState.activity_id == civ_act.id) | (ExecutionState.activity_id == civ_act.activity_id)
    ).first()
    if civ_state:
        civ_state.delay_days = 4.0
        db.commit()
    db.close()

    res = client.get(f"/api/dependencies/impact-summary?project_id={TEST_PROJECT_ID}")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["project_id"] == TEST_PROJECT_ID
    assert data["total_dependency_links"] >= 5
    assert data["delayed_activities_with_successors"] >= 1
    assert data["total_downstream_activities_at_risk"] >= 1
    assert len(data["impact_chains"]) >= 1

    top_chain = data["impact_chains"][0]
    assert "source_delayed_activity_id" in top_chain
    assert "path_summary" in top_chain
    assert " → " in top_chain["path_summary"]
    assert top_chain["max_cascade_slippage_days"] > 0
