from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.execution_state_schema import (
    ExecutionStateSummaryResponse,
    ExecutionStateListResponse,
    ExecutionStateDetailResponse
)
from app.services.execution_state_service import (
    get_project_execution_summary,
    get_project_execution_states,
    get_activity_execution_state_detail
)

router = APIRouter(prefix="/execution-state", tags=["Verified Execution State"])

@router.get("/status")
def execution_state_status():
    return ApiResponse(
        success=True,
        message="Verified Execution State engine operational (Milestone 9).",
        data={
            "milestone": 9,
            "features": [
                "Separation of Raw Extraction vs Verified Activity Progress",
                "Monotonic Cumulative Progress & Sub-Work Semantics",
                "Multi-Observation Activity Mapping & History Timeline",
                "Schedule Baseline Delay & Variance Analysis",
                "Atomic Transaction Consistency & Audit Trail Retention"
            ]
        }
    )

@router.get("/summary", response_model=ExecutionStateSummaryResponse)
def get_summary(
    project_id: str = Query("PRJ-REF-04", description="Target project ID"),
    db: Session = Depends(get_db)
):
    """
    Returns executive project-level performance rollups:
    Planned vs Actual Progress %, Completed / In-Progress / Delayed activity counts, and total verified observations.
    """
    try:
        summary_data = get_project_execution_summary(db=db, project_id=project_id)
        return ExecutionStateSummaryResponse(success=True, data=summary_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch execution summary: {str(e)}")

@router.get("/list", response_model=ExecutionStateListResponse)
def list_execution_states(
    project_id: str = Query("PRJ-REF-04", description="Target project ID"),
    discipline: Optional[str] = Query(None, description="Discipline filter (e.g. Piping, Civil)"),
    status: Optional[str] = Query(None, description="Status filter (Not Started, In Progress, Completed, Behind Schedule, DELAYED)"),
    search: Optional[str] = Query(None, description="Keyword search query"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns list of all activities with verified execution states, schedule baselines, and variance metrics.
    """
    try:
        return get_project_execution_states(
            db=db,
            project_id=project_id,
            discipline=discipline,
            status=status,
            search=search,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list execution states: {str(e)}")

@router.get("/activity/{activity_id}", response_model=ExecutionStateDetailResponse)
def get_activity_detail(
    activity_id: str,
    project_id: str = Query("PRJ-REF-04", description="Target project ID"),
    db: Session = Depends(get_db)
):
    """
    Retrieves complete verified state for an individual activity, including full chronological
    timeline of all contributing observations (raw text, event progress, reviewer notes, and audit lineage).
    """
    try:
        detail_data = get_activity_execution_state_detail(
            db=db,
            project_id=project_id,
            activity_id=activity_id
        )
        return ExecutionStateDetailResponse(success=True, data=detail_data)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity detail: {str(e)}")
