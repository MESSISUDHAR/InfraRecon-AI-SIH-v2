import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.match_candidate import MatchCandidate
from app.models.audit_log import AuditLog
from app.schemas.audit_schema import (
    FieldEvidenceStage,
    AIExtractionStage,
    CandidateRetrievalStage,
    ContextReconciliationStage,
    ConfidenceSignalsStage,
    HumanDecisionStage,
    VerifiedStateStage,
    AuditLineageDetail,
    AuditLogItem,
    AuditLogListResponse,
    AuditStatsResponse
)

logger = logging.getLogger("audit_service")

def build_audit_lineage_detail(aud: AuditLog, db: Session) -> AuditLineageDetail:
    """
    Reconstructs the full 7-stage end-to-end explainability lineage for an audit record:
    Field Evidence -> AI Extraction -> Candidate Retrieval -> Context Reconciliation -> Confidence & Signals -> Human Decision -> Verified State
    """
    ev = db.query(ExecutionEvent).filter(ExecutionEvent.id == aud.event_id).first() if aud.event_id else None
    act = db.query(Activity).filter(
        (Activity.id == aud.activity_id) | (Activity.activity_id == aud.activity_id)
    ).first() if aud.activity_id else None

    # Load candidate matches for this event
    candidates_db = db.query(MatchCandidate).filter(
        MatchCandidate.event_id == aud.event_id
    ).order_by(MatchCandidate.rank.asc()).all() if aud.event_id else []

    top_cand = next((c for c in candidates_db if c.activity_id == (act.id if act else None)), None)
    if not top_cand and candidates_db:
        top_cand = candidates_db[0]

    prev_state = json.loads(aud.previous_state_json) if aud.previous_state_json else {}
    new_state = json.loads(aud.new_state_json) if aud.new_state_json else {}
    metadata = json.loads(aud.metadata_json) if aud.metadata_json else {}

    # Stage 1: Field Evidence
    stage_1 = FieldEvidenceStage(
        source_id=ev.source_id if ev else "N/A",
        source_type=ev.source_type if ev else "DPR",
        report_date=ev.report_date.isoformat() if (ev and ev.report_date and hasattr(ev.report_date, 'isoformat')) else (str(ev.report_date) if ev and ev.report_date else None),
        reporter_name=ev.reporter_name if ev else "Field Supervisor",
        raw_text=ev.raw_text if ev else "Field observation recorded in audit ledger."
    )

    # Stage 2: AI Fact Extraction (Gemini 2.5 Flash)
    stage_2 = AIExtractionStage(
        model_version=ev.model_version if (ev and ev.model_version) else "gemini-2.5-flash",
        prompt_version=ev.prompt_version if (ev and ev.prompt_version) else "v1.0",
        evidence_text=ev.evidence_text if ev else None,
        extracted_entities={
            "activity_description": ev.activity_description if ev else None,
            "discipline": ev.discipline if ev else None,
            "location": ev.location if ev else None,
            "asset_id": ev.asset_id if ev else None,
            "line_id": ev.line_id if ev else None,
            "event_type": ev.event_type if ev else "progress",
            "reported_progress": ev.event_progress if ev else None
        },
        extraction_confidence=ev.extraction_confidence if ev else 0.95
    )

    # Stage 3: Candidate Retrieval (Sentence Transformers Dense Vector Search)
    candidate_summary_list = []
    for c in candidates_db[:5]:
        c_act = db.query(Activity).filter(Activity.id == c.activity_id).first()
        candidate_summary_list.append({
            "rank": c.rank,
            "activity_id": c_act.activity_id if c_act else c.activity_id,
            "activity_name": c_act.activity_name if c_act else "Unknown Activity",
            "semantic_score": round(c.semantic_score, 4) if c.semantic_score is not None else None,
            "final_confidence": round(c.final_confidence, 4) if c.final_confidence is not None else None,
            "status": c.status
        })

    stage_3 = CandidateRetrievalStage(
        embedding_model="all-MiniLM-L6-v2 (384-dim dense vector embedding)",
        top_candidates_count=len(candidates_db),
        candidate_summary=candidate_summary_list
    )

    # Stage 4: Contextual Reconciliation (Multi-Signal Scoring)
    comp_scores = {}
    if top_cand:
        comp_scores = {
            "semantic": round(top_cand.semantic_score or 0.0, 4),
            "identifier": round(top_cand.identifier_score or 1.0, 4),
            "discipline": round(top_cand.discipline_score or 1.0, 4),
            "location": round(top_cand.location_score or 1.0, 4),
            "wbs": round(top_cand.wbs_score or 0.90, 4),
            "temporal": round(top_cand.temporal_score or 1.0, 4)
        }

    stage_4 = ContextReconciliationStage(
        weights_applied={
            "semantic": 0.40,
            "identifier": 0.20,
            "discipline": 0.15,
            "location": 0.10,
            "wbs": 0.10,
            "temporal": 0.05
        },
        component_scores=comp_scores,
        reasoning=top_cand.reasoning if top_cand else aud.decision_reason
    )

    # Stage 5: Confidence & Signals
    positive_sigs = []
    if top_cand and hasattr(top_cand, "positive_signals_json") and top_cand.positive_signals_json:
        try:
            positive_sigs = json.loads(top_cand.positive_signals_json)
        except Exception:
            pass
    elif top_cand and top_cand.reasoning:
        positive_sigs = [top_cand.reasoning]

    conflict_sigs = []
    if top_cand and top_cand.conflicting_signals_json:
        try:
            conflict_sigs = json.loads(top_cand.conflicting_signals_json)
        except Exception:
            pass
    
    conf_val = aud.confidence or (top_cand.final_confidence if top_cand else 0.85)
    conf_tier = "HIGH" if conf_val >= 0.85 else ("MEDIUM" if conf_val >= 0.60 else "LOW")

    stage_5 = ConfidenceSignalsStage(
        final_confidence=round(conf_val, 4),
        confidence_tier=conf_tier,
        positive_signals=positive_sigs,
        conflicting_signals=conflict_sigs
    )

    # Stage 6: Human Decision Gate
    stage_6 = HumanDecisionStage(
        action_type=aud.action_type,
        performed_by=aud.performed_by,
        decision_reason=aud.decision_reason,
        progress_mode=new_state.get("progress_mode", "CUMULATIVE_ACTIVITY"),
        is_activity_complete=new_state.get("is_activity_complete", False),
        timestamp=aud.timestamp.isoformat() if (aud.timestamp and hasattr(aud.timestamp, "isoformat")) else str(aud.timestamp)
    )

    # Stage 7: Verified State Update
    stage_7 = VerifiedStateStage(
        activity_id=act.activity_id if act else aud.activity_id,
        activity_name=act.activity_name if act else None,
        discipline=act.discipline if act else None,
        location=act.location if act else None,
        previous_state=prev_state,
        new_state=new_state,
        resulting_progress=new_state.get("actual_progress"),
        resulting_status=new_state.get("status"),
        delay_days=new_state.get("delay_days")
    )

    return AuditLineageDetail(
        audit_id=aud.id,
        project_id=aud.project_id,
        timestamp=aud.timestamp.isoformat() if (aud.timestamp and hasattr(aud.timestamp, "isoformat")) else str(aud.timestamp),
        action_type=aud.action_type,
        performed_by=aud.performed_by,
        decision_reason=aud.decision_reason,
        confidence=aud.confidence,
        stage_1_field_evidence=stage_1,
        stage_2_ai_extraction=stage_2,
        stage_3_candidate_retrieval=stage_3,
        stage_4_reconciliation=stage_4,
        stage_5_confidence_signals=stage_5,
        stage_6_human_decision=stage_6,
        stage_7_verified_state=stage_7
    )

def get_audit_logs(
    db: Session,
    project_id: str = "PRJ-REF-04",
    action_type: Optional[str] = None,
    activity_id: Optional[str] = None,
    event_id: Optional[str] = None,
    performed_by: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> AuditLogListResponse:
    """
    Retrieves filtered audit logs with activity metadata and explainability summaries.
    """
    query = db.query(AuditLog).filter(AuditLog.project_id == project_id)

    if action_type and action_type != "ALL":
        query = query.filter(AuditLog.action_type == action_type)
    if activity_id and activity_id != "ALL":
        query = query.filter(
            (AuditLog.activity_id == activity_id) | (AuditLog.activity_id.ilike(f"%{activity_id}%"))
        )
    if event_id and event_id != "ALL":
        query = query.filter(AuditLog.event_id == event_id)
    if performed_by and performed_by != "ALL":
        query = query.filter(AuditLog.performed_by == performed_by)

    total_count = query.count()
    records = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

    items: List[AuditLogItem] = []
    for aud in records:
        act_name = None
        act_code = aud.activity_id
        if aud.activity_id:
            act = db.query(Activity).filter(
                (Activity.id == aud.activity_id) | (Activity.activity_id == aud.activity_id)
            ).first()
            if act:
                act_name = act.activity_name
                act_code = act.activity_id

        item = AuditLogItem(
            id=aud.id,
            project_id=aud.project_id,
            event_id=aud.event_id,
            activity_id=act_code,
            activity_name=act_name,
            action_type=aud.action_type,
            performed_by=aud.performed_by,
            decision_reason=aud.decision_reason,
            confidence=round(aud.confidence, 4) if aud.confidence is not None else None,
            timestamp=aud.timestamp.isoformat() if (aud.timestamp and hasattr(aud.timestamp, "isoformat")) else str(aud.timestamp),
            has_full_lineage=True
        )
        items.append(item)

    return AuditLogListResponse(
        success=True,
        total_count=total_count,
        items=items
    )

def get_audit_stats(db: Session, project_id: str = "PRJ-REF-04") -> AuditStatsResponse:
    """
    Calculates executive compliance statistics from the audit ledger.
    """
    logs = db.query(AuditLog).filter(AuditLog.project_id == project_id).all()
    total = len(logs)

    approvals = sum(1 for l in logs if l.action_type == "PLANNER_APPROVAL")
    overrides = sum(1 for l in logs if l.action_type == "PLANNER_OVERRIDE")
    auto_approvals = sum(1 for l in logs if l.action_type == "AUTO_APPROVAL")
    rejections = sum(1 for l in logs if l.action_type in ["REJECTION", "REJECTED"])
    unique_reviewers = len(set(l.performed_by for l in logs if l.performed_by))

    recent_ts = None
    if logs:
        sorted_logs = sorted(logs, key=lambda x: x.timestamp, reverse=True)
        recent_ts = sorted_logs[0].timestamp.isoformat() if hasattr(sorted_logs[0].timestamp, "isoformat") else str(sorted_logs[0].timestamp)

    return AuditStatsResponse(
        success=True,
        project_id=project_id,
        total_audit_events=total,
        planner_approvals_count=approvals,
        planner_overrides_count=overrides,
        auto_approvals_count=auto_approvals,
        rejections_count=rejections,
        unique_reviewers_count=unique_reviewers,
        recent_activity_timestamp=recent_ts
    )
