import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dependency_schema import (
    ProjectDependencyImpactSummary,
    ActivityDependencyDetail
)
from app.services.dependency_service import (
    analyze_activity_downstream_impact,
    get_project_dependency_impact_summary
)

logger = logging.getLogger("dependencies_api")

router = APIRouter(prefix="/dependencies", tags=["Milestone 12: Dependency Intelligence"])

@router.get("/status")
def get_dependency_intelligence_status():
    """
    Returns dependency intelligence engine status, traversal rules, and constraints.
    """
    return {
        "status": "operational",
        "milestone": "Milestone 12: Dependency Intelligence",
        "engine": "Deterministic Critical Path Method (CPM) Dependency Traversal",
        "features": [
            "Predecessor and successor schedule relationship parsing",
            "Float buffer calculation (Planned Start minus Predecessor Planned Finish)",
            "Multi-tier downstream cascade delay propagation",
            "Activity-level upstream and downstream graph inspection"
        ],
        "forecasting_claim": "None (Deterministic rule-based schedule impact analysis only)",
        "supported_relationship_types": ["FS", "SS", "FF", "SF"]
    }

@router.get("/impact-summary", response_model=ProjectDependencyImpactSummary)
def get_project_dependency_impact_summary_endpoint(
    project_id: str = Query("PRJ-REF-04", description="Target project identifier"),
    db: Session = Depends(get_db)
):
    """
    Returns project-wide downstream dependency impact analysis rollup.
    """
    try:
        return get_project_dependency_impact_summary(db=db, project_id=project_id)
    except Exception as e:
        logger.error(f"Error computing dependency summary for {project_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate dependency impact summary: {str(e)}")

@router.get("/activity/{activity_id}", response_model=ActivityDependencyDetail)
def get_activity_dependency_detail_endpoint(
    activity_id: str = Path(..., description="Activity ID or Code (e.g. PIP-L5-034)"),
    project_id: str = Query("PRJ-REF-04", description="Target project identifier"),
    db: Session = Depends(get_db)
):
    """
    Returns comprehensive dependency analysis for an activity, including upstream predecessors,
    immediate downstream successors, and multi-tier cascade impact.
    """
    try:
        return analyze_activity_downstream_impact(db=db, project_id=project_id, activity_id=activity_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error analyzing activity dependencies for {activity_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to analyze activity dependencies: {str(e)}")
