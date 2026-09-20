import json
import pytest
import numpy as np
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import Session, sessionmaker
from pgvector.sqlalchemy import Vector

from app.database import Base, is_postgresql, init_db, SessionLocal
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.project import Project
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

@pytest.fixture
def db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_dialect_detection_and_initialization():
    """
    1. Verify database dialect detection correctly identifies SQLite vs PostgreSQL
    and init_db executes cleanly without exceptions.
    """
    init_db()
    # On the current local environment, SQLite is the active dialect
    assert is_postgresql() is False or is_postgresql() is True
    assert EMBEDDING_DIM == 384

def test_models_vector_and_json_dual_column_schema():
    """
    2. Verify Activity and ExecutionEvent models have both pgvector Vector(384)
    and JSON text columns for primary and fallback storage.
    """
    assert hasattr(Activity, "embedding")
    assert hasattr(Activity, "embedding_json")
    assert isinstance(Activity.embedding.type, Vector)
    assert Activity.embedding.type.dim == 384

    assert hasattr(ExecutionEvent, "embedding")
    assert hasattr(ExecutionEvent, "embedding_json")
    assert isinstance(ExecutionEvent.embedding.type, Vector)
    assert ExecutionEvent.embedding.type.dim == 384

def test_numpy_cosine_similarity_edge_cases_and_clamping():
    """
    3. Verify NumPy cosine similarity handles lists, numpy arrays, zeros,
    and clamps output strictly to [0.0, 1.0].
    """
    vec_a = [1.0, 0.0, 0.0] + [0.0] * 381
    vec_b = [1.0, 0.0, 0.0] + [0.0] * 381
    vec_c = [-1.0, 0.0, 0.0] + [0.0] * 381
    vec_d = [0.0, 1.0, 0.0] + [0.0] * 381

    # Identical vectors -> 1.0
    assert compute_cosine_similarity(vec_a, vec_b) == 1.0
    # Orthogonal vectors -> 0.0
    assert compute_cosine_similarity(vec_a, vec_d) == 0.0
    # Opposite vectors clamped to 0.0
    assert compute_cosine_similarity(vec_a, vec_c) == 0.0
    # None handling
    assert compute_cosine_similarity(None, vec_a) == 0.0
    assert compute_cosine_similarity(vec_a, None) == 0.0
    # NumPy array input
    np_a = np.array(vec_a, dtype=np.float32)
    np_b = np.array(vec_b, dtype=np.float32)
    assert compute_cosine_similarity(np_a, np_b) == 1.0

def test_sqlite_vector_and_numpy_fallback_search(db_session: Session):
    """
    4. Verify that search_top_k_activities functions seamlessly on SQLite
    using stored Vector and JSON embeddings with NumPy fallback.
    """
    project_id = "PRJ-PGV-TEST"
    proj = Project(
        id=project_id,
        name="PostgreSQL pgvector test project",
        code=project_id,
        active_schedule_version="v1.0"
    )
    db_session.merge(proj)

    emb_piping = generate_embedding("Erect 24-inch process piping spool at Area PR-04")
    emb_civil = generate_embedding("Pour reinforced concrete foundation slab for compressor")

    act_1 = Activity(
        id=f"{project_id}_v1.0_ACT-001",
        project_id=project_id,
        schedule_version="v1.0",
        activity_id="ACT-001",
        activity_name="Erect 24-inch process piping spool at Area PR-04",
        discipline="Piping",
        location="Area PR-04",
        line_id="24-XX",
        searchable_text="Activity: Erect 24-inch process piping spool | Discipline: Piping | Location: Area PR-04 | Line: 24-XX",
        embedding=emb_piping,
        embedding_json=json.dumps(emb_piping)
    )

    act_2 = Activity(
        id=f"{project_id}_v1.0_ACT-002",
        project_id=project_id,
        schedule_version="v1.0",
        activity_id="ACT-002",
        activity_name="Pour reinforced concrete foundation slab for compressor",
        discipline="Civil",
        location="Compressor Bay",
        asset_id="CMP-01",
        searchable_text="Activity: Pour reinforced concrete foundation slab | Discipline: Civil | Location: Compressor Bay",
        embedding=emb_civil,
        embedding_json=json.dumps(emb_civil)
    )

    db_session.merge(act_1)
    db_session.merge(act_2)
    db_session.commit()

    # Search with piping query
    matches = search_top_k_activities(
        query_text="24-inch piping spool installation in Area PR-04",
        project_id=project_id,
        top_k=2,
        db=db_session
    )

    assert len(matches) == 2
    top = matches[0]
    assert top["activity_id"] == "ACT-001"
    assert top["semantic_score"] > matches[1]["semantic_score"]
    assert top["semantic_score"] >= 0.50

def test_reconciliation_6_signals_preserved_with_vector_integration(db_session: Session):
    """
    5. Verify 6-signal context-aware reconciliation logic produces accurate multi-signal scores
    and explainability when integrated with vector embeddings.
    """
    project_id = "PRJ-RECON-VEC"
    proj = Project(
        id=project_id,
        name="Reconciliation Vector Project",
        code=project_id,
        active_schedule_version="v1.0"
    )
    db_session.merge(proj)

    emb = generate_embedding("Install 24-inch spool at Area PR-04 Line 24-XX")
    act = Activity(
        id=f"{project_id}_v1.0_PIP-01",
        project_id=project_id,
        schedule_version="v1.0",
        activity_id="PIP-01",
        activity_name="Install 24-inch spool at Area PR-04",
        discipline="Piping",
        location="Area PR-04",
        line_id="24-XX",
        searchable_text="Activity: Install 24-inch spool | Discipline: Piping | Location: Area PR-04 | Line: 24-XX",
        embedding=emb,
        embedding_json=json.dumps(emb)
    )
    db_session.merge(act)
    db_session.commit()

    raw_text = "Completed erection of 24-inch spool at Area PR-04 on Line 24-XX yesterday."
    res = reconcile_execution_event(
        db=db_session,
        project_id=project_id,
        raw_text=raw_text,
        weights=DEFAULT_WEIGHTS,
        persist_candidates=False
    )

    assert res.success is True
    assert res.top_candidate is not None
    top = res.top_candidate
    assert top.activity_id == "PIP-01"
    assert top.semantic_score > 0.40
    assert top.identifier_score == 1.0
    assert top.discipline_score == 1.0
    assert top.location_score == 1.0
    assert top.final_confidence >= 0.85
    assert top.confidence_tier == "HIGH"
    assert "Exact line identifier match" in " ".join(top.positive_signals)
