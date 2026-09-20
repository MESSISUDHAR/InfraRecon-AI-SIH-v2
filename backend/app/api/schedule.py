from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, or_

from app.database import get_db
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_state import ExecutionState
from app.services.schedule_parser import parse_schedule_file
from app.schemas.schedule_schema import (
    ActivityResponse,
    ScheduleSummaryResponse,
    ScheduleUploadResponse,
    PaginatedActivitiesResponse,
    SemanticSearchRequest,
    SemanticSearchResponse,
    SemanticSearchMatch
)
from app.schemas.common import ApiResponse
from app.services.embedding_service import search_top_k_activities, generate_embeddings_batch

router = APIRouter(prefix="/schedule", tags=["Schedule Management"])

@router.post("/upload", response_model=ScheduleUploadResponse)
async def upload_schedule(
    file: UploadFile = File(...),
    project_id: str = Form("PRJ-DEFAULT"),
    project_name: Optional[str] = Form(None),
    schedule_version: str = Form("v1.0"),
    db: Session = Depends(get_db)
):
    """
    Dynamically ingests, normalizes, validates, and stores a CSV or XLSX schedule.
    Creates project association and prepares searchable activity representations.
    """
    # 1. Read file bytes
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    # 2. Parse and normalize schedule file
    parse_result = parse_schedule_file(
        file_bytes=contents,
        filename=file.filename,
        project_id=project_id,
        schedule_version=schedule_version
    )

    if not parse_result.get("success"):
        return ScheduleUploadResponse(
            success=False,
            message=parse_result.get("error", "Schedule validation failed."),
            error=parse_result.get("error"),
            warnings=parse_result.get("warnings", [])
        )

    activities_data = parse_result.get("activities", [])
    summary_data = parse_result.get("summary", {})

    # 3. Create or update Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        proj_name = project_name or f"Project {project_id}"
        project = Project(
            id=project_id,
            name=proj_name,
            code=project_id,
            active_schedule_version=schedule_version
        )
        db.add(project)
        db.flush()
    else:
        project.active_schedule_version = schedule_version
        if project_name:
            project.name = project_name

    # 4. Insert or update activities in DB
    # Delete previous activities for this specific version to support re-uploading
    db.query(Activity).filter(
        Activity.project_id == project_id,
        Activity.schedule_version == schedule_version
    ).delete(synchronize_session=False)

    existing_state_act_ids = {
        row[0] for row in db.query(ExecutionState.activity_id).filter(
            ExecutionState.project_id == project_id
        ).all()
    }

    new_activities = []
    new_states = []

    for item in activities_data:
        activity = Activity(**item)
        new_activities.append(activity)

        # Check if ExecutionState already exists for this activity, else initialize
        if activity.id not in existing_state_act_ids:
            state = ExecutionState(
                id=f"state_{activity.id}",
                project_id=project_id,
                activity_id=activity.id,
                actual_progress=0.0,
                status="Not Started",
                approval_state="VERIFIED"
            )
            new_states.append(state)

    db.add_all(new_activities)
    db.add_all(new_states)
    db.commit()

    # Calculate distinct locations
    locations_count = len(set([a.get("location") for a in activities_data if a.get("location")]))

    summary_response = ScheduleSummaryResponse(
        filename=file.filename,
        project_id=project_id,
        project_name=project.name,
        schedule_version=schedule_version,
        total_activities=len(activities_data),
        disciplines=summary_data.get("disciplines", {}),
        locations_count=locations_count,
        validation_status="VALIDATED",
        detected_columns=summary_data.get("detected_columns", {}),
        warnings=parse_result.get("warnings", [])
    )

    return ScheduleUploadResponse(
        success=True,
        message=f"Successfully ingested {len(activities_data)} activities across {len(summary_data.get('disciplines', {}))} disciplines.",
        summary=summary_response,
        warnings=parse_result.get("warnings", [])
    )

@router.get("/activities", response_model=PaginatedActivitiesResponse)
def list_activities(
    project_id: Optional[str] = Query(None, description="Project ID"),
    schedule_version: Optional[str] = Query(None, description="Schedule Version (defaults to active)"),
    discipline: Optional[str] = Query(None, description="Filter by Discipline"),
    location: Optional[str] = Query(None, description="Filter by Location"),
    level: Optional[str] = Query(None, description="Filter by Level (e.g. L5, L6)"),
    search: Optional[str] = Query(None, description="Search term in name, code, asset, line"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    List, filter, and search ingested schedule activities dynamically.
    """
    query = db.query(Activity)

    # If project_id provided, filter; else use first active project if any
    if project_id:
        query = query.filter(Activity.project_id == project_id)
        if not schedule_version:
            proj = db.query(Project).filter(Project.id == project_id).first()
            if proj and proj.active_schedule_version:
                schedule_version = proj.active_schedule_version

    if schedule_version:
        query = query.filter(Activity.schedule_version == schedule_version)

    if discipline and discipline != "ALL":
        query = query.filter(Activity.discipline == discipline)

    if location:
        query = query.filter(Activity.location.ilike(f"%{location}%"))

    if level:
        query = query.filter(Activity.level == level)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Activity.activity_id.ilike(search_pattern),
                Activity.activity_name.ilike(search_pattern),
                Activity.line_id.ilike(search_pattern),
                Activity.asset_id.ilike(search_pattern),
                Activity.location.ilike(search_pattern),
                Activity.wbs_name.ilike(search_pattern)
            )
        )

    total = query.count()
    activities = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedActivitiesResponse(
        total=total,
        page=page,
        page_size=page_size,
        activities=activities
    )

@router.get("/summary", response_model=ApiResponse)
def get_schedule_summary(
    project_id: Optional[str] = Query(None),
    schedule_version: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns summary statistics for the active or selected schedule.
    """
    # Find project
    if not project_id:
        proj = db.query(Project).first()
        if not proj:
            return ApiResponse(
                success=True,
                message="No project created yet.",
                data={
                    "total_activities": 0,
                    "disciplines": {},
                    "locations_count": 0,
                    "active_schedule_version": "v1.0"
                }
            )
        project_id = proj.id
        schedule_version = proj.active_schedule_version
    else:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if proj and not schedule_version:
            schedule_version = proj.active_schedule_version

    activities_query = db.query(Activity).filter(Activity.project_id == project_id)
    if schedule_version:
        activities_query = activities_query.filter(Activity.schedule_version == schedule_version)

    total = activities_query.count()

    # Discipline breakdown
    discipline_counts = (
        db.query(Activity.discipline, func.count(Activity.id))
        .filter(Activity.project_id == project_id)
        .group_by(Activity.discipline)
        .all()
    )
    disciplines_dict = {d or "General": c for d, c in discipline_counts}

    # Location count
    locations_count = (
        db.query(func.count(distinct(Activity.location)))
        .filter(Activity.project_id == project_id, Activity.location != None)
        .scalar()
    ) or 0

    return ApiResponse(
        success=True,
        message="Schedule summary retrieved.",
        data={
            "project_id": project_id,
            "project_name": proj.name if proj else None,
            "active_schedule_version": schedule_version,
            "total_activities": total,
            "disciplines": disciplines_dict,
            "locations_count": locations_count
        }
    )

@router.get("/versions", response_model=ApiResponse)
def list_schedule_versions(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List all uploaded schedule versions for a project.
    """
    query = db.query(distinct(Activity.schedule_version))
    if project_id:
        query = query.filter(Activity.project_id == project_id)
        
    versions = [v[0] for v in query.all() if v[0]]
    return ApiResponse(
        success=True,
        message="Schedule versions retrieved.",
        data=versions or ["v1.0"]
    )

@router.post("/semantic-search", response_model=SemanticSearchResponse)
def semantic_search_activities(
    payload: SemanticSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Milestone 5: Dense vector semantic search using Sentence Transformers.
    Retrieves Top-K candidate schedule activities ranked by cosine similarity.
    """
    matches = search_top_k_activities(
        query_text=payload.query,
        project_id=payload.project_id,
        schedule_version=payload.schedule_version,
        top_k=payload.top_k,
        discipline_filter=payload.discipline,
        db=db
    )

    return SemanticSearchResponse(
        success=True,
        query=payload.query,
        project_id=payload.project_id,
        schedule_version=payload.schedule_version,
        total_candidates=len(matches),
        matches=[SemanticSearchMatch(**m) for m in matches]
    )

@router.post("/generate-embeddings", response_model=ApiResponse)
def generate_all_activity_embeddings(
    project_id: str = Query("PRJ-REF-04"),
    schedule_version: Optional[str] = Query(None),
    force_recompute: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Generates Sentence Transformers dense vector embeddings for schedule activities.
    """
    import json
    query = db.query(Activity).filter(Activity.project_id == project_id)
    if schedule_version:
        query = query.filter(Activity.schedule_version == schedule_version)
    if not force_recompute:
        query = query.filter((Activity.embedding_json == None) | (Activity.embedding_json == ""))

    activities = query.all()
    if not activities:
        return ApiResponse(
            success=True,
            message="All activities already have vector embeddings.",
            data={"count": 0}
        )

    import gc
    texts = [a.searchable_text or f"{a.activity_name} {a.discipline or ''} {a.location or ''}" for a in activities]
    embeddings = generate_embeddings_batch(texts, chunk_size=16)
    
    for act, emb in zip(activities, embeddings):
        act.embedding = emb
        act.embedding_json = json.dumps(emb)

    del texts
    del embeddings
    gc.collect()

    db.commit()

    return ApiResponse(
        success=True,
        message=f"Successfully generated vector embeddings for {len(activities)} activities.",
        data={"count": len(activities), "dimensions": 384}
    )

