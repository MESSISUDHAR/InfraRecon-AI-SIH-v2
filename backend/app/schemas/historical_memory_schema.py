from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class HistoricalMemoryResult(BaseModel):
    historical_event_id: str
    project_id: str
    project_name: Optional[str] = None
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    activity_code: Optional[str] = None
    description: Optional[str] = None
    raw_text: Optional[str] = None
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset_id: Optional[str] = None
    line_id: Optional[str] = None
    event_type: Optional[str] = None
    
    # Verified Actual Outcomes
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    actual_progress: Optional[float] = None
    duration_days: Optional[float] = None
    delay_days: Optional[float] = None
    delay_reason: Optional[str] = None
    verification_status: str = "VERIFIED"
    verification_timestamp: Optional[str] = None
    reviewer_id: Optional[str] = None
    evidence_text: Optional[str] = None
    source_reference: Optional[str] = None
    
    # Similarity and Explainability
    similarity: float = Field(..., description="Overall combined similarity score [0.0 - 1.0]")
    semantic_similarity: float = Field(..., description="Dense embedding cosine similarity")
    matched_signals: List[str] = Field(default_factory=list, description="Human-explainable matching signals")
    is_same_project: bool = False

class HistoricalMemoryResponse(BaseModel):
    success: bool = True
    message: str
    event_id: Optional[str] = None
    query_description: Optional[str] = None
    total_historical_verified_searched: int = 0
    total_results: int = 0
    results: List[HistoricalMemoryResult] = Field(default_factory=list)
    historical_delay_summary: Optional[str] = None

class HistoricalMemorySearchRequest(BaseModel):
    event_id: Optional[str] = None
    raw_text: Optional[str] = None
    project_id: Optional[str] = None
    activity_description: Optional[str] = None
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset_id: Optional[str] = None
    line_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)
    min_similarity: float = Field(default=0.50, ge=0.0, le=1.0)

class TopDelayReasonMetric(BaseModel):
    reason: str
    count: int
    disciplines: List[str] = Field(default_factory=list)

class HistoricalMemoryStatsResponse(BaseModel):
    success: bool = True
    total_verified_historical_events: int
    verified_events_with_delays: int
    delay_incidence_rate: float
    projects_count: int
    disciplines_count: int
    top_delay_reasons: List[TopDelayReasonMetric] = Field(default_factory=list)
