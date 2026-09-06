from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.schemas.reconciliation_schema import ReconciliationCandidate

class ConfidencePolicyConfig(BaseModel):
    high_threshold: float = Field(0.85, ge=0.0, le=1.0, description="Threshold for HIGH confidence / auto-eligible (default 0.85)")
    medium_threshold: float = Field(0.60, ge=0.0, le=1.0, description="Threshold for MEDIUM confidence / review required (default 0.60)")
    auto_approve_enabled: bool = Field(False, description="Whether auto-processing of HIGH confidence items without conflicts is active")

class ReviewQueueItem(BaseModel):
    event_id: str
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    reporter_name: Optional[str] = None
    report_date: Optional[str] = None
    project_id: str
    raw_text: str
    extracted_facts: Dict[str, Any] = Field(default_factory=dict)
    status: str = "PENDING_REVIEW" # PENDING_REVIEW, VERIFIED, REJECTED
    final_confidence: float = 0.0
    confidence_tier: str = "MEDIUM" # HIGH, MEDIUM, LOW
    auto_eligible: bool = False
    top_candidate: Optional[ReconciliationCandidate] = None
    alternative_candidates: List[ReconciliationCandidate] = Field(default_factory=list)
    reconciliation_reason: Optional[str] = None
    conflicting_signals: List[str] = Field(default_factory=list)

class ReviewQueueResponse(BaseModel):
    success: bool
    total_items: int
    pending_count: int
    high_confidence_count: int
    medium_confidence_count: int
    low_confidence_count: int
    items: List[ReviewQueueItem]

class ReviewApprovalRequest(BaseModel):
    event_id: str = Field(..., description="ID of the execution event to approve")
    activity_id: Optional[str] = Field(None, description="Optional activity ID. If omitted, the Top candidate is approved.")
    reviewer_id: str = Field("PLANNER_USER", description="Identifier of the reviewer")
    notes: Optional[str] = Field(None, description="Planner review notes or approval remarks")
    override_progress: Optional[float] = Field(None, ge=0.0, le=100.0, description="Optional manual progress override for the event observation")
    progress_mode: str = Field("CUMULATIVE_ACTIVITY", description="Progress semantics: 'CUMULATIVE_ACTIVITY', 'SUB_WORK', or 'EXPLICIT_COMPLETION'")
    mark_activity_completed: bool = Field(False, description="Explicitly verify that the entire scheduled activity is completed (100% and actual finish)")
    activity_actual_progress: Optional[float] = Field(None, ge=0.0, le=100.0, description="Explicit verified cumulative activity progress after this observation")

class ReviewRejectRequest(BaseModel):
    event_id: str = Field(..., description="ID of the execution event to reject")
    reviewer_id: str = Field("PLANNER_USER", description="Identifier of the reviewer")
    reason: Optional[str] = Field("Unmatched / Rejected by Planner", description="Reason for rejection")

class ReviewActionResponse(BaseModel):
    success: bool
    message: str
    event_id: str
    activity_id: Optional[str] = None
    action_type: str # APPROVED, OVERRIDDEN, REJECTED, AUTO_APPROVED
    reviewer_id: str
    updated_state: Optional[Dict[str, Any]] = None
    audit_log_id: Optional[str] = None

class AutoProcessRequest(BaseModel):
    project_id: str = Field("PRJ-REF-04", description="Target project ID")
    high_threshold: float = Field(0.85, ge=0.0, le=1.0, description="Minimum confidence for auto-processing")
    reviewer_id: str = Field("SYSTEM_AUTO_POLICY", description="Actor ID for auto-processing audit")

class AutoProcessResponse(BaseModel):
    success: bool
    message: str
    processed_count: int
    processed_events: List[str] = []
    skipped_count: int
    skipped_events: List[str] = []
