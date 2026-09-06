import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dashboard_schema import DashboardSummaryResponse
from app.services.dashboard_service import get_dashboard_summary

logger = logging.getLogger("dashboard_api")

router = APIRouter(prefix="/dashboard", tags=["Milestone 11: Project Intelligence Dashboard"])

@router.get("/status")
def get_dashboard_status():
    """
    Returns dashboard subsystem health, chart engines, and supported metric streams.
    """
    return {
        "status": "operational",
        "milestone": "Milestone 11: Project Intelligence Dashboard",
        "features": [
            "Real-time Planned vs Actual S-Curve progress calculation",
            "Discipline-level variance analytics",
            "Status distribution breakdown",
            "Critical delayed activity tracking with baseline vs actual dates",
            "Dynamic refresh on planner reconciliation updates"
        ],
        "zero_fabrication": True,
        "supported_charts": ["s_curve_area", "discipline_bars", "status_donut", "review_funnel"]
    }

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary_endpoint(
    project_id: str = Query("PRJ-REF-04", description="Target project identifier"),
    db: Session = Depends(get_db)
):
    """
    Returns comprehensive real-time dashboard data computed from actual application database.
    """
    try:
        return get_dashboard_summary(db=db, project_id=project_id)
    except Exception as e:
        logger.error(f"Error generating dashboard summary for {project_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard summary: {str(e)}")
