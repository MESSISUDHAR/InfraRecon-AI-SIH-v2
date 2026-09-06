from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class DependencyLink(BaseModel):
    predecessor_id: str = Field(..., description="Activity ID of the predecessor activity")
    predecessor_name: str = Field(..., description="Name of the predecessor activity")
    successor_id: str = Field(..., description="Activity ID of the successor activity")
    successor_name: str = Field(..., description="Name of the successor activity")
    dependency_type: str = Field("FS", description="Link type: Finish-to-Start (FS), SS, FF, SF")
    lag_days: float = Field(0.0, description="Scheduled lag / lead in days")
    buffer_days: Optional[float] = Field(None, description="Float / buffer days between planned finish and planned start")

class UpstreamPredecessorItem(BaseModel):
    activity_id: str
    activity_name: str
    discipline: Optional[str] = None
    dependency_type: str = "FS"
    planned_finish: Optional[str] = None
    actual_finish: Optional[str] = None
    status: str = "Not Started"
    is_delayed: bool = False
    delay_days: Optional[float] = None
    buffer_days: Optional[float] = None

class DownstreamImpactItem(BaseModel):
    successor_activity_id: str
    successor_activity_name: str
    discipline: Optional[str] = None
    location: Optional[str] = None
    dependency_type: str = "FS"
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    current_status: str = "Not Started"
    current_progress: float = 0.0
    buffer_days: float = 0.0
    predecessor_delay_days: float = 0.0
    potential_delay_impact_days: float = 0.0
    risk_severity: str = "MEDIUM"  # CRITICAL, HIGH, MEDIUM, BUFFERED
    impact_explanation: str
    tier: int = 1  # 1 = Immediate successor, 2 = 2nd Tier cascade, etc.

class ImpactChainItem(BaseModel):
    chain_id: str
    source_delayed_activity_id: str
    source_delayed_activity_name: str
    source_delay_days: float
    affected_successors_count: int
    max_cascade_slippage_days: float
    highest_risk_severity: str
    path_summary: str  # e.g. CIV-L5-088 (+3.0d) -> PIP-L5-034 (+3.0d) -> HYD-L5-012 (+3.0d)
    affected_activities: List[DownstreamImpactItem]

class ActivityDependencyDetail(BaseModel):
    success: bool = True
    project_id: str
    activity_id: str
    activity_name: str
    discipline: Optional[str] = None
    location: Optional[str] = None
    status: str = "Not Started"
    actual_progress: float = 0.0
    is_delayed: bool = False
    delay_days: Optional[float] = None
    predecessors: List[UpstreamPredecessorItem] = Field(default_factory=list)
    immediate_successors: List[DownstreamImpactItem] = Field(default_factory=list)
    downstream_cascade: List[DownstreamImpactItem] = Field(default_factory=list)
    total_downstream_at_risk: int = 0
    max_downstream_slippage_days: float = 0.0

class ProjectDependencyImpactSummary(BaseModel):
    success: bool = True
    project_id: str
    total_dependency_links: int
    delayed_activities_with_successors: int
    total_downstream_activities_at_risk: int
    critical_impact_chains_count: int
    impact_chains: List[ImpactChainItem]
    all_downstream_impacts: List[DownstreamImpactItem]
    disclaimer: str = "Deterministic CPM rule-based impact derived from predecessor-successor relationships. No predictive forecasting claimed."
