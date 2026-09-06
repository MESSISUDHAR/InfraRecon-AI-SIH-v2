import uuid
import io
import csv
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db
from app.models.project import Project
from app.models.execution_event import ExecutionEvent
from app.schemas.common import ApiResponse
from app.schemas.execution_schema import (
    ExecutionEventCreate,
    ExtractedExecutionData,
    ExecutionEventResponse,
    ExecutionExtractionRequest,
    ExecutionExtractionResponse,
    PaginatedExecutionEventsResponse,
    ExecutionEventSubmitResponse,
    ExecutionEventBatchUploadResponse
)
from app.services.extractor_service import extract_execution_event_with_gemini

router = APIRouter(prefix="/execution-events", tags=["Execution Events"])

@router.get("/status")
def execution_status():
    return ApiResponse(
        success=True,
        message="Execution events extraction service operational (Gemini 2.5 Flash Layer).",
        data={"milestone": 4, "model": "gemini-2.5-flash"}
    )

def ensure_project_exists(db: Session, project_id: str, project_name: Optional[str] = None) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        project = Project(
            id=project_id,
            name=project_name or f"Project {project_id}",
            code=project_id,
            active_schedule_version="v1.0"
        )
        db.add(project)
        db.flush()
    return project

@router.post("/submit", response_model=ExecutionEventSubmitResponse)
def submit_execution_event(
    payload: ExecutionEventCreate,
    db: Session = Depends(get_db)
):
    """
    Submits a single raw field observation / DPR text report.
    Stores raw evidence cleanly isolated from verified project execution state.
    """
    ensure_project_exists(db, payload.project_id)

    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    now_utc = datetime.now(timezone.utc)
    
    source_id = payload.source_id
    if not source_id or not source_id.strip():
        date_tag = (payload.report_date or now_utc).strftime("%Y%m%d")
        source_id = f"DPR-{date_tag}-{event_id[-4:].upper()}"

    event = ExecutionEvent(
        id=event_id,
        project_id=payload.project_id,
        source_id=source_id.strip(),
        source_type=payload.source_type or "DPR_TEXT",
        source_reference=payload.source_reference,
        reporter_name=payload.reporter_name,
        report_date=payload.report_date or now_utc,
        raw_text=payload.raw_text.strip(),
        status="INGESTED",
        extraction_confidence=1.0,
        model_version="gemini-2.5-flash",
        prompt_version="v1.0",
        ingestion_timestamp=now_utc
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return ExecutionEventSubmitResponse(
        success=True,
        message=f"Raw field evidence successfully ingested with ID {source_id}.",
        event=ExecutionEventResponse.model_validate(event)
    )

@router.post("/extract", response_model=ExecutionExtractionResponse)
def extract_execution_facts(
    payload: ExecutionExtractionRequest,
    db: Session = Depends(get_db)
):
    """
    Milestone 4: Uses Gemini 2.5 Flash to extract structured facts from raw field text.
    Validates output with Pydantic ExtractedExecutionData schema.
    Strictly isolated: does NOT select schedule activities and does NOT modify verified execution state.
    """
    # 1. Run Gemini 2.5 Flash structured extraction
    extracted_data, elapsed_ms, warnings = extract_execution_event_with_gemini(
        raw_text=payload.raw_text,
        project_id=payload.project_id,
        source_id=payload.source_id
    )

    event_record = None
    now_utc = datetime.now(timezone.utc)

    # Milestone 5: Compute dense embedding for the extracted execution event
    import json
    from app.services.embedding_service import generate_embedding
    summary_text = f"{extracted_data.activity_description or ''} {extracted_data.discipline or ''} {extracted_data.location or ''} {extracted_data.line_id or ''} {extracted_data.asset_id or ''}".strip()
    event_embedding = generate_embedding(summary_text or payload.raw_text)
    embedding_str = json.dumps(event_embedding)

    # 2. Update existing event or optionally persist as new EXTRACTED event
    if payload.event_id:
        existing_event = db.query(ExecutionEvent).filter(ExecutionEvent.id == payload.event_id).first()
        if existing_event:
            existing_event.activity_description = extracted_data.activity_description
            existing_event.discipline = extracted_data.discipline
            existing_event.location = extracted_data.location
            existing_event.asset_id = extracted_data.asset_id
            existing_event.line_id = extracted_data.line_id
            existing_event.event_type = extracted_data.event_type
            existing_event.actual_start = extracted_data.actual_start
            existing_event.actual_finish = extracted_data.actual_finish
            existing_event.event_progress = extracted_data.progress
            existing_event.delay_reason = extracted_data.delay_reason
            existing_event.evidence_text = extracted_data.evidence_text
            existing_event.extraction_confidence = extracted_data.extraction_confidence
            existing_event.embedding_json = embedding_str
            existing_event.status = "EXTRACTED"
            existing_event.model_version = "gemini-2.5-flash"
            existing_event.prompt_version = "v1.0"
            db.commit()
            db.refresh(existing_event)
            event_record = ExecutionEventResponse.model_validate(existing_event)
    elif payload.save_to_db:
        ensure_project_exists(db, payload.project_id or "PRJ-REF-04")
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        source_id = payload.source_id or f"DPR-{now_utc.strftime('%Y%m%d')}-{event_id[-4:].upper()}"
        
        new_event = ExecutionEvent(
            id=event_id,
            project_id=payload.project_id or "PRJ-REF-04",
            source_id=source_id,
            source_type=payload.source_type or "DPR_TEXT",
            source_reference=f"Extracted from field text",
            reporter_name=payload.reporter_name,
            report_date=payload.report_date or now_utc,
            raw_text=payload.raw_text.strip(),
            activity_description=extracted_data.activity_description,
            discipline=extracted_data.discipline,
            location=extracted_data.location,
            asset_id=extracted_data.asset_id,
            line_id=extracted_data.line_id,
            event_type=extracted_data.event_type,
            actual_start=extracted_data.actual_start,
            actual_finish=extracted_data.actual_finish,
            event_progress=extracted_data.progress,
            delay_reason=extracted_data.delay_reason,
            evidence_text=extracted_data.evidence_text,
            extraction_confidence=extracted_data.extraction_confidence,
            embedding_json=embedding_str,
            status="EXTRACTED",
            model_version="gemini-2.5-flash",
            prompt_version="v1.0",
            ingestion_timestamp=now_utc
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        event_record = ExecutionEventResponse.model_validate(new_event)

    return ExecutionExtractionResponse(
        success=True,
        message="Structured ExecutionEvent successfully extracted via Gemini 2.5 Flash Layer.",
        raw_text=payload.raw_text,
        extracted_data=extracted_data,
        event=event_record,
        model_version="gemini-2.5-flash",
        prompt_version="v1.0",
        execution_time_ms=elapsed_ms,
        warnings=warnings
    )

@router.post("/{event_id}/extract", response_model=ExecutionExtractionResponse)
def extract_event_by_id(
    event_id: str,
    db: Session = Depends(get_db)
):
    """
    Extracts structured facts for an already ingested ExecutionEvent using Gemini 2.5 Flash.
    """
    event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Execution event not found.")

    extracted_data, elapsed_ms, warnings = extract_execution_event_with_gemini(
        raw_text=event.raw_text,
        project_id=event.project_id,
        source_id=event.source_id
    )

    import json
    from app.services.embedding_service import generate_embedding
    summary_text = f"{extracted_data.activity_description or ''} {extracted_data.discipline or ''} {extracted_data.location or ''} {extracted_data.line_id or ''} {extracted_data.asset_id or ''}".strip()
    event_embedding = generate_embedding(summary_text or event.raw_text)

    event.activity_description = extracted_data.activity_description
    event.discipline = extracted_data.discipline
    event.location = extracted_data.location
    event.asset_id = extracted_data.asset_id
    event.line_id = extracted_data.line_id
    event.event_type = extracted_data.event_type
    event.actual_start = extracted_data.actual_start
    event.actual_finish = extracted_data.actual_finish
    event.event_progress = extracted_data.progress
    event.delay_reason = extracted_data.delay_reason
    event.evidence_text = extracted_data.evidence_text
    event.extraction_confidence = extracted_data.extraction_confidence
    event.embedding_json = json.dumps(event_embedding)
    event.status = "EXTRACTED"
    event.model_version = "gemini-2.5-flash"
    event.prompt_version = "v1.0"
    
    db.commit()
    db.refresh(event)

    return ExecutionExtractionResponse(
        success=True,
        message=f"Event {event.source_id or event_id} extracted successfully.",
        raw_text=event.raw_text,
        extracted_data=extracted_data,
        event=ExecutionEventResponse.model_validate(event),
        model_version="gemini-2.5-flash",
        prompt_version="v1.0",
        execution_time_ms=elapsed_ms,
        warnings=warnings
    )

@router.post("/upload", response_model=ExecutionEventBatchUploadResponse)
async def upload_execution_file(
    file: UploadFile = File(...),
    project_id: str = Form("PRJ-REF-04"),
    source_type: Optional[str] = Form("FILE_UPLOAD"),
    reporter_name: Optional[str] = Form(None),
    report_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Uploads raw DPR or field notes text file (.txt, .log, .csv, .dpr, .md)
    and stores raw evidence entries in the database.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    ensure_project_exists(db, project_id)

    parsed_date = None
    if report_date:
        try:
            parsed_date = datetime.fromisoformat(report_date)
        except Exception:
            pass
    if not parsed_date:
        parsed_date = datetime.now(timezone.utc)

    filename_lower = file.filename.lower()
    created_events: List[ExecutionEvent] = []
    now_utc = datetime.now(timezone.utc)

    try:
        decoded_text = contents.decode("utf-8")
    except UnicodeDecodeError:
        decoded_text = contents.decode("latin-1", errors="ignore")

    if filename_lower.endswith(".csv"):
        csv_reader = csv.DictReader(io.StringIO(decoded_text))
        row_idx = 1
        for row in csv_reader:
            text_val = (
                row.get("text") or 
                row.get("raw_text") or 
                row.get("description") or 
                row.get("report") or 
                row.get("dpr_text") or 
                row.get("observation") or 
                ""
            ).strip()

            if not text_val:
                non_empty = [f"{k}: {v}" for k, v in row.items() if v and k]
                text_val = " | ".join(non_empty).strip()

            if not text_val:
                continue

            row_source_id = row.get("source_id") or row.get("dpr_id") or f"DPR-CSV-{row_idx:03d}"
            row_reporter = row.get("reporter") or row.get("reporter_name") or reporter_name
            
            event_id = f"evt_{uuid.uuid4().hex[:12]}"
            event = ExecutionEvent(
                id=event_id,
                project_id=project_id,
                source_id=row_source_id,
                source_type="CSV_BATCH",
                source_reference=file.filename,
                reporter_name=row_reporter,
                report_date=parsed_date,
                raw_text=text_val,
                status="INGESTED",
                extraction_confidence=1.0,
                model_version="gemini-2.5-flash",
                prompt_version="v1.0",
                ingestion_timestamp=now_utc
            )
            created_events.append(event)
            row_idx += 1
    else:
        sections = [s.strip() for s in decoded_text.replace("\r\n", "\n").split("\n---\n") if s.strip()]
        if len(sections) <= 1:
            event_id = f"evt_{uuid.uuid4().hex[:12]}"
            date_tag = parsed_date.strftime("%Y%m%d")
            source_id = f"DPR-FILE-{date_tag}-{event_id[-4:].upper()}"
            event = ExecutionEvent(
                id=event_id,
                project_id=project_id,
                source_id=source_id,
                source_type=source_type or "FILE_UPLOAD",
                source_reference=file.filename,
                reporter_name=reporter_name,
                report_date=parsed_date,
                raw_text=decoded_text.strip(),
                status="INGESTED",
                extraction_confidence=1.0,
                model_version="gemini-2.5-flash",
                prompt_version="v1.0",
                ingestion_timestamp=now_utc
            )
            created_events.append(event)
        else:
            for idx, sec in enumerate(sections, 1):
                event_id = f"evt_{uuid.uuid4().hex[:12]}"
                source_id = f"DPR-SEC-{idx:02d}-{event_id[-4:].upper()}"
                event = ExecutionEvent(
                    id=event_id,
                    project_id=project_id,
                    source_id=source_id,
                    source_type=source_type or "FILE_UPLOAD",
                    source_reference=f"{file.filename}#sec{idx}",
                    reporter_name=reporter_name,
                    report_date=parsed_date,
                    raw_text=sec,
                    status="INGESTED",
                    extraction_confidence=1.0,
                    model_version="gemini-2.5-flash",
                    prompt_version="v1.0",
                    ingestion_timestamp=now_utc
                )
                created_events.append(event)

    if not created_events:
        raise HTTPException(status_code=400, detail="No readable field evidence text found in the uploaded file.")

    db.add_all(created_events)
    db.commit()
    for e in created_events:
        db.refresh(e)

    return ExecutionEventBatchUploadResponse(
        success=True,
        message=f"Successfully ingested {len(created_events)} field report entries from {file.filename}.",
        count=len(created_events),
        events=[ExecutionEventResponse.model_validate(e) for e in created_events]
    )

@router.get("", response_model=PaginatedExecutionEventsResponse)
def list_execution_events(
    project_id: Optional[str] = Query(None, description="Filter by Project ID"),
    source_type: Optional[str] = Query(None, description="Filter by Source Type (e.g. DPR_TEXT, FILE_UPLOAD, CSV_BATCH)"),
    status: Optional[str] = Query(None, description="Filter by Status (e.g. INGESTED, EXTRACTED)"),
    search: Optional[str] = Query(None, description="Search term in raw text, source_id, reporter, or reference"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Lists submitted raw execution events for a project with sorting and pagination.
    """
    query = db.query(ExecutionEvent)

    if project_id:
        query = query.filter(ExecutionEvent.project_id == project_id)

    if source_type and source_type != "ALL":
        query = query.filter(ExecutionEvent.source_type == source_type)

    if status and status != "ALL":
        query = query.filter(ExecutionEvent.status == status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ExecutionEvent.raw_text.ilike(term),
                ExecutionEvent.source_id.ilike(term),
                ExecutionEvent.reporter_name.ilike(term),
                ExecutionEvent.source_reference.ilike(term)
            )
        )

    total = query.count()
    events = (
        query.order_by(desc(ExecutionEvent.ingestion_timestamp), desc(ExecutionEvent.report_date))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedExecutionEventsResponse(
        total=total,
        page=page,
        page_size=page_size,
        events=[ExecutionEventResponse.model_validate(e) for e in events]
    )

@router.get("/{event_id}", response_model=ExecutionEventResponse)
def get_execution_event(
    event_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves a single execution event by ID.
    """
    event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Execution event not found.")
    return ExecutionEventResponse.model_validate(event)

@router.delete("/{event_id}", response_model=ApiResponse)
def delete_execution_event(
    event_id: str,
    db: Session = Depends(get_db)
):
    """
    Deletes an execution event record.
    """
    event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Execution event not found.")
    
    db.delete(event)
    db.commit()
    return ApiResponse(
        success=True,
        message=f"Execution event {event_id} deleted successfully."
    )
