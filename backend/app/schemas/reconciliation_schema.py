from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ReconciliationWeights(BaseModel):
    semantic_weight: float = Field(0.40, ge=0.0, le=1.0, description="Weight for SentenceTransformers semantic similarity (default 40%)")
    identifier_weight: float = Field(0.20, ge=0.0, le=1.0, description="Weight for Asset / Line ID match (default 20%)")
    discipline_weight: float = Field(0.15, ge=0.0, le=1.0, description="Weight for Discipline alignment (default 15%)")
    location_weight: float = Field(0.10, ge=0.0, le=1.0, description="Weight for Location / Workfront match (default 10%)")
    wbs_weight: float = Field(0.10, ge=0.0, le=1.0, description="Weight for WBS / Context hierarchy consistency (default 10%)")
    temporal_weight: float = Field(0.05, ge=0.0, le=1.0, description="Weight for Temporal schedule window alignment (default 5%)")

class ReconciliationCandidate(BaseModel):
    rank: int = Field(..., description="Reconciliation rank (1 = Top match, 2 = 2nd, etc.)")
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

    # Component Scores (0.0 to 1.0)
    semantic_score: float = Field(..., description="Dense vector cosine similarity (0.0 to 1.0)")
    identifier_score: float = Field(..., description="Asset/Line identifier score (0.0 to 1.0)")
    discipline_score: float = Field(..., description="Discipline alignment score (0.0 to 1.0)")
    location_score: float = Field(..., description="Location alignment score (0.0 to 1.0)")
    wbs_score: float = Field(..., description="WBS / Context hierarchy score (0.0 to 1.0)")
    temporal_score: float = Field(..., description="Temporal schedule window score (0.0 to 1.0)")

    # Final Aggregated Multi-Signal Confidence
    final_confidence: float = Field(..., description="Weighted combined multi-signal confidence (0.0 to 1.0)")
    confidence_tier: str = Field("MEDIUM", description="HIGH (>=85%), MEDIUM (60-84%), or LOW (<60%)")
    is_top_match: bool = False

    # Explainability & Diagnostic Signals
    reasoning: str = Field(..., description="Human-readable explanation of why this activity matched")
    positive_signals: List[str] = Field(default_factory=list, description="List of positive supporting signals")
    conflicting_signals: List[str] = Field(default_factory=list, description="List of conflicting signals or risk flags")
    context_signals: Dict[str, Any] = Field(default_factory=dict, description="Raw signal metrics dictionary")

class ReconciliationRequest(BaseModel):
    event_id: Optional[str] = Field(None, description="ID of an existing ExecutionEvent in database")
    raw_text: Optional[str] = Field(None, description="Raw field report text if reconciling directly")
    project_id: str = Field("PRJ-REF-04", description="Target project ID")
    schedule_version: Optional[str] = Field(None, description="Target schedule version (defaults to project active version)")
    top_k: int = Field(5, ge=1, le=20, description="Number of candidate activities to return")
    weights: Optional[ReconciliationWeights] = Field(None, description="Custom configurable weights")
    discipline_filter: Optional[str] = Field(None, description="Optional discipline filter (e.g. ALL, Piping, Civil)")

class ReconciliationResponse(BaseModel):
    success: bool
    message: str
    event_id: Optional[str] = None
    source_id: Optional[str] = None
    project_id: str
    schedule_version: str
    raw_text: Optional[str] = None
    extracted_facts: Optional[Dict[str, Any]] = None
    weights_used: ReconciliationWeights
    top_candidate: Optional[ReconciliationCandidate] = None
    alternative_candidates: List[ReconciliationCandidate] = []
    total_candidates: int = 0
    total_activities_evaluated: int = 0
    execution_time_ms: float = 0.0
