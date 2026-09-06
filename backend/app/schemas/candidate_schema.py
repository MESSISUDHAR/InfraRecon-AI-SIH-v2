from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any

class CandidateActivityDetail(BaseModel):
    rank: int = Field(..., description="Candidate rank (1 = Top match, 2 = 2nd, etc.)")
    activity_id: str = Field(..., description="Activity ID e.g. PIP-L5-034")
    id: str = Field(..., description="Unique database activity ID")
    activity_name: str = Field(..., description="Scheduled activity name")
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
    semantic_score: float = Field(..., description="Sentence Transformers dense vector cosine similarity (0.0 to 1.0)")
    is_top_match: bool = False
    context_signals: Dict[str, Any] = Field(default_factory=dict, description="Contextual dimension comparisons")

class CandidateRetrievalRequest(BaseModel):
    event_id: Optional[str] = Field(None, description="ID of an existing ExecutionEvent in database")
    raw_text: Optional[str] = Field(None, description="Raw text if retrieving directly without pre-ingested event")
    project_id: str = Field("PRJ-REF-04", description="Target project ID")
    schedule_version: Optional[str] = Field(None, description="Target schedule version (defaults to project active version)")
    top_k: int = Field(5, ge=1, le=20, description="Number of candidate activities to retrieve")
    discipline_filter: Optional[str] = Field(None, description="Optional discipline filter (e.g. ALL, Piping, Civil)")

class CandidateRetrievalResponse(BaseModel):
    success: bool
    message: str
    event_id: Optional[str] = None
    source_id: Optional[str] = None
    project_id: str
    schedule_version: str
    raw_text: Optional[str] = None
    extracted_facts: Optional[Dict[str, Any]] = None
    top_candidate: Optional[CandidateActivityDetail] = None
    alternative_candidates: List[CandidateActivityDetail] = []
    total_candidates: int = 0
    total_activities_searched: int = 0
    execution_time_ms: float = 0.0
