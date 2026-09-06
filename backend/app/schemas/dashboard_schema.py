from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class DashboardKpiMetrics(BaseModel):
    total_schedule_activities: int = Field(..., description="Total activities in the baseline schedule")
    verified_activities: int = Field(..., description="Activities with at least one verified field observation")
    pending_reviews: int = Field(..., description="Execution events pending planner review")
    unmatched_events: int = Field(..., description="Execution events rejected or unmatched")
    delayed_activities: int = Field(..., description="Activities verified or trending behind schedule")
    overall_planned_progress: float = Field(..., description="Average planned progress % across schedule")
    overall_actual_progress: float = Field(..., description="Average verified actual progress % across schedule")
    overall_variance: float = Field(..., description="Progress variance percentage points (Actual - Planned)")
    completed_activities_count: int = Field(..., description="Count of activities verified 100% complete")
    in_progress_activities_count: int = Field(..., description="Count of activities currently in progress")
    not_started_activities_count: int = Field(..., description="Count of activities not yet started")
    total_field_events: int = Field(0, description="Total ingested execution events")
    total_audit_logs: int = Field(0, description="Total immutable audit decision records")

class DisciplineProgressMetric(BaseModel):
    discipline: str
    total_activities: int
    verified_activities: int
    planned_progress: float
    actual_progress: float
    variance: float
    delayed_count: int

class ProgressCurvePoint(BaseModel):
    date: str
    planned_cumulative: float
    actual_cumulative: float

class StatusDistributionMetric(BaseModel):
    status: str
    count: int
    percentage: float
    color: str

class DelayedActivityItem(BaseModel):
    id: str
    activity_id: str
    activity_name: str
    discipline: Optional[str] = None
    location: Optional[str] = None
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    planned_progress: float = 0.0
    actual_progress: float = 0.0
    variance: float = 0.0
    delay_days: Optional[float] = None
    status: str = "In Progress"
    delay_reason: Optional[str] = None

class RecentStateTransitionItem(BaseModel):
    audit_id: str
    timestamp: str
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    action_type: str
    performed_by: str
    previous_progress: Optional[float] = None
    new_progress: Optional[float] = None
    status: Optional[str] = None
    confidence: Optional[float] = None

class DashboardSummaryResponse(BaseModel):
    success: bool = True
    project_id: str
    active_schedule_version: str
    kpis: DashboardKpiMetrics
    discipline_breakdown: List[DisciplineProgressMetric]
    status_distribution: List[StatusDistributionMetric]
    progress_s_curve: List[ProgressCurvePoint]
    delayed_activities: List[DelayedActivityItem]
    recent_transitions: List[RecentStateTransitionItem]
