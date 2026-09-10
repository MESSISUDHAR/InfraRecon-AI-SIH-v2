from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime

class ExecutionEventCreate(BaseModel):
    project_id: str = Field(..., description="Target Project ID")
    raw_text: str = Field(..., min_length=3, description="Raw unstructured field report or DPR text")
    source_id: Optional[str] = Field(None, description="Report identifier, e.g. DPR-2026-09-06-01")
    source_type: Optional[str] = Field("DPR_TEXT", description="DPR_TEXT, FILE_UPLOAD, SITE_DIARY, SUPERVISOR_LOG, CSV_BATCH")
    source_reference: Optional[str] = Field(None, description="Original filename or document reference")
    reporter_name: Optional[str] = Field(None, description="Reporting supervisor or engineer name")
    report_date: Optional[datetime] = Field(None, description="Date of the field observation")

class ExtractedExecutionData(BaseModel):
    """
    Structured execution facts extracted by Gemini 2.5 Flash from raw field text.
    Must ONLY contain facts grounded in the source text.
    """
    activity_description: Optional[str] = Field(None, description="Core activity action and object, e.g., '24-inch spool erection'")
    discipline: Optional[str] = Field(None, description="Engineering discipline: Piping, Civil, Electrical, Mechanical, Instrumentation, Trackwork, Structural, General")
    location: Optional[str] = Field(None, description="Physical site location, area, zone, bay, e.g. 'PR-04', 'Zone 3', 'Compressor Bay 2'")
    asset_id: Optional[str] = Field(None, description="Asset tag or equipment ID if explicitly mentioned, null if absent")
    line_id: Optional[str] = Field(None, description="Piping line number or circuit ID if explicitly mentioned, null if absent")
    event_type: str = Field("progress", description="Event category: progress, completion, delay, inspection, milestone")
    actual_start: Optional[datetime] = Field(None, description="Explicitly mentioned start timestamp/date, null if absent")
    actual_finish: Optional[datetime] = Field(None, description="Explicitly mentioned finish timestamp/date, null if absent")
    progress: Optional[float] = Field(None, ge=0.0, le=100.0, description="Explicit progress percentage (0.0 to 100.0) if mentioned, 100.0 if completed, null if unknown")
    status: str = Field("EXTRACTED", description="Status of the extraction: EXTRACTED, INGESTED, DELAYED")
    delay_reason: Optional[str] = Field(None, description="Reason for delay or blockage if mentioned, null if absent")
    evidence_text: Optional[str] = Field(None, description="Verbatim quote from raw text directly supporting the extraction")
    extraction_confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score of the extraction between 0.0 and 1.0")

class ExecutionEventResponse(BaseModel):
    id: str
    project_id: str
    source_id: Optional[str] = None
    source_type: Optional[str] = "DPR_TEXT"
    source_reference: Optional[str] = None
    reporter_name: Optional[str] = None
    report_date: Optional[datetime] = None
    raw_text: str
    activity_description: Optional[str] = None
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset_id: Optional[str] = None
    line_id: Optional[str] = None
    event_type: Optional[str] = "progress"
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None
    event_progress: Optional[float] = None
    status: str = "INGESTED"
    delay_reason: Optional[str] = None
    evidence_text: Optional[str] = None
    extraction_confidence: Optional[float] = 1.0
    model_version: Optional[str] = "gemini-2.5-flash"
    prompt_version: Optional[str] = "v1.0"
    ingestion_timestamp: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ExecutionExtractionRequest(BaseModel):
    raw_text: str = Field(..., min_length=3, description="Raw field text to extract with Gemini 2.5 Flash")
    project_id: Optional[str] = Field("PRJ-REF-04", description="Project ID")
    source_id: Optional[str] = Field(None, description="Source report identifier")
    event_id: Optional[str] = Field(None, description="Existing ExecutionEvent ID if extracting an already ingested record")
    source_type: Optional[str] = Field("DPR_TEXT", description="Source type")
    reporter_name: Optional[str] = Field(None, description="Reporter name")
    report_date: Optional[datetime] = Field(None, description="Report date")
    save_to_db: bool = Field(True, description="Whether to persist or update the ExecutionEvent in the database")

class ExecutionExtractionResponse(BaseModel):
    success: bool
    message: str
    raw_text: str
    extracted_data: ExtractedExecutionData
    event: Optional[ExecutionEventResponse] = None
    engine: str = Field("heuristic_fallback", description="Engine that performed extraction: 'gemini' | 'heuristic_fallback'")
    model_version: str = "gemini-2.5-flash"
    prompt_version: str = "v1.0"
    execution_time_ms: Optional[float] = None
    warnings: List[str] = []

class PaginatedExecutionEventsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    events: List[ExecutionEventResponse]

class ExecutionEventSubmitResponse(BaseModel):
    success: bool
    message: str
    event: Optional[ExecutionEventResponse] = None

class ExecutionEventBatchUploadResponse(BaseModel):
    success: bool
    message: str
    count: int = 0
    events: List[ExecutionEventResponse] = []
    warnings: List[str] = []
