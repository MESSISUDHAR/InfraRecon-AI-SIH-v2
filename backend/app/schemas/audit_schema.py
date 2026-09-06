from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class FieldEvidenceStage(BaseModel):
    source_id: Optional[str] = None
    source_type: Optional[str] = "DPR"
    report_date: Optional[str] = None
    reporter_name: Optional[str] = None
    raw_text: str

class AIExtractionStage(BaseModel):
    model_version: str = "gemini-2.5-flash"
    prompt_version: str = "v1.0"
    evidence_text: Optional[str] = None
    extracted_entities: Dict[str, Any] = Field(default_factory=dict)
    extraction_confidence: Optional[float] = 1.0

class CandidateRetrievalStage(BaseModel):
    embedding_model: str = "all-MiniLM-L6-v2 (384-dim)"
    top_candidates_count: int = 0
    candidate_summary: List[Dict[str, Any]] = Field(default_factory=list)

class ContextReconciliationStage(BaseModel):
    weights_applied: Dict[str, float] = Field(default_factory=dict)
    component_scores: Dict[str, float] = Field(default_factory=dict)
    reasoning: Optional[str] = None

class ConfidenceSignalsStage(BaseModel):
    final_confidence: float = 0.0
    confidence_tier: str = "MEDIUM" # HIGH, MEDIUM, LOW
    positive_signals: List[str] = Field(default_factory=list)
    conflicting_signals: List[str] = Field(default_factory=list)

class HumanDecisionStage(BaseModel):
    action_type: str # PLANNER_APPROVAL, PLANNER_OVERRIDE, AUTO_APPROVAL, REJECTION
    performed_by: str
    decision_reason: Optional[str] = None
    progress_mode: str = "CUMULATIVE_ACTIVITY"
    is_activity_complete: bool = False
    timestamp: str

class VerifiedStateStage(BaseModel):
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    discipline: Optional[str] = None
    location: Optional[str] = None
    previous_state: Dict[str, Any] = Field(default_factory=dict)
    new_state: Dict[str, Any] = Field(default_factory=dict)
    resulting_progress: Optional[float] = None
    resulting_status: Optional[str] = None
    delay_days: Optional[float] = None

class AuditLineageDetail(BaseModel):
    """
    Complete 7-stage end-to-end lineage trace for an audit log entry.
    Field Evidence -> AI Extraction -> Candidate Retrieval -> Reconciliation -> Confidence & Signals -> Human Decision -> Verified State
    """
    audit_id: str
    project_id: str
    timestamp: str
    action_type: str
    performed_by: str
    decision_reason: Optional[str] = None
    confidence: Optional[float] = None
    
    # 7-Stage End-to-End Lineage
    stage_1_field_evidence: FieldEvidenceStage
    stage_2_ai_extraction: AIExtractionStage
    stage_3_candidate_retrieval: CandidateRetrievalStage
    stage_4_reconciliation: ContextReconciliationStage
    stage_5_confidence_signals: ConfidenceSignalsStage
    stage_6_human_decision: HumanDecisionStage
    stage_7_verified_state: VerifiedStateStage

class AuditLogItem(BaseModel):
    id: str
    project_id: str
    event_id: Optional[str] = None
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    action_type: str
    performed_by: str
    decision_reason: Optional[str] = None
    confidence: Optional[float] = None
    timestamp: str
    has_full_lineage: bool = True

class AuditLogListResponse(BaseModel):
    success: bool = True
    total_count: int
    items: List[AuditLogItem]

class AuditLogDetailResponse(BaseModel):
    success: bool = True
    data: AuditLineageDetail

class AuditStatsResponse(BaseModel):
    success: bool = True
    project_id: str
    total_audit_events: int
    planner_approvals_count: int
    planner_overrides_count: int
    auto_approvals_count: int
    rejections_count: int
    unique_reviewers_count: int
    recent_activity_timestamp: Optional[str] = None
