from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.historical_memory_schema import (
    HistoricalMemoryResponse,
    HistoricalMemorySearchRequest,
    HistoricalMemoryStatsResponse
)
from app.services.historical_memory_service import (
    search_historical_memory,
    get_historical_memory_stats,
    seed_demo_historical_memory
)

router = APIRouter(prefix="/historical-memory", tags=["Institutional Memory"])

@router.get("/status", response_model=ApiResponse)
def memory_status():
    """
    Status endpoint for Phase 4: Institutional Memory & Historical Execution Intelligence.
    """
    return ApiResponse(
        success=True,
        message="Phase 4: Institutional Memory / Historical Execution Intelligence service operational.",
        data={
            "phase": 4,
            "feature": "Institutional Memory",
            "model": "all-MiniLM-L6-v2 (384d)",
            "supported_actions": ["EVENT_RETRIEVAL", "SEMANTIC_SEARCH", "HISTORICAL_STATS", "DEMO_SEEDING"]
        }
    )

@router.get("/stats", response_model=HistoricalMemoryStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """
    Returns aggregate verified historical statistics for Leadership Dashboard.
    Strictly zero fabrication: aggregated directly from database verified execution records.
    """
    try:
        return get_historical_memory_stats(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical memory stats: {str(e)}")

@router.get("/{event_id}", response_model=HistoricalMemoryResponse)
def get_historical_memory_for_event(
    event_id: str,
    top_k: int = Query(5, ge=1, le=20),
    min_similarity: float = Query(0.50, ge=0.0, le=1.0),
    db: Session = Depends(get_db)
):
    """
    Retrieves Top-K verified historical execution events relevant to the given execution event.
    Only events with status == 'VERIFIED' enter institutional memory.
    """
    try:
        return search_historical_memory(
            db=db,
            event_id=event_id,
            top_k=top_k,
            min_similarity=min_similarity
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Historical memory retrieval failed: {str(e)}")

@router.post("/search", response_model=HistoricalMemoryResponse)
def search_memory(
    payload: HistoricalMemorySearchRequest,
    db: Session = Depends(get_db)
):
    """
    Ad-hoc search for verified historical execution evidence by raw text or extracted facts.
    """
    try:
        extracted = {}
        if payload.activity_description or payload.discipline or payload.location or payload.asset_id or payload.line_id:
            extracted = {
                "activity_description": payload.activity_description,
                "discipline": payload.discipline,
                "location": payload.location,
                "asset_id": payload.asset_id,
                "line_id": payload.line_id
            }
        
        return search_historical_memory(
            db=db,
            event_id=payload.event_id,
            raw_text=payload.raw_text,
            extracted_facts=extracted,
            project_id=payload.project_id,
            top_k=payload.top_k,
            min_similarity=payload.min_similarity
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Historical memory search failed: {str(e)}")

@router.post("/seed-demo", response_model=ApiResponse)
def seed_demo(db: Session = Depends(get_db)):
    """
    Seeds deterministic verified historical records from prior projects (PRJ-ALPHA, PRJ-BETA) for demo.
    """
    try:
        count = seed_demo_historical_memory(db)
        return ApiResponse(
            success=True,
            message=f"Successfully ensured {count} verified historical execution records in database.",
            data={"count": count}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed historical memory demo: {str(e)}")
