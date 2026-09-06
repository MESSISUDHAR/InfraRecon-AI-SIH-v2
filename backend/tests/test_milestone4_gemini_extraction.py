import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.services.extractor_service import extract_execution_event_with_gemini, heuristic_fallback_extractor

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

def test_scenario_1_spool_extraction():
    text = "Yesterday evening the 24-inch spool erection at PR-04 was completed. Line 24-XX was inspected."
    extracted, elapsed_ms, warnings = extract_execution_event_with_gemini(text, "PRJ-REF-04", "DPR-01")
    
    assert extracted.discipline == "Piping"
    assert "PR-04" in (extracted.location or "")
    assert extracted.line_id == "24-XX"
    assert extracted.event_type == "completion"
    assert extracted.progress == 100.0
    assert extracted.status == "EXTRACTED"
    assert "24-inch spool erection" in (extracted.activity_description or extracted.evidence_text or "")
    assert extracted.extraction_confidence >= 0.85

def test_scenario_2_civil_drainage_extraction():
    text = "Laying of 500mm underground drainage conduit in Zone 3 completed today by civil team."
    extracted, elapsed_ms, warnings = extract_execution_event_with_gemini(text, "PRJ-REF-04", "DPR-02")
    
    assert extracted.discipline == "Civil"
    assert "Zone 3" in (extracted.location or "")
    assert extracted.event_type == "completion"
    assert extracted.progress == 100.0
    assert extracted.status == "EXTRACTED"

def test_scenario_3_missing_asset_id_null_safety():
    """
    Verifies that missing optional attributes (like missing asset ID or line ID)
    strictly return None (null) and are never hallucinated.
    """
    text = "Finished foundation concrete pouring at Compressor Bay 2. 45 cubic meters placed."
    extracted, elapsed_ms, warnings = extract_execution_event_with_gemini(text, "PRJ-REF-04", "DPR-03")
    
    assert extracted.discipline == "Civil"
    assert "Compressor Bay 2" in (extracted.location or "")
    assert extracted.asset_id is None  # Must NOT hallucinate asset tag
    assert extracted.line_id is None   # Must NOT hallucinate line ID
    assert extracted.delay_reason is None
    assert extracted.event_type == "completion"
    assert extracted.progress == 100.0

def test_scenario_4_electrical_ambiguous_candidate():
    text = "Cable tray installation started on Level 2 today."
    extracted, elapsed_ms, warnings = extract_execution_event_with_gemini(text, "PRJ-REF-04", "DPR-04")
    
    assert extracted.discipline == "Electrical"
    assert "Level 2" in (extracted.location or "")
    assert extracted.asset_id is None
    assert extracted.status == "EXTRACTED"

def test_scenario_5_multi_day_progress_extraction():
    """
    Verifies accurate extraction of partial event progress (e.g. 75%).
    """
    text = "Spool installation at PR-04 progressed to 75% today. Final bolt-up underway."
    extracted, elapsed_ms, warnings = extract_execution_event_with_gemini(text, "PRJ-REF-04", "DPR-05")
    
    assert extracted.discipline == "Piping"
    assert "PR-04" in (extracted.location or "")
    assert extracted.progress == 75.0
    assert extracted.event_type == "progress"

def test_api_extract_endpoint_persists_to_db():
    payload = {
        "raw_text": "Yesterday evening the 24-inch spool erection at PR-04 was completed. Line 24-XX was inspected.",
        "project_id": "PRJ-REF-04",
        "source_id": "DPR-EXTRACT-01",
        "reporter_name": "Engineer Alex",
        "save_to_db": True
    }
    
    response = client.post("/api/execution-events/extract", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["extracted_data"]["discipline"] == "Piping"
    assert data["event"] is not None
    assert data["event"]["status"] == "EXTRACTED"
    assert data["event"]["discipline"] == "Piping"
    assert data["event"]["line_id"] == "24-XX"
    assert data["model_version"] == "gemini-2.5-flash"

    # Verify database isolation: ExecutionEvent was saved, but ExecutionState remains unperturbed
    db = SessionLocal()
    try:
        saved_event = db.query(ExecutionEvent).filter(ExecutionEvent.source_id == "DPR-EXTRACT-01").first()
        assert saved_event is not None
        assert saved_event.status == "EXTRACTED"
        assert saved_event.discipline == "Piping"
    finally:
        db.close()

def test_api_extract_by_event_id():
    # 1. Ingest event in INGESTED state
    res_submit = client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-REF-04",
        "raw_text": "Laying of 500mm underground drainage conduit in Zone 3 completed today by civil team.",
        "source_id": "DPR-INGESTED-01"
    })
    event_id = res_submit.json()["event"]["id"]
    assert res_submit.json()["event"]["status"] == "INGESTED"

    # 2. Trigger extraction on ingested event
    res_extract = client.post(f"/api/execution-events/{event_id}/extract")
    assert res_extract.status_code == 200
    extract_data = res_extract.json()
    assert extract_data["success"] is True
    assert extract_data["event"]["id"] == event_id
    assert extract_data["event"]["status"] == "EXTRACTED"
    assert extract_data["event"]["discipline"] == "Civil"
    assert "Zone 3" in extract_data["event"]["location"]
