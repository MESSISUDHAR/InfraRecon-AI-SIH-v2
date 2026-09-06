from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.candidate_schema import (
    CandidateRetrievalRequest,
    CandidateRetrievalResponse
)
from app.schemas.reconciliation_schema import (
    ReconciliationWeights,
    ReconciliationRequest,
    ReconciliationResponse
)
from app.services.retrieval_service import retrieve_top_k_candidates
from app.services.reconciliation_service import (
    reconcile_execution_event,
    DEFAULT_WEIGHTS
)

router = APIRouter(prefix="/matches", tags=["Reconciliation Matches"])

@router.get("/status")
def matches_status():
    return ApiResponse(
        success=True,
        message="Context-aware reconciliation service operational (Milestone 7 Multi-Signal Engine).",
        data={
            "milestone": 7,
            "engine": "ContextAwareReconciliationEngine",
            "model": "all-MiniLM-L6-v2",
            "signals": ["semantic", "identifier", "discipline", "location", "wbs", "temporal"],
            "default_weights": DEFAULT_WEIGHTS.model_dump()
        }
    )

@router.get("/weights", response_model=ReconciliationWeights)
def get_default_weights():
    """
    Returns the standard default reconciliation signal weights.
    """
    return DEFAULT_WEIGHTS

@router.post("/reconcile", response_model=ReconciliationResponse)
def reconcile_event(
    payload: ReconciliationRequest,
    db: Session = Depends(get_db)
):
    """
    Milestone 7: Context-Aware L5/L6 Reconciliation Engine.
    Computes 6-signal contextual scores (Semantic 40%, Line/Asset ID 20%, Discipline 15%,
    Location 10%, WBS Context 10%, Temporal 5%), applies configurable weights, treats missing
    data as neutral alignment, and returns ranked candidates with explainability and conflict detection.
    Does NOT automatically approve any candidate.
    """
    try:
        result = reconcile_execution_event(
            db=db,
            project_id=payload.project_id,
            raw_text=payload.raw_text,
            event_id=payload.event_id,
            schedule_version=payload.schedule_version,
            top_k=payload.top_k,
            weights=payload.weights,
            discipline_filter=payload.discipline_filter,
            persist_candidates=True
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation engine failed: {str(e)}")

@router.get("/reconcile/{event_id}", response_model=ReconciliationResponse)
def reconcile_event_by_id(
    event_id: str,
    project_id: Optional[str] = Query("PRJ-REF-04"),
    schedule_version: Optional[str] = Query(None),
    top_k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """
    Runs multi-signal reconciliation for an existing ingested ExecutionEvent by ID.
    """
    result = reconcile_execution_event(
        db=db,
        project_id=project_id,
        event_id=event_id,
        schedule_version=schedule_version,
        top_k=top_k,
        persist_candidates=True
    )
    if not result.top_candidate and result.total_activities_evaluated == 0:
        raise HTTPException(status_code=404, detail="No schedule activities found to match against.")
    return result

# Milestone 6 Candidate Retrieval Endpoints (Maintained for full backward compatibility)
@router.post("/retrieve-candidates", response_model=CandidateRetrievalResponse)
def retrieve_candidates(
    payload: CandidateRetrievalRequest,
    db: Session = Depends(get_db)
):
    try:
        result = retrieve_top_k_candidates(
            db=db,
            project_id=payload.project_id,
            raw_text=payload.raw_text,
            event_id=payload.event_id,
            schedule_version=payload.schedule_version,
            top_k=payload.top_k,
            discipline_filter=payload.discipline_filter,
            persist_candidates=True
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Candidate retrieval failed: {str(e)}")

@router.get("/candidates/{event_id}", response_model=CandidateRetrievalResponse)
def get_candidates_for_event(
    event_id: str,
    project_id: Optional[str] = Query("PRJ-REF-04"),
    schedule_version: Optional[str] = Query(None),
    top_k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    result = retrieve_top_k_candidates(
        db=db,
        project_id=project_id,
        event_id=event_id,
        schedule_version=schedule_version,
        top_k=top_k,
        persist_candidates=True
    )
    if not result.top_candidate and result.total_activities_searched == 0:
        raise HTTPException(status_code=404, detail="No schedule activities found to match against.")
    return result
