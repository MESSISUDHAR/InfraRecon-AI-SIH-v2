from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class ActivityResponse(BaseModel):
    id: str
    project_id: str
    schedule_version: str
    wbs_code: Optional[str] = None
    wbs_name: Optional[str] = None
    level: str = "L5"
    activity_id: str
    activity_code: Optional[str] = None
    activity_name: str
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset_id: Optional[str] = None
    line_id: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_finish: Optional[datetime] = None
    planned_duration: Optional[float] = None
    planned_progress: float = 0.0
    predecessor_ids: Optional[str] = None
    searchable_text: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ScheduleSummaryResponse(BaseModel):
    filename: Optional[str] = None
    project_id: str
    project_name: Optional[str] = None
    schedule_version: str
    total_activities: int
    disciplines: Dict[str, int]
    locations_count: int = 0
    validation_status: str = "VALIDATED"
    detected_columns: Optional[Dict[str, str]] = None
    warnings: List[str] = []

class ScheduleUploadResponse(BaseModel):
    success: bool
    message: str
    summary: Optional[ScheduleSummaryResponse] = None
    warnings: List[str] = []
    error: Optional[str] = None

class PaginatedActivitiesResponse(BaseModel):
    total: int
    page: int
    page_size: int
    activities: List[ActivityResponse]

# Milestone 5: Semantic Search Schemas
class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Natural language search query or extracted field event summary")
    project_id: str = Field("PRJ-REF-04", description="Target Project ID")
    schedule_version: Optional[str] = Field(None, description="Schedule version (defaults to active version)")
    top_k: int = Field(5, ge=1, le=50, description="Number of Top-K candidates to retrieve")
    discipline: Optional[str] = Field(None, description="Optional discipline filter (e.g. Piping, Civil, Electrical)")

class SemanticSearchMatch(BaseModel):
    rank: int
    activity_id: str
    id: str
    activity_name: str
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset_id: Optional[str] = None
    line_id: Optional[str] = None
    wbs_name: Optional[str] = None
    wbs_code: Optional[str] = None
    level: Optional[str] = "L5"
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    planned_progress: Optional[float] = 0.0
    semantic_score: float = Field(..., description="Cosine similarity score between 0.0 and 1.0")
    searchable_text: Optional[str] = None

class SemanticSearchResponse(BaseModel):
    success: bool
    query: str
    project_id: str
    schedule_version: Optional[str] = None
    total_candidates: int
    matches: List[SemanticSearchMatch]
