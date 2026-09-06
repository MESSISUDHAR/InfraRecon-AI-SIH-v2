from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.common import ApiResponse
from app.schemas.audit_schema import (
    AuditLogListResponse,
    AuditLogDetailResponse,
    AuditStatsResponse
)
from app.services.audit_service import (
    get_audit_logs,
    build_audit_lineage_detail,
    get_audit_stats
)

router = APIRouter(prefix="/audit", tags=["Evidence & Audit Trail"])

@router.get("/status")
def audit_status():
    return ApiResponse(
        success=True,
        message="Explainable Evidence and Audit Trail service operational (Milestone 10).",
        data={
            "milestone": 10,
            "lineage_stages": [
                "1. Field Evidence (Source, Date, Raw Text)",
                "2. AI Extraction (Gemini 2.5 Flash, Grounding Quote)",
                "3. Candidate Retrieval (Sentence Transformers Dense Vectors)",
                "4. Context Reconciliation (6-Signal Scoring Matrix)",
                "5. Confidence & Signals (Tiers, Positive & Conflicting Flags)",
                "6. Human Decision Gate (Reviewer ID, Mode, Justification)",
                "7. Verified State Update (Before/After Diff, Delay Analysis)"
            ]
        }
    )

@router.get("/stats", response_model=AuditStatsResponse)
def get_stats(
    project_id: str = Query("PRJ-REF-04", description="Target project ID"),
    db: Session = Depends(get_db)
):
    """
    Returns high-level governance and compliance audit metrics.
    """
    try:
        return get_audit_stats(db=db, project_id=project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit stats: {str(e)}")

@router.get("/logs", response_model=AuditLogListResponse)
def list_audit_logs(
    project_id: str = Query("PRJ-REF-04", description="Target project ID"),
    action_type: Optional[str] = Query(None, description="Action type filter (PLANNER_APPROVAL, PLANNER_OVERRIDE, AUTO_APPROVAL, REJECTION)"),
    activity_id: Optional[str] = Query(None, description="Activity ID filter"),
    event_id: Optional[str] = Query(None, description="Event ID filter"),
    performed_by: Optional[str] = Query(None, description="Reviewer / Performed by filter"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns filtered and paginated list of audit events.
    """
    try:
        return get_audit_logs(
            db=db,
            project_id=project_id,
            action_type=action_type,
            activity_id=activity_id,
            event_id=event_id,
            performed_by=performed_by,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list audit logs: {str(e)}")

@router.get("/logs/{audit_id}", response_model=AuditLogDetailResponse)
def get_audit_log_detail(
    audit_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves the complete 7-stage end-to-end explainability lineage for a specific audit record.
    """
    aud = db.query(AuditLog).filter(AuditLog.id == audit_id).first()
    if not aud:
        raise HTTPException(status_code=404, detail=f"AuditLog record with ID '{audit_id}' not found.")
    
    try:
        lineage = build_audit_lineage_detail(aud=aud, db=db)
        return AuditLogDetailResponse(success=True, data=lineage)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to construct audit lineage: {str(e)}")
