import time
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.match_candidate import MatchCandidate
from app.models.audit_log import AuditLog
from app.schemas.review_schema import (
    ConfidencePolicyConfig,
    ReviewQueueItem,
    ReviewQueueResponse,
    ReviewActionResponse,
    AutoProcessResponse
)
from app.services.reconciliation_service import reconcile_execution_event, DEFAULT_WEIGHTS

logger = logging.getLogger("review_service")

# Global in-memory confidence policy (configurable via API)
_POLICY_CONFIG = ConfidencePolicyConfig(
    high_threshold=0.85,
    medium_threshold=0.60,
    auto_approve_enabled=False
)

def get_policy_config() -> ConfidencePolicyConfig:
    return _POLICY_CONFIG

def update_policy_config(new_config: ConfidencePolicyConfig) -> ConfidencePolicyConfig:
    global _POLICY_CONFIG
    _POLICY_CONFIG = new_config
    logger.info(f"Updated confidence policy: high={_POLICY_CONFIG.high_threshold}, medium={_POLICY_CONFIG.medium_threshold}, auto_approve={_POLICY_CONFIG.auto_approve_enabled}")
    return _POLICY_CONFIG

def get_review_queue(
    db: Session,
    project_id: str = "PRJ-REF-04",
    status_filter: Optional[str] = None,
    tier_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> ReviewQueueResponse:
    """
    Retrieves execution events requiring planner review, calculates multi-signal reconciliation,
    evaluates confidence tiers (HIGH, MEDIUM, LOW) against active policy thresholds, and formats review items.
    """
    query = db.query(ExecutionEvent).filter(ExecutionEvent.project_id == project_id)
    
    if status_filter and status_filter != "ALL":
        query = query.filter(ExecutionEvent.status == status_filter)
    else:
        # Default: include pending items (INGESTED, EXTRACTED, PENDING_REVIEW)
        query = query.filter(ExecutionEvent.status.in_(["INGESTED", "EXTRACTED", "PENDING_REVIEW"]))

    total_pending = query.count()
    event_ids = [e.id for e in query.order_by(ExecutionEvent.ingestion_timestamp.desc()).offset(offset).limit(limit).all()]
    
    queue_items: List[ReviewQueueItem] = []
    high_count = 0
    medium_count = 0
    low_count = 0

    policy = get_policy_config()

    for eid in event_ids:
        ev = db.query(ExecutionEvent).filter(ExecutionEvent.id == eid).first()
        if not ev:
            continue

        try:
            # Run reconciliation for each event
            recon_res = reconcile_execution_event(
                db=db,
                project_id=project_id,
                event_id=eid,
                top_k=5,
                persist_candidates=True
            )
        except Exception as err:
            logger.error(f"Reconciliation error for event {eid}: {err}", exc_info=True)
            continue

        # Re-fetch event to get any freshly extracted facts
        ev = db.query(ExecutionEvent).filter(ExecutionEvent.id == eid).first()

        top = recon_res.top_candidate
        final_conf = top.final_confidence if top else 0.0
        conflicts = top.conflicting_signals if top else []

        # Determine Tier against policy thresholds
        has_critical_conflict = any("conflict" in c.lower() or "mismatch" in c.lower() for c in conflicts)
        if final_conf >= policy.high_threshold and not has_critical_conflict:
            tier = "HIGH"
            auto_eligible = True
            high_count += 1
        elif final_conf >= policy.medium_threshold:
            tier = "MEDIUM"
            auto_eligible = False
            medium_count += 1
        else:
            tier = "LOW"
            auto_eligible = False
            low_count += 1

        # Apply tier filter if requested
        if tier_filter and tier_filter != "ALL" and tier != tier_filter:
            continue

        extracted_facts = recon_res.extracted_facts or {
            "activity_description": ev.activity_description if ev else None,
            "discipline": ev.discipline if ev else None,
            "location": ev.location if ev else None,
            "asset_id": ev.asset_id if ev else None,
            "line_id": ev.line_id if ev else None,
            "event_type": ev.event_type if ev else "progress",
            "progress": ev.event_progress if ev else None,
            "evidence_text": ev.evidence_text if ev else None,
            "extraction_confidence": ev.extraction_confidence if ev else None
        }

        rep_date_str = None
        if ev and ev.report_date:
            rep_date_str = ev.report_date.isoformat() if hasattr(ev.report_date, 'isoformat') else str(ev.report_date)

        item = ReviewQueueItem(
            event_id=eid,
            source_id=ev.source_id if ev else None,
            source_type=ev.source_type if ev else None,
            reporter_name=ev.reporter_name if ev else None,
            report_date=rep_date_str,
            project_id=project_id,
            raw_text=ev.raw_text if ev else (recon_res.raw_text or ""),
            extracted_facts=extracted_facts,
            status=ev.status if ev else "PENDING_REVIEW",
            final_confidence=final_conf,
            confidence_tier=tier,
            auto_eligible=auto_eligible,
            top_candidate=top,
            alternative_candidates=recon_res.alternative_candidates,
            reconciliation_reason=top.reasoning if top else "No matching schedule activities found.",
            conflicting_signals=conflicts
        )
        queue_items.append(item)

    return ReviewQueueResponse(
        success=True,
        total_items=len(queue_items),
        pending_count=total_pending,
        high_confidence_count=high_count,
        medium_confidence_count=medium_count,
        low_confidence_count=low_count,
        items=queue_items
    )

def approve_candidate_match(
    db: Session,
    event_id: str,
    activity_id: Optional[str] = None,
    reviewer_id: str = "PLANNER_USER",
    notes: Optional[str] = None,
    override_progress: Optional[float] = None,
    progress_mode: str = "CUMULATIVE_ACTIVITY",
    mark_activity_completed: bool = False,
    activity_actual_progress: Optional[float] = None
) -> ReviewActionResponse:
    """
    Applies Human-in-the-Loop Planner Approval (Milestone 9 Verified Execution State):
    1. Validates candidate activity.
    2. Applies progress mode semantics (CUMULATIVE_ACTIVITY vs SUB_WORK vs EXPLICIT_COMPLETION).
    3. Guarantees raw event-level progress is not confused with cumulative activity progress.
    4. Computes actual_start, actual_finish (only when activity is complete), and verified delay_days.
    5. Preserves observation history and audit lineage with atomic database transaction.
    """
    event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    if not event:
        raise ValueError(f"ExecutionEvent with ID '{event_id}' not found.")

    target_act = None
    target_confidence = 0.90
    action_type = "PLANNER_APPROVAL"

    if activity_id:
        # Match by database ID or activity_id (e.g. PIP-L5-034)
        target_act = db.query(Activity).filter(
            (Activity.id == activity_id) | (Activity.activity_id == activity_id),
            Activity.project_id == event.project_id
        ).first()
        if not target_act:
            raise ValueError(f"Activity with ID '{activity_id}' not found in project '{event.project_id}'.")
    else:
        # Reconcile to resolve top candidate
        recon_res = reconcile_execution_event(db=db, project_id=event.project_id, event_id=event.id, top_k=1)
        if not recon_res.top_candidate:
            raise ValueError(f"No candidate activities available to approve for event '{event_id}'.")
        top = recon_res.top_candidate
        target_act = db.query(Activity).filter(Activity.id == top.id).first()
        target_confidence = top.final_confidence

    if not target_act:
        raise ValueError("Could not resolve target schedule activity.")

    # Check if this was an override vs top match
    top_cand_db = db.query(MatchCandidate).filter(
        MatchCandidate.event_id == event.id,
        MatchCandidate.rank == 1
    ).first()
    if not top_cand_db:
        # Generate baseline reconciliation candidates to identify rank 1 match
        recon_baseline = reconcile_execution_event(
            db=db,
            project_id=event.project_id,
            event_id=event.id,
            top_k=5,
            persist_candidates=True
        )
        top_cand_db = db.query(MatchCandidate).filter(
            MatchCandidate.event_id == event.id,
            MatchCandidate.rank == 1
        ).first()

    if top_cand_db and top_cand_db.activity_id != target_act.id:
        action_type = "PLANNER_OVERRIDE"

    try:
        # 1. Query Existing ExecutionState
        exec_state = db.query(ExecutionState).filter(
            ExecutionState.activity_id == target_act.id
        ).first()

        previous_state_snapshot = {}
        if exec_state:
            previous_state_snapshot = {
                "actual_progress": exec_state.actual_progress,
                "actual_start": exec_state.actual_start.isoformat() if exec_state.actual_start else None,
                "actual_finish": exec_state.actual_finish.isoformat() if exec_state.actual_finish else None,
                "status": exec_state.status,
                "delay_days": exec_state.delay_days,
                "verified_observations_count": exec_state.verified_observations_count
            }

        existing_progress = exec_state.actual_progress if exec_state else 0.0

        # 2. Determine New Verified Activity Progress based on Semantic Progress Mode
        is_activity_complete = False
        calculated_finish = None

        if mark_activity_completed or progress_mode == "EXPLICIT_COMPLETION":
            new_progress = 100.0
            is_activity_complete = True
            calculated_finish = event.actual_finish or datetime.now(timezone.utc)
            new_status = "Completed"
        elif activity_actual_progress is not None:
            new_progress = min(100.0, max(0.0, float(activity_actual_progress)))
            if new_progress >= 100.0:
                is_activity_complete = True
                calculated_finish = event.actual_finish or datetime.now(timezone.utc)
                new_status = "Completed"
            else:
                new_status = "In Progress" if new_progress > 0.0 else "Not Started"
        elif progress_mode == "SUB_WORK":
            # Event progress is for a sub-work/observation, e.g. 100% of a 50m sub-section
            # Do NOT set activity to 100%, do NOT set actual_finish!
            new_progress = existing_progress
            is_activity_complete = False
            new_status = "In Progress" if (new_progress > 0 or (exec_state and exec_state.verified_observations_count > 0)) else "Not Started"
        else:
            # Default: CUMULATIVE_ACTIVITY
            reported_ev_prog = override_progress if override_progress is not None else event.event_progress
            if reported_ev_prog is None:
                reported_ev_prog = 100.0 if event.event_type == "completion" else (10.0 if event.event_type == "start" else 0.0)
            
            # Monotonic cumulative progress rule: min(100.0, max(existing_progress, reported))
            new_progress = min(100.0, max(existing_progress, float(reported_ev_prog)))
            if new_progress >= 100.0:
                is_activity_complete = True
                calculated_finish = event.actual_finish or datetime.now(timezone.utc)
                new_status = "Completed"
            else:
                new_status = "In Progress" if new_progress > 0.0 else "Not Started"

        # Calculate Verified Delay if Completed
        verified_delay_days = 0.0
        if is_activity_complete and calculated_finish and target_act.planned_finish:
            act_fin_date = calculated_finish.date() if hasattr(calculated_finish, "date") else calculated_finish
            pln_fin_date = target_act.planned_finish.date() if hasattr(target_act.planned_finish, "date") else target_act.planned_finish
            verified_delay_days = float((act_fin_date - pln_fin_date).days)

        # 3. Create or Update ExecutionState
        if not exec_state:
            exec_state = ExecutionState(
                id=f"state_{uuid.uuid4().hex[:12]}",
                project_id=event.project_id,
                activity_id=target_act.id,
                actual_start=event.actual_start or event.report_date or target_act.planned_start or datetime.now(timezone.utc),
                actual_finish=calculated_finish,
                actual_progress=new_progress,
                status=new_status,
                delay_days=verified_delay_days,
                delay_reason=event.delay_reason,
                verified_observations_count=1,
                last_event_id=event.id,
                last_updated=datetime.now(timezone.utc),
                approval_state="VERIFIED"
            )
            db.add(exec_state)
        else:
            exec_state.actual_progress = new_progress
            exec_state.status = new_status
            if not exec_state.actual_start:
                exec_state.actual_start = event.actual_start or event.report_date or datetime.now(timezone.utc)
            if is_activity_complete:
                exec_state.actual_finish = calculated_finish
                exec_state.delay_days = verified_delay_days
            if event.delay_reason:
                exec_state.delay_reason = event.delay_reason
            exec_state.verified_observations_count += 1
            exec_state.last_event_id = event.id
            exec_state.last_updated = datetime.now(timezone.utc)
            exec_state.approval_state = "VERIFIED"

        # 4. Update ExecutionEvent status
        event.status = "VERIFIED"

        # 5. Update MatchCandidate records for this event
        candidates = db.query(MatchCandidate).filter(MatchCandidate.event_id == event.id).all()
        for cand in candidates:
            if cand.activity_id == target_act.id:
                cand.status = "approved"
                cand.reviewer_id = reviewer_id
                cand.review_timestamp = datetime.now(timezone.utc)
                target_confidence = cand.final_confidence
            else:
                cand.status = "rejected"
                cand.reviewer_id = reviewer_id
                cand.review_timestamp = datetime.now(timezone.utc)

        # 6. Create AuditLog entry for strict traceability
        audit_id = f"aud_{uuid.uuid4().hex[:12]}"
        audit_entry = AuditLog(
            id=audit_id,
            project_id=event.project_id,
            event_id=event.id,
            activity_id=target_act.id,
            action_type=action_type,
            decision_reason=notes or f"Planner ({reviewer_id}) approved candidate {target_act.activity_id} (Mode: {progress_mode})",
            confidence=target_confidence,
            performed_by=reviewer_id,
            previous_state_json=json.dumps(previous_state_snapshot),
            new_state_json=json.dumps({
                "activity_id": target_act.activity_id,
                "actual_progress": exec_state.actual_progress,
                "status": exec_state.status,
                "progress_mode": progress_mode,
                "is_activity_complete": is_activity_complete,
                "delay_days": exec_state.delay_days,
                "verified_observations_count": exec_state.verified_observations_count
            }),
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(exec_state)

    except Exception as err:
        db.rollback()
        logger.error(f"Transaction failed during approval of event {event_id}: {err}", exc_info=True)
        raise

    return ReviewActionResponse(
        success=True,
        message=f"Event {event.id} successfully verified and linked to activity {target_act.activity_id} ({new_progress}% progress, Mode: {progress_mode}).",
        event_id=event.id,
        activity_id=target_act.activity_id,
        action_type=action_type,
        reviewer_id=reviewer_id,
        updated_state={
            "activity_id": target_act.activity_id,
            "activity_name": target_act.activity_name,
            "actual_progress": exec_state.actual_progress,
            "status": exec_state.status,
            "delay_days": exec_state.delay_days,
            "verified_observations_count": exec_state.verified_observations_count
        },
        audit_log_id=audit_id
    )

def reject_candidate_match(
    db: Session,
    event_id: str,
    reviewer_id: str = "PLANNER_USER",
    reason: str = "Unmatched / Rejected by Planner"
) -> ReviewActionResponse:
    """
    Applies Human-in-the-Loop Rejection:
    1. Marks ExecutionEvent status as REJECTED.
    2. Marks all MatchCandidate records as rejected.
    3. Crucial rule: ExecutionState is NOT altered or created.
    4. Records rejection in AuditLog.
    """
    event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
    if not event:
        raise ValueError(f"ExecutionEvent with ID '{event_id}' not found.")

    event.status = "REJECTED"

    # Update match candidates
    candidates = db.query(MatchCandidate).filter(MatchCandidate.event_id == event.id).all()
    for cand in candidates:
        cand.status = "rejected"
        cand.reviewer_id = reviewer_id
        cand.review_timestamp = datetime.now(timezone.utc)

    # Create AuditLog entry
    audit_id = f"aud_{uuid.uuid4().hex[:12]}"
    audit_entry = AuditLog(
        id=audit_id,
        project_id=event.project_id,
        event_id=event.id,
        activity_id=None,
        action_type="REJECTION",
        decision_reason=reason,
        confidence=0.0,
        performed_by=reviewer_id,
        previous_state_json=None,
        new_state_json=json.dumps({"status": "REJECTED"}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_entry)
    db.commit()

    return ReviewActionResponse(
        success=True,
        message=f"Event {event.id} marked as REJECTED/UNMATCHED. Execution state remains completely untouched.",
        event_id=event.id,
        activity_id=None,
        action_type="REJECTED",
        reviewer_id=reviewer_id,
        updated_state=None,
        audit_log_id=audit_id
    )

def auto_process_high_confidence_events(
    db: Session,
    project_id: str = "PRJ-REF-04",
    high_threshold: float = 0.85,
    reviewer_id: str = "SYSTEM_AUTO_POLICY"
) -> AutoProcessResponse:
    """
    Batch processes pending events that strictly meet HIGH confidence policy (>= 85%)
    and have NO conflicting signals under project rules.
    """
    events = db.query(ExecutionEvent).filter(
        ExecutionEvent.project_id == project_id,
        ExecutionEvent.status.in_(["INGESTED", "EXTRACTED", "PENDING_REVIEW"])
    ).all()

    processed_events: List[str] = []
    skipped_events: List[str] = []

    for ev in events:
        recon_res = reconcile_execution_event(
            db=db,
            project_id=project_id,
            event_id=ev.id,
            top_k=1,
            persist_candidates=True
        )

        top = recon_res.top_candidate
        if not top:
            skipped_events.append(ev.id)
            continue

        has_critical_conflict = any("conflict" in c.lower() or "mismatch" in c.lower() for c in top.conflicting_signals)

        if top.final_confidence >= high_threshold and not has_critical_conflict:
            # Auto-approve
            approve_candidate_match(
                db=db,
                event_id=ev.id,
                activity_id=top.id,
                reviewer_id=reviewer_id,
                notes=f"Auto-approved via High Confidence Policy ({round(top.final_confidence * 100, 1)}%)"
            )
            processed_events.append(ev.id)
        else:
            skipped_events.append(ev.id)

    return AutoProcessResponse(
        success=True,
        message=f"Auto-processed {len(processed_events)} high-confidence items. {len(skipped_events)} held for planner review.",
        processed_count=len(processed_events),
        processed_events=processed_events,
        skipped_count=len(skipped_events),
        skipped_events=skipped_events
    )
