import os
import io
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db
from app.services.schedule_parser import parse_schedule_file, detect_column_mappings, build_searchable_text

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

def test_detect_column_mappings():
    # Test typical P6 / Excel column header variations
    headers_1 = ["Activity ID", "Activity Name", "WBS Code", "Discipline", "Location", "Asset ID", "Planned Start", "Planned Finish"]
    mapping_1 = detect_column_mappings(headers_1)
    assert mapping_1["activity_id"] == "Activity ID"
    assert mapping_1["activity_name"] == "Activity Name"
    assert mapping_1["discipline"] == "Discipline"
    assert mapping_1["location"] == "Location"
    assert mapping_1["asset_id"] == "Asset ID"

    # Test alternative naming (Metro Rail format)
    headers_2 = ["Task Code", "Task Name", "WBS Element", "Trade", "Site Section", "Equipment Tag", "Start Date", "Finish Date", "Dependencies"]
    mapping_2 = detect_column_mappings(headers_2)
    assert mapping_2["activity_id"] == "Task Code"
    assert mapping_2["activity_name"] == "Task Name"
    assert mapping_2["discipline"] == "Trade"
    assert mapping_2["location"] == "Site Section"
    assert mapping_2["asset_id"] == "Equipment Tag"
    assert mapping_2["predecessor_ids"] == "Dependencies"

def test_searchable_text_builder():
    text = build_searchable_text(
        activity_name="Install 24-inch spool",
        discipline="Piping",
        location="Area PR-04",
        asset_id="PR-04",
        line_id="24-XX",
        wbs_name="Process Area Piping",
        activity_id="PIP-L5-034"
    )
    assert "Activity: Install 24-inch spool" in text
    assert "Discipline: Piping" in text
    assert "Location: Area PR-04" in text
    assert "Line: 24-XX" in text
    assert "WBS: Process Area Piping" in text

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
CSV_SAMPLE_PATH = os.path.join(DATA_DIR, "refinery_expansion_l5.csv")
XLSX_SAMPLE_PATH = os.path.join(DATA_DIR, "metro_rail_package_l6.xlsx")

def test_parse_csv_schedule():
    with open(CSV_SAMPLE_PATH, "rb") as f:
        file_bytes = f.read()

    result = parse_schedule_file(file_bytes, "refinery_expansion_l5.csv", "PRJ-REF-04", "v1.0")
    assert result["success"] is True
    assert result["status"] == "VALIDATED"
    assert result["summary"]["total_activities"] == 15
    assert "Piping" in result["summary"]["disciplines"]
    assert "Civil" in result["summary"]["disciplines"]
    assert len(result["activities"]) == 15

    # Check first activity normalized structure
    act1 = result["activities"][0]
    assert act1["activity_id"] == "PIP-L5-034"
    assert act1["discipline"] == "Piping"
    assert act1["location"] == "Area PR-04"
    assert act1["line_id"] == "24-XX"
    assert act1["searchable_text"] is not None

def test_parse_xlsx_schedule():
    with open(XLSX_SAMPLE_PATH, "rb") as f:
        file_bytes = f.read()

    result = parse_schedule_file(file_bytes, "metro_rail_package_l6.xlsx", "PRJ-METRO-01", "v1.0")
    assert result["success"] is True
    assert result["status"] == "VALIDATED"
    assert result["summary"]["total_activities"] == 6
    assert "Civil" in result["summary"]["disciplines"]
    assert "Trackwork" in result["summary"]["disciplines"]

def test_mandatory_column_validation_failure():
    # Missing activity_id
    invalid_df = pd.DataFrame([
        {"Description": "Erect columns", "Location": "Area 1", "Discipline": "Civil"}
    ])
    csv_bytes = invalid_df.to_csv(index=False).encode('utf-8')
    result = parse_schedule_file(csv_bytes, "invalid.csv")
    assert result["success"] is False
    assert "Missing mandatory schedule column" in result["error"]

def test_schedule_api_upload_and_query():
    # 1. Test CSV Upload via API
    with open(CSV_SAMPLE_PATH, "rb") as f:
        response = client.post(
            "/api/schedule/upload",
            data={
                "project_id": "PRJ-REF-04",
                "project_name": "Refinery Expansion Package 4",
                "schedule_version": "v1.0"
            },
            files={"file": ("refinery_expansion_l5.csv", f, "text/csv")}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["summary"]["total_activities"] == 15
    assert data["summary"]["project_id"] == "PRJ-REF-04"

    # 2. Test Querying Activities with Filters
    res_activities = client.get("/api/schedule/activities?project_id=PRJ-REF-04&discipline=Piping")
    assert res_activities.status_code == 200
    acts = res_activities.json()
    assert acts["total"] == 5
    assert all(a["discipline"] == "Piping" for a in acts["activities"])

    # 3. Test Querying Summary
    res_summary = client.get("/api/schedule/summary?project_id=PRJ-REF-04")
    assert res_summary.status_code == 200
    summary = res_summary.json()["data"]
    assert summary["total_activities"] == 15
    assert summary["active_schedule_version"] == "v1.0"
    assert "Piping" in summary["disciplines"]

    # 4. Test Search
    res_search = client.get("/api/schedule/activities?project_id=PRJ-REF-04&search=24-inch")
    assert res_search.status_code == 200
    search_results = res_search.json()
    assert search_results["total"] >= 1
    assert "24-inch" in search_results["activities"][0]["activity_name"]

    # 5. Test Dynamic Upload of a completely different XLSX schedule
    with open(XLSX_SAMPLE_PATH, "rb") as f:
        res_metro = client.post(
            "/api/schedule/upload",
            data={
                "project_id": "PRJ-METRO-01",
                "project_name": "Metro Rail Viaduct Package",
                "schedule_version": "v1.0"
            },
            files={"file": ("metro_rail_package_l6.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
    assert res_metro.status_code == 200
    metro_json = res_metro.json()
    assert metro_json["success"] is True
    assert metro_json["summary"]["total_activities"] == 6
    assert metro_json["summary"]["project_id"] == "PRJ-METRO-01"
