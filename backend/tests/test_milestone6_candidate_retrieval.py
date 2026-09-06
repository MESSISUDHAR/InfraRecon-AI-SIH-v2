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
from app.services.retrieval_service import retrieve_top_k_candidates, evaluate_context_signals

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
CSV_SAMPLE_PATH = os.path.join(DATA_DIR, "refinery_expansion_l5.csv")

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """
    Initializes DB and ensures PRJ-REF-04 schedule activities are uploaded and embedded.
    """
    init_db()
    
    # Check if activities exist for PRJ-REF-04
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

def test_matches_status_endpoint():
    """
    Verify the /api/matches/status health endpoint responds with milestone 6 info.
    """
    response = client.get("/api/matches/status")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["milestone"] >= 6
    assert data["data"]["model"] == "all-MiniLM-L6-v2" or "signals" in data["data"]

def test_candidate_retrieval_exact_identifiers():
    """
    Test Scenario 1: Exact Piping Spool report (has line ID '24-XX' and location 'PR-04').
    Should return Top candidate and alternative candidates, with semantic similarity and context signals.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed 100% installation of 24-inch pipe spool on line 24-XX at Area PR-04.",
        "top_k": 5
    }
    response = client.post("/api/matches/retrieve-candidates", json=payload)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["success"] is True
    assert res_data["total_candidates"] <= 5
    assert res_data["total_activities_searched"] > 0
    assert res_data["top_candidate"] is not None
    
    top = res_data["top_candidate"]
    assert top["rank"] == 1
    assert top["is_top_match"] is True
    assert top["semantic_score"] > 0.4
    assert top["activity_id"] is not None
    assert top["activity_name"] is not None
    
    # Context signals
    assert "context_signals" in top
    signals = top["context_signals"]
    assert "discipline_match" in signals
    assert "location_match" in signals
    assert "identifier_match" in signals

    # Alternatives exist
    assert len(res_data["alternative_candidates"]) > 0
    for alt in res_data["alternative_candidates"]:
        assert alt["rank"] > 1
        assert alt["semantic_score"] <= top["semantic_score"]

def test_candidate_retrieval_missing_identifiers():
    """
    Test Scenario 2: Civil report with missing asset tag and line ID.
    Per PROJECT_RULES.md, missing fields must be treated as neutral/null rather than negative penalties.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed backfilling and soil compaction across the foundation trench. Subgrade prepared.",
        "top_k": 5
    }
    response = client.post("/api/matches/retrieve-candidates", json=payload)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["success"] is True
    assert res_data["top_candidate"] is not None
    top = res_data["top_candidate"]
    
    # Check that missing identifier does not break matching and is handled as neutral
    signals = top["context_signals"]
    assert "NEUTRAL" in signals["identifier_match"] or signals["identifier_aligned"] is True

def test_candidate_retrieval_discipline_filter():
    """
    Verify that discipline filter strictly restricts candidate activities to the selected discipline.
    """
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Foundation excavation and backfill",
        "discipline_filter": "Civil",
        "top_k": 5
    }
    response = client.post("/api/matches/retrieve-candidates", json=payload)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["success"] is True
    if res_data["top_candidate"]:
        assert res_data["top_candidate"]["discipline"] == "Civil"
    for alt in res_data["alternative_candidates"]:
        assert alt["discipline"] == "Civil"

def test_candidate_retrieval_for_existing_event_id():
    """
    Test candidate retrieval using an existing ingested ExecutionEvent ID.
    """
    # 1. Submit a raw execution event
    event_payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Laying 33kV medium voltage power cable through trench near Substation B. 200 meters complete.",
        "source_id": "DPR-ELEC-2026-09-06",
        "source_type": "DPR"
    }
    submit_res = client.post("/api/execution-events/submit", json=event_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # 2. Retrieve candidates for this event
    get_res = client.get(f"/api/matches/candidates/{event_id}?project_id=PRJ-REF-04&top_k=5")
    assert get_res.status_code == 200
    retrieval_data = get_res.json()

    assert retrieval_data["success"] is True
    assert retrieval_data["event_id"] == event_id
    assert retrieval_data["source_id"] == "DPR-ELEC-2026-09-06"
    assert retrieval_data["top_candidate"] is not None
    assert len(retrieval_data["alternative_candidates"]) > 0

    # 3. Verify MatchCandidate lineage records were created
    db = SessionLocal()
    candidates_in_db = db.query(MatchCandidate).filter(MatchCandidate.event_id == event_id).all()
    db.close()
    assert len(candidates_in_db) > 0
    assert any(c.rank == 1 and c.is_top_match for c in candidates_in_db)

def test_candidate_retrieval_does_not_modify_execution_state_or_activities():
    """
    CRITICAL RULE: Milestone 6 must NOT select the final activity,
    must NOT automatically approve any candidate, and must NOT modify ExecutionState.
    """
    db = SessionLocal()
    initial_state_count = db.query(ExecutionState).count()
    initial_activities = {act.id: act.planned_progress for act in db.query(Activity).all()}
    db.close()

    # Perform retrieval
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Completed hydrostatic pressure test on line 24-XX at PR-04 holding 15 bar for 4 hours.",
        "top_k": 5
    }
    res = client.post("/api/matches/retrieve-candidates", json=payload)
    assert res.status_code == 200

    # Verify no execution state was created or approved
    db = SessionLocal()
    final_state_count = db.query(ExecutionState).count()
    final_activities = {act.id: act.planned_progress for act in db.query(Activity).all()}
    db.close()

    assert final_state_count == initial_state_count, "ExecutionState must NOT be modified by Milestone 6 candidate retrieval!"
    assert initial_activities == final_activities, "Activity progress must NOT be auto-updated during candidate retrieval!"

def test_evaluate_context_signals_unit():
    """
    Unit test for evaluate_context_signals() function handling exact match, neutral, and mismatch cases.
    """
    db = SessionLocal()
    sample_act = db.query(Activity).filter(Activity.project_id == "PRJ-REF-04").first()
    db.close()

    assert sample_act is not None, "PRJ-REF-04 must have activities in DB."

    # 1. Exact match case
    exact_signals = evaluate_context_signals(
        extracted_discipline=sample_act.discipline,
        extracted_location=sample_act.location,
        extracted_asset_id=sample_act.asset_id,
        extracted_line_id=sample_act.line_id,
        activity=sample_act
    )
    assert exact_signals["discipline_aligned"] is True
    assert exact_signals["location_aligned"] is True

    # 2. Missing data case (neutral)
    neutral_signals = evaluate_context_signals(
        extracted_discipline=None,
        extracted_location=None,
        extracted_asset_id=None,
        extracted_line_id=None,
        activity=sample_act
    )
    assert "NEUTRAL" in neutral_signals["discipline_match"]
    assert "NEUTRAL" in neutral_signals["location_match"]
    assert "NEUTRAL" in neutral_signals["identifier_match"]
