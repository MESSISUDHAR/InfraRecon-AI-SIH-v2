from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class ObservationHistoryItem(BaseModel):
    """
    Individual field observation linked to an activity execution state.
    Distinguishes raw event-level progress from cumulative activity progress.
    """
    event_id: str
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    report_date: Optional[str] = None
    raw_text: str
    evidence_text: Optional[str] = None
    event_progress: Optional[float] = None # Raw observation progress (e.g. 100% of sub-pour)
    progress_mode: str = "CUMULATIVE_ACTIVITY" # CUMULATIVE_ACTIVITY, SUB_WORK, EXPLICIT_COMPLETION
    is_activity_complete: bool = False
    resulting_activity_progress: float # Verified overall activity progress after this observation
    reviewer_id: str
    approval_timestamp: str
    notes: Optional[str] = None

class ActivityExecutionStateItem(BaseModel):
    """
    Verified execution state for a schedule activity.
    """
    activity_id: str # Activity code (e.g. PIP-L5-034)
    db_id: str # UUID
    project_id: str
    activity_name: str
    discipline: Optional[str] = None
    location: Optional[str] = None
    wbs_code: Optional[str] = None
    wbs_name: Optional[str] = None
    
    # Planned Baseline
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    planned_duration_days: Optional[float] = None
    planned_progress: Optional[float] = 0.0
    
    # Verified Actual State
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    actual_progress: float = 0.0 # 0.0 to 100.0%
    status: str = "Not Started" # Not Started, In Progress, Completed, Behind Schedule
    
    # Delay & Variance
    delay_days: Optional[float] = None # Only calculated when activity is Completed
    progress_variance: Optional[float] = None # actual_progress - planned_progress (for active/incomplete)
    is_delayed: bool = False
    delay_reason: Optional[str] = None
    
    # Observation Metadata
    verified_observations_count: int = 0
    last_event_id: Optional[str] = None
    last_updated: Optional[str] = None
    approval_state: str = "VERIFIED"

class ActivityExecutionStateDetail(ActivityExecutionStateItem):
    """
    Comprehensive activity detail with full observation timeline and audit lineage.
    """
    observations_history: List[ObservationHistoryItem] = []
    audit_logs: List[Dict[str, Any]] = []

class ProjectExecutionSummary(BaseModel):
    """
    Executive rollup metrics for project execution state.
    """
    project_id: str
    total_activities: int
    verified_activities_count: int
    not_started_count: int
    in_progress_count: int
    completed_count: int
    delayed_count: int
    overall_planned_progress: float
    overall_actual_progress: float
    overall_progress_variance: float
    total_verified_observations: int
    last_observation_timestamp: Optional[str] = None

class ExecutionStateListResponse(BaseModel):
    success: bool = True
    project_id: str
    total_count: int
    items: List[ActivityExecutionStateItem]

class ExecutionStateDetailResponse(BaseModel):
    success: bool = True
    data: ActivityExecutionStateDetail

class ExecutionStateSummaryResponse(BaseModel):
    success: bool = True
    data: ProjectExecutionSummary

class ManualStateUpdateRequest(BaseModel):
    """
    Planner manual adjustment of verified execution state.
    """
    activity_id: str
    actual_progress: float = Field(..., ge=0.0, le=100.0)
    actual_start: Optional[datetime] = None
    actual_finish: Optional[datetime] = None
    mark_completed: bool = False
    reviewer_id: str = "PLANNER_USER"
    reason: str
