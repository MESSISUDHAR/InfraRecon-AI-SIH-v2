import pytest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

def test_execution_status_endpoint():
    response = client.get("/api/execution-events/status")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["milestone"] >= 3

def test_submit_single_text_field_report():
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Yesterday evening the 24-inch spool erection at PR-04 was completed. Line 24-XX was inspected.",
        "source_id": "DPR-2026-09-06-001",
        "source_type": "DPR_TEXT",
        "source_reference": "Site Diary Book 4",
        "reporter_name": "Supervisor Sharma",
        "report_date": "2026-09-06T08:00:00Z"
    }
    
    response = client.post("/api/execution-events/submit", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    event = res_data["event"]
    assert event["project_id"] == "PRJ-REF-04"
    assert event["source_id"] == "DPR-2026-09-06-001"
    assert event["source_type"] == "DPR_TEXT"
    assert event["reporter_name"] == "Supervisor Sharma"
    assert event["status"] == "INGESTED"
    assert "24-inch spool erection" in event["raw_text"]
    assert event["id"].startswith("evt_")

    # Verify separation: check that raw text exists in ExecutionEvent but ExecutionState was not updated
    db = SessionLocal()
    try:
        db_event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event["id"]).first()
        assert db_event is not None
        assert db_event.raw_text == payload["raw_text"]
        assert db_event.status == "INGESTED"
    finally:
        db.close()

def test_submit_report_auto_generates_source_id():
    payload = {
        "project_id": "PRJ-REF-04",
        "raw_text": "Laying of 500mm underground drainage conduit in Zone 3 completed today by civil team."
    }
    response = client.post("/api/execution-events/submit", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    event = res_data["event"]
    assert event["source_id"].startswith("DPR-")
    assert event["source_type"] == "DPR_TEXT"
    assert event["status"] == "INGESTED"

def test_upload_text_file_dpr():
    file_content = b"""
    DAILY PROGRESS REPORT - PROCESS AREA 4
    Date: 2026-09-06
    Location: Compressor Bay 2
    Notes: Finished foundation concrete pouring at Compressor Bay 2. 45 cubic meters placed.
    """
    response = client.post(
        "/api/execution-events/upload",
        data={
            "project_id": "PRJ-REF-04",
            "source_type": "SITE_DIARY",
            "reporter_name": "Engineer Alex",
            "report_date": "2026-09-06T10:00:00"
        },
        files={"file": ("site_diary_bay2.txt", io.BytesIO(file_content), "text/plain")}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["count"] == 1
    event = res_data["events"][0]
    assert "Compressor Bay 2" in event["raw_text"]
    assert event["source_reference"] == "site_diary_bay2.txt"
    assert event["reporter_name"] == "Engineer Alex"
    assert event["status"] == "INGESTED"

def test_upload_csv_batch_field_reports():
    csv_content = b"""source_id,reporter,raw_text
DPR-BAT-01,Vikram Singh,Cable tray installation started on Level 2 today.
DPR-BAT-02,Anita Roy,Hydrotest completed for Line 12-B at Cooling Tower.
"""
    response = client.post(
        "/api/execution-events/upload",
        data={
            "project_id": "PRJ-REF-04",
            "source_type": "CSV_BATCH"
        },
        files={"file": ("batch_reports.csv", io.BytesIO(csv_content), "text/csv")}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["count"] == 2
    assert res_data["events"][0]["source_id"] == "DPR-BAT-01"
    assert res_data["events"][1]["source_id"] == "DPR-BAT-02"

def test_list_and_filter_execution_events():
    # Submit 2 distinct events
    client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-FILTER-TEST",
        "raw_text": "Welding of 10-inch pipe seam at Substation 3.",
        "source_id": "DPR-WELD-01",
        "source_type": "SUPERVISOR_LOG",
        "reporter_name": "Rajesh"
    })
    client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-FILTER-TEST",
        "raw_text": "Transformer testing and insulation resistance check.",
        "source_id": "DPR-ELEC-01",
        "source_type": "INSPECTION_NOTE",
        "reporter_name": "Meera"
    })

    # List all for project
    res_all = client.get("/api/execution-events?project_id=PRJ-FILTER-TEST")
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert data_all["total"] >= 2
    assert len(data_all["events"]) >= 2

    # Filter by source_type
    res_filtered = client.get("/api/execution-events?project_id=PRJ-FILTER-TEST&source_type=SUPERVISOR_LOG")
    assert res_filtered.status_code == 200
    data_filtered = res_filtered.json()
    assert all(e["source_type"] == "SUPERVISOR_LOG" for e in data_filtered["events"])

    # Search by text
    res_search = client.get("/api/execution-events?project_id=PRJ-FILTER-TEST&search=Transformer")
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert len(data_search["events"]) >= 1
    assert "Transformer" in data_search["events"][0]["raw_text"]

def test_get_and_delete_execution_event():
    # Submit an event
    res_create = client.post("/api/execution-events/submit", json={
        "project_id": "PRJ-DELETE-TEST",
        "raw_text": "Temporary temporary event to delete."
    })
    event_id = res_create.json()["event"]["id"]

    # Get event
    res_get = client.get(f"/api/execution-events/{event_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == event_id

    # Delete event
    res_del = client.delete(f"/api/execution-events/{event_id}")
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True

    # Check 404 after deletion
    res_after = client.get(f"/api/execution-events/{event_id}")
    assert res_after.status_code == 404
