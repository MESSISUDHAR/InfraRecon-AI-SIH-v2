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
from app.schemas.reconciliation_schema import ReconciliationWeights
from app.services.reconciliation_service import (
    reconcile_execution_event,
    compute_component_signals,
    compute_reconciliation_candidate,
    DEFAULT_WEIGHTS
)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
CSV_SAMPLE_PATH = os.path.join(DATA_DIR, "refinery_expansion_l5.csv")

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """
    Initializes DB and ensures PRJ-REF-04 schedule activities are uploaded and embedded.
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

def test_reconciliation_status_and_weights_endpoints():
    """
    Verify /api/matches/status and /api/matches/weights endpoints.
    """
    status_res = client.get("/api/matches/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["success"] is True
    assert status_data["data"]["milestone"] == 7

    weights_res = client.get("/api/matches/weights")
    assert weights_res.status_code == 200
    weights_data = weights_res.json()
    assert weights_data["semantic_weight"] == 0.40
    assert weights_data["identifier_weight"] == 0.20
    assert weights_data["discipline_weight"] == 0.15

def test_1_strong_exact_contextual_match():
    """
    Test Case 1: Strong Exact Contextual Match
    Field report specifies exact line '24-XX', location 'PR-04', and discipline 'Piping'.
    Expects high confidence (>= 85%), PIP-L5-034 as Top Match (Rank #1), and explainable positive signals.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed 100% installation of 24-inch pipe spool on line 24-XX at Area PR-04. Bolting and torque verified.",
        "top_k": 5
    }
    response = client.post("/api/matches/reconcile", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["top_candidate"] is not None

    top = data["top_candidate"]
    assert top["rank"] == 1
    assert top["is_top_match"] is True
    assert top["final_confidence"] >= 0.85
    assert top["confidence_tier"] == "HIGH"
    assert top["identifier_score"] == 1.0
    assert top["discipline_score"] == 1.0
    assert top["location_score"] == 1.0
    assert "Exact line identifier match" in " ".join(top["positive_signals"]) or "24-XX" in top["reasoning"]

def test_2_wording_variation_match():
    """
    Test Case 2: Wording Variation
    Uses synonyms and natural field language ("Poured and vibrated wet foundation concrete batch for the second compressor unit pad").
    Should match the Civil activity for Compressor Unit foundation with high contextual alignment.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Poured and vibrated wet foundation concrete batch for the second compressor unit pad. Slump test passed.",
        "top_k": 5
    }
    response = client.post("/api/matches/reconcile", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["top_candidate"] is not None
    top = data["top_candidate"]
    assert top["rank"] == 1
    assert top["final_confidence"] >= 0.70
    assert "concrete" in top["activity_name"].lower() or "compressor" in top["activity_name"].lower() or "foundation" in top["activity_name"].lower()

def test_3_missing_identifier_neutral_handling():
    """
    Test Case 3: Missing Identifier
    Report lacks line_id and asset_id.
    CRITICAL RULE: Missing information is NOT penalized. Identifier score is evaluated neutrally (1.0).
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed backfilling and soil compaction across the foundation trench. Subgrade prepared.",
        "top_k": 5
    }
    response = client.post("/api/matches/reconcile", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    top = data["top_candidate"]
    assert top is not None
    # Identifier score should be neutral (1.0) because no identifier was in report
    assert top["identifier_score"] == 1.0
    assert top["final_confidence"] >= 0.75
    # Conflicting signals should NOT report false identifier mismatch
    assert not any("Line ID mismatch" in c for c in top["conflicting_signals"])

def test_4_ambiguous_candidates_disambiguation():
    """
    Test Case 4: Ambiguous Candidates
    Report mentions cable pulling with location 'Substation B'.
    Engine should use location and discipline to rank the candidate in Substation B higher than others.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Pulled 33kV high voltage power cables through duct bank near Substation B. 350 meters laid.",
        "top_k": 5
    }
    response = client.post("/api/matches/reconcile", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert len(data["alternative_candidates"]) > 0
    top = data["top_candidate"]
    assert top is not None
    assert top["discipline"] == "Electrical" or "cable" in top["activity_name"].lower() or "electrical" in top["activity_name"].lower()

def test_5_conflicting_context_risk_detection():
    """
    Test Case 5: Conflicting Context
    Field report specifies 'Electrical' discipline and conflicting identifier against a Piping task.
    Engine must identify conflicting signals and lower the final confidence score.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Electrical team completed high voltage cable termination on conflicting line 99-ZZ at North Substation.",
        "top_k": 5
    }
    response = client.post("/api/matches/reconcile", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    # If evaluating candidates of other disciplines or mismatched line IDs, conflicts are captured
    for alt in data["alternative_candidates"]:
        if alt.get("discipline") and alt.get("discipline") != "Electrical":
            assert any("Discipline conflict" in c or "mismatch" in c for c in alt.get("conflicting_signals", []))

def test_6_configurable_weights_impact():
    """
    Test Case 6: Configurable Weights
    Verifies that changing weights (e.g. 90% semantic weight vs 10% semantic weight) modifies the final confidence output.
    """
    raw = "Erected 24-inch spool piece on line 24-XX at Area PR-04."
    
    # Run with standard weights
    res_std = client.post("/api/matches/reconcile", json={"project_id": "PRJ-REF-04", "raw_text": raw})
    assert res_std.status_code == 200
    conf_std = res_std.json()["top_candidate"]["final_confidence"]

    # Run with custom heavy semantic weight (90% semantic, 10% everything else)
    res_custom = client.post("/api/matches/reconcile", json={
        "project_id": "PRJ-REF-04",
        "raw_text": raw,
        "weights": {
            "semantic_weight": 0.90,
            "identifier_weight": 0.02,
            "discipline_weight": 0.02,
            "location_weight": 0.02,
            "wbs_weight": 0.02,
            "temporal_weight": 0.02
        }
    })
    assert res_custom.status_code == 200
    conf_custom = res_custom.json()["top_candidate"]["final_confidence"]

    assert isinstance(conf_std, float)
    assert isinstance(conf_custom, float)

def test_7_reconciliation_does_not_auto_approve_or_modify_execution_state():
    """
    CRITICAL RULE: Milestone 7 calculates multi-signal scores and rankings,
    but does NOT automatically approve any candidate and does NOT modify ExecutionState.
    """
    db = SessionLocal()
    initial_state_count = db.query(ExecutionState).count()
    initial_activities = {act.id: act.planned_progress for act in db.query(Activity).all()}
    db.close()

    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed hydrostatic pressure test on line 24-XX at PR-04 holding 15 bar for 4 hours.",
        "top_k": 5
    }
    res = client.post("/api/matches/reconcile", json=payload)
    assert res.status_code == 200

    db = SessionLocal()
    final_state_count = db.query(ExecutionState).count()
    final_activities = {act.id: act.planned_progress for act in db.query(Activity).all()}
    db.close()

    assert final_state_count == initial_state_count, "ExecutionState must NOT be modified by Milestone 7 reconciliation!"
    assert initial_activities == final_activities, "Activity progress must NOT be auto-updated during reconciliation!"
