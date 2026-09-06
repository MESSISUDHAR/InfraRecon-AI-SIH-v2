from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.review_schema import (
    ConfidencePolicyConfig,
    ReviewQueueResponse,
    ReviewApprovalRequest,
    ReviewRejectRequest,
    ReviewActionResponse,
    AutoProcessRequest,
    AutoProcessResponse
)
from app.services.review_service import (
    get_review_queue,
    approve_candidate_match,
    reject_candidate_match,
    auto_process_high_confidence_events,
    get_policy_config,
    update_policy_config
)

router = APIRouter(prefix="/review", tags=["Planner Review"])

@router.get("/status")
def review_status():
    policy = get_policy_config()
    return ApiResponse(
        success=True,
        message="Human-in-the-Loop planner review and confidence policy service operational (Milestone 8).",
        data={
            "milestone": 8,
            "policy": policy.model_dump(),
            "actions_supported": ["APPROVE", "SELECT_CANDIDATE", "REJECT", "AUTO_PROCESS"]
        }
    )

@router.get("/policy", response_model=ConfidencePolicyConfig)
def get_confidence_policy():
    """
    Returns current confidence policy thresholds.
    """
    return get_policy_config()

@router.post("/policy", response_model=ConfidencePolicyConfig)
def set_confidence_policy(new_policy: ConfidencePolicyConfig):
    """
    Updates confidence policy thresholds (e.g. High >= 85%, Medium >= 60%).
    """
    return update_policy_config(new_policy)

@router.get("/queue", response_model=ReviewQueueResponse)
def get_queue(
    project_id: str = Query("PRJ-REF-04"),
    status: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns the list of execution events held for planner review with full multi-signal breakdown.
    """
    try:
        return get_review_queue(
            db=db,
            project_id=project_id,
            status_filter=status,
            tier_filter=tier,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch review queue: {str(e)}")

@router.post("/approve", response_model=ReviewActionResponse)
def approve_match(
    payload: ReviewApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Planner approves candidate match -> commits verified state to ExecutionState and records in AuditLog.
    """
    try:
        return approve_candidate_match(
            db=db,
            event_id=payload.event_id,
            activity_id=payload.activity_id,
            reviewer_id=payload.reviewer_id,
            notes=payload.notes,
            override_progress=payload.override_progress,
            progress_mode=payload.progress_mode,
            mark_activity_completed=payload.mark_activity_completed,
            activity_actual_progress=payload.activity_actual_progress
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval action failed: {str(e)}")

@router.post("/select-candidate", response_model=ReviewActionResponse)
def select_candidate(
    payload: ReviewApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Planner overrides top match and selects an alternative candidate activity.
    """
    if not payload.activity_id:
        raise HTTPException(status_code=400, detail="activity_id must be provided when selecting alternative candidate.")
    try:
        return approve_candidate_match(
            db=db,
            event_id=payload.event_id,
            activity_id=payload.activity_id,
            reviewer_id=payload.reviewer_id,
            notes=payload.notes,
            override_progress=payload.override_progress,
            progress_mode=payload.progress_mode,
            mark_activity_completed=payload.mark_activity_completed,
            activity_actual_progress=payload.activity_actual_progress
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Candidate override failed: {str(e)}")

@router.post("/reject", response_model=ReviewActionResponse)
def reject_match(
    payload: ReviewRejectRequest,
    db: Session = Depends(get_db)
):
    """
    Planner marks event as REJECTED/UNMATCHED -> leaves ExecutionState completely untouched.
    """
    try:
        return reject_candidate_match(
            db=db,
            event_id=payload.event_id,
            reviewer_id=payload.reviewer_id,
            reason=payload.reason or "Unmatched / Rejected by Planner"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rejection action failed: {str(e)}")

@router.post("/auto-process", response_model=AutoProcessResponse)
def auto_process(
    payload: AutoProcessRequest,
    db: Session = Depends(get_db)
):
    """
    Batch processes all pending events that meet HIGH confidence threshold (>= 85%)
    without conflicting signals according to project rules.
    """
    try:
        return auto_process_high_confidence_events(
            db=db,
            project_id=payload.project_id,
            high_threshold=payload.high_threshold,
            reviewer_id=payload.reviewer_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-processing failed: {str(e)}")
