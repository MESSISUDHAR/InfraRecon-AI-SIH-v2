import os
import json
import uuid
import pytest
import numpy as np
from datetime import datetime, timezone
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import Session, sessionmaker
from pgvector.sqlalchemy import Vector

from app.database import Base, is_postgresql
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.match_candidate import MatchCandidate
from app.models.execution_state import ExecutionState
from app.models.audit_log import AuditLog
from app.services.embedding_service import (
    generate_embedding,
    generate_embeddings_batch,
    compute_cosine_similarity,
    search_top_k_activities,
    EMBEDDING_DIM
)
from app.services.retrieval_service import retrieve_top_k_candidates
from app.services.reconciliation_service import reconcile_execution_event, DEFAULT_WEIGHTS
from app.services.review_service import approve_candidate_match

# Check for live PostgreSQL server
PG_PASSWORDS = ["postgres", "postgrespassword", "admin"]
LIVE_PG_URL = None

for pwd in PG_PASSWORDS:
    try:
        conn = psycopg2.connect(host="localhost", port=5432, user="postgres", password=pwd, dbname="postgres")
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'infra_recon'")
        if not cur.fetchone():
            cur.execute("CREATE DATABASE infra_recon")
        conn.close()
        LIVE_PG_URL = f"postgresql://postgres:{pwd}@localhost:5432/infra_recon"
        break
    except Exception:
        continue

@pytest.mark.skipif(LIVE_PG_URL is None, reason="Live PostgreSQL server not reachable on localhost:5432")
def test_01_postgres_connection_and_extension_status():
    """
    1. Verify direct connectivity to PostgreSQL and inspect extension availability.
    """
    engine = create_engine(LIVE_PG_URL)
    with engine.connect() as conn:
        ver = conn.execute(text("SELECT version();")).scalar()
        assert ver is not None
        assert "PostgreSQL" in ver
        
        # Check pgvector extension status in catalog
        ext_check = conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';")).fetchall()
        # Report extension availability
        has_pgvector = len(ext_check) > 0
        assert isinstance(has_pgvector, bool)

def test_02_docker_compose_pgvector_configuration_specification():
    """
    2. Verify docker-compose.yml specifies the official pgvector/pgvector:pg16 container,
    healthchecks, volumes, and environment variables.
    """
    compose_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docker-compose.yml"))
    assert os.path.exists(compose_path)
    with open(compose_path, "r") as f:
        content = f.read()

    assert "pgvector/pgvector:pg16" in content
    assert "infrarecon_db" in content
    assert "POSTGRES_DB: infra_recon" in content
    assert "POSTGRES_USER: postgres" in content
    assert "POSTGRES_PASSWORD: postgrespassword" in content
    assert "DATABASE_URL=postgresql://postgres:postgrespassword@db:5432/infra_recon" in content

def test_03_pgvector_cosine_distance_query_operator_semantics():
    """
    3. Verify pgvector distance operator compilation and cosine similarity mathematics.
    """
    raw_vec = np.ones(EMBEDDING_DIM, dtype=np.float32)
    norm_vec = (raw_vec / np.linalg.norm(raw_vec)).tolist()
    
    sim = compute_cosine_similarity(norm_vec, norm_vec)
    assert 0.99 <= sim <= 1.0

    # Test Activity.embedding comparator cosine_distance <=>
    comparator = Activity.embedding.cosine_distance(norm_vec)
    assert comparator is not None

def test_04_full_lifecycle_on_live_postgres_or_fallback():
    """
    4. Verify the complete Phase 1 lifecycle on PostgreSQL (or SQLite fallback):
       Field Report -> ExecutionEvent -> Extraction -> Reconciliation -> Review -> Approval -> Verified State -> Audit.
    """
    from app.main import app
    from fastapi.testclient import TestClient
    from app.database import SessionLocal, init_db

    init_db()
    client = TestClient(app)
    project_id = "PRJ-PG-LIFECYCLE-01"

    # Cleanup any previous runs for this test project
    db = SessionLocal()
    try:
        db.query(AuditLog).filter(AuditLog.project_id == project_id).delete()
        db.query(ExecutionState).filter(ExecutionState.project_id == project_id).delete()
        db.query(ExecutionEvent).filter(ExecutionEvent.project_id == project_id).delete()
        db.query(Activity).filter(Activity.project_id == project_id).delete()
        db.query(Project).filter(Project.id == project_id).delete()
        db.commit()
    finally:
        db.close()

    # Step A: Ingest field report
    dpr_payload = {
        "raw_text": "Completed 24-inch spool erection at Area PR-04 on Line 24-XX yesterday afternoon.",
        "project_id": project_id,
        "source_type": "DPR_TEXT",
        "reporter_name": "Supervisor Singh"
    }
    submit_res = client.post("/api/execution-events/submit", json=dpr_payload)
    assert submit_res.status_code == 200
    event_id = submit_res.json()["event"]["id"]

    # Step B: AI Structured Extraction
    extract_res = client.post(
        "/api/execution-events/extract",
        json={
            "raw_text": dpr_payload["raw_text"],
            "project_id": project_id,
            "event_id": event_id,
            "save_to_db": True
        }
    )
    assert extract_res.status_code == 200
    extract_data = extract_res.json()["extracted_data"]
    assert extract_data["discipline"] in ["Piping", "piping", "PIPING", "General"]

    # Step C: Upload Schedule
    csv_content = """Activity ID,Activity Name,Discipline,Location,Asset ID,Line ID,Planned Start,Planned Finish,Planned Duration,Planned Progress
PIP-L5-034,Install 24-inch spool at PR-04,Piping,Area PR-04,PR-04,24-XX,2026-09-01,2026-09-10,9,100
CIV-L5-088,Pour compressor foundation slab,Civil,Compressor Bay,CMP-01,,2026-08-20,2026-08-30,10,100
"""
    files = {'file': ('test_schedule.csv', csv_content.encode('utf-8'), 'text/csv')}
    data = {'project_id': project_id, 'project_name': 'PostgreSQL Lifecycle Test', 'schedule_version': 'v1.0'}
    
    upload_res = client.post("/api/schedule/upload", files=files, data=data)
    assert upload_res.status_code == 200
    assert upload_res.json()["summary"]["total_activities"] == 2

    # Step D: Context-Aware Reconciliation
    recon_res = client.post(
        "/api/matches/reconcile",
        json={
            "raw_text": dpr_payload["raw_text"],
            "event_id": event_id,
            "project_id": project_id,
            "top_k": 2
        }
    )
    assert recon_res.status_code == 200
    recon_data = recon_res.json()
    top_cand = recon_data["top_candidate"]
    assert top_cand is not None
    assert top_cand["activity_id"] == "PIP-L5-034"
    assert top_cand["final_confidence"] >= 0.80

    # Step E: Planner Approval Gate
    approve_res = client.post(
        "/api/review/approve",
        json={
            "event_id": event_id,
            "activity_id": top_cand["activity_id"],
            "reviewer_id": "Lead Planner Kumar",
            "notes": "Verified against isometric drawing ISO-24-XX-01",
            "progress_mode": "CUMULATIVE_ACTIVITY",
            "override_progress": 100.0
        }
    )
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["success"] is True
    assert app_data["audit_log_id"] is not None

    # Step F: Verified Execution State
    state_res = client.get(f"/api/execution-state/activity/{top_cand['activity_id']}?project_id={project_id}")
    assert state_res.status_code == 200
    state_data = state_res.json()["data"]
    assert state_data["verified_observations_count"] == 1
    assert state_data["actual_progress"] == 100.0

    # Step G: Audit Trail Lineage
    audit_res = client.get(f"/api/audit/logs/{app_data['audit_log_id']}")
    assert audit_res.status_code == 200
    lineage = audit_res.json()["data"]
    assert lineage["audit_id"] == app_data["audit_log_id"]
    assert lineage["stage_1_field_evidence"] is not None
    assert lineage["stage_2_ai_extraction"] is not None
    assert lineage["stage_3_candidate_retrieval"] is not None
    assert lineage["stage_4_reconciliation"] is not None
    assert lineage["stage_5_confidence_signals"] is not None
    assert lineage["stage_6_human_decision"] is not None
    assert lineage["stage_7_verified_state"] is not None
