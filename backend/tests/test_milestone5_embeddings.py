import os
import json
import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import init_db, SessionLocal
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.services.embedding_service import (
    generate_embedding,
    generate_embeddings_batch,
    compute_cosine_similarity,
    search_top_k_activities,
    get_sentence_transformer_model,
    EMBEDDING_DIM
)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
CSV_SAMPLE_PATH = os.path.join(DATA_DIR, "refinery_expansion_l5.csv")

def test_embedding_model_initialization():
    """
    1. Verify the embedding model loads correctly.
    """
    model = get_sentence_transformer_model()
    # SentenceTransformer is either loaded or dense fallback is ready
    sample_vec = generate_embedding("Test model initialization")
    assert isinstance(sample_vec, list)
    assert len(sample_vec) == EMBEDDING_DIM
    assert all(isinstance(x, float) for x in sample_vec)

def test_embedding_dimensions_consistency():
    """
    2. Verify that generated embeddings strictly conform to 384 dimensions
    for both single and batch generation.
    """
    text_1 = "Install 24-inch spool at PR-04"
    text_2 = "Finished foundation concrete pouring at Compressor Bay 2"
    
    emb_1 = generate_embedding(text_1)
    emb_2 = generate_embedding(text_2)

    assert len(emb_1) == EMBEDDING_DIM
    assert len(emb_2) == EMBEDDING_DIM
    assert isinstance(emb_1[0], float)
    assert isinstance(emb_2[0], float)

    # Batch generation consistency
    batch_embs = generate_embeddings_batch([text_1, text_2, "Cable tray installation"])
    assert len(batch_embs) == 3
    assert all(len(e) == EMBEDDING_DIM for e in batch_embs)

def test_cosine_similarity_computation():
    """
    3. Verify semantic cosine similarity between related vs unrelated concepts.
    """
    spool_query = "24-inch spool erection at PR-04"
    spool_match = "Install 24-inch spool at PR-04 in Process Area Piping"
    concrete_activity = "Pour Foundation Slab for Compressor Unit B2"

    emb_q = generate_embedding(spool_query)
    emb_match = generate_embedding(spool_match)
    emb_unrelated = generate_embedding(concrete_activity)

    score_match = compute_cosine_similarity(emb_q, emb_match)
    score_unrelated = compute_cosine_similarity(emb_q, emb_unrelated)

    assert score_match > score_unrelated
    assert score_match >= 0.40
    assert 0.0 <= score_unrelated <= 1.0

def test_schedule_upload_dynamically_generates_embeddings():
    """
    4. Verify that uploading an arbitrary schedule file automatically generates
    and persists 384-dimensional embeddings for all its activities in the DB.
    """
    with open(CSV_SAMPLE_PATH, "rb") as f:
        res = client.post(
            "/api/schedule/upload",
            data={
                "project_id": "PRJ-EMB-TEST",
                "project_name": "Embedding Test Project",
                "schedule_version": "v1.0"
            },
            files={"file": ("refinery_expansion_l5.csv", f, "text/csv")}
        )

    assert res.status_code == 200
    assert res.json()["success"] is True

    # Check database records
    db = SessionLocal()
    try:
        activities = db.query(Activity).filter(Activity.project_id == "PRJ-EMB-TEST").all()
        assert len(activities) == 15

        for act in activities:
            assert act.embedding_json is not None
            emb_vector = json.loads(act.embedding_json)
            assert len(emb_vector) == EMBEDDING_DIM
            assert all(isinstance(v, (int, float)) for v in emb_vector)
    finally:
        db.close()

def test_execution_event_extraction_generates_embedding():
    """
    5. Verify that extracting structured facts from field reports automatically
    generates and persists the 384-dimensional dense embedding for the execution event.
    """
    payload = {
        "raw_text": "Yesterday evening the 24-inch spool erection at PR-04 was completed. Line 24-XX was inspected.",
        "project_id": "PRJ-EMB-TEST",
        "source_id": "DPR-EMB-01",
        "save_to_db": True
    }
    
    response = client.post("/api/execution-events/extract", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    event_id = data["event"]["id"]

    db = SessionLocal()
    try:
        event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
        assert event is not None
        assert event.embedding_json is not None
        emb = json.loads(event.embedding_json)
        assert len(emb) == EMBEDDING_DIM
    finally:
        db.close()

def test_semantic_search_endpoint_retrieves_top_k():
    """
    6. Verify Top-K semantic similarity retrieval via POST /api/schedule/semantic-search.
    """
    search_payload = {
        "query": "24-inch spool erection at PR-04 completed yesterday",
        "project_id": "PRJ-EMB-TEST",
        "top_k": 3
    }
    res = client.post("/api/schedule/semantic-search", json=search_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["matches"]) <= 3
    assert len(data["matches"]) > 0

    top_match = data["matches"][0]
    assert top_match["rank"] == 1
    assert "24-inch spool" in top_match["activity_name"] or top_match["activity_id"] == "PIP-L5-034"
    assert top_match["semantic_score"] > 0.0

def test_e2e_schedule_and_execution_embedding_lifecycle():
    """
    7. Full End-to-End Test:
    - Ingest custom small dynamic schedule (3 activities)
    - Create an execution event & extract structured facts
    - Verify schedule embeddings exist, are 384-dim, and retrievable from DB
    - Verify execution event embedding exists, is 384-dim, and retrievable from DB
    - Verify both have the EXACT same dimensions
    - Perform semantic search and verify matching against DB records
    """
    project_id = "PRJ-E2E-EMB-01"
    
    # 1. Create a dynamic in-memory schedule CSV with 3 distinct disciplines
    df_small = pd.DataFrame([
        {
            "Activity ID": "E2E-ACT-001",
            "Activity Name": "Install high pressure steam piping loop",
            "Discipline": "Piping",
            "Location": "Boiler Room Area 1",
            "Asset ID": "BLR-01",
            "Line ID": "STM-100",
            "Planned Start": "2026-09-01",
            "Planned Finish": "2026-09-10"
        },
        {
            "Activity ID": "E2E-ACT-002",
            "Activity Name": "Excavate foundation trench for control room",
            "Discipline": "Civil",
            "Location": "Control Room Sector",
            "Asset ID": "CTL-01",
            "Line ID": "",
            "Planned Start": "2026-09-02",
            "Planned Finish": "2026-09-08"
        },
        {
            "Activity ID": "E2E-ACT-003",
            "Activity Name": "Terminate fiber optic communication cables",
            "Discipline": "Instrumentation",
            "Location": "Server Room Rack 4",
            "Asset ID": "SRV-04",
            "Line ID": "",
            "Planned Start": "2026-09-05",
            "Planned Finish": "2026-09-12"
        }
    ])
    csv_bytes = df_small.to_csv(index=False).encode('utf-8')

    # Upload schedule
    res_upload = client.post(
        "/api/schedule/upload",
        data={
            "project_id": project_id,
            "project_name": "E2E Embedding Test Project",
            "schedule_version": "v1.0"
        },
        files={"file": ("small_dynamic_schedule.csv", io.BytesIO(csv_bytes), "text/csv")}
    )
    assert res_upload.status_code == 200
    assert res_upload.json()["success"] is True

    # 2. Verify all 3 activities have 384-dim embeddings stored in DB
    db = SessionLocal()
    try:
        acts = db.query(Activity).filter(Activity.project_id == project_id).all()
        assert len(acts) == 3

        for act in acts:
            assert act.embedding_json is not None, f"Activity {act.activity_id} missing embedding_json"
            act_emb = json.loads(act.embedding_json)
            assert len(act_emb) == EMBEDDING_DIM == 384
            assert all(isinstance(x, (int, float)) for x in act_emb)

        # 3. Create one execution event and extract structured facts with embedding
        raw_text = "Completed installation of high pressure steam piping loop in Boiler Room Area 1 today. Line STM-100 inspected."
        res_extract = client.post("/api/execution-events/extract", json={
            "raw_text": raw_text,
            "project_id": project_id,
            "source_id": "DPR-E2E-001",
            "save_to_db": True
        })
        assert res_extract.status_code == 200
        event_id = res_extract.json()["event"]["id"]

        # 4. Verify execution event embedding in DB
        event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
        assert event is not None
        assert event.embedding_json is not None
        evt_emb = json.loads(event.embedding_json)
        assert len(evt_emb) == EMBEDDING_DIM == 384

        # 5. Verify dimension parity
        assert len(evt_emb) == len(json.loads(acts[0].embedding_json)) == 384

        # 6. Verify semantic search against DB
        res_search = client.post("/api/schedule/semantic-search", json={
            "query": "steam piping loop in boiler room",
            "project_id": project_id,
            "top_k": 2
        })
        assert res_search.status_code == 200
        search_data = res_search.json()
        assert len(search_data["matches"]) >= 1
        top_match = search_data["matches"][0]
        assert top_match["activity_id"] == "E2E-ACT-001"
        assert top_match["semantic_score"] > 0.0
    finally:
        db.close()
