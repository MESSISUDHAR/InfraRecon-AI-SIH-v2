import time
import json
import uuid
import logging
from datetime import datetime, timezone, date
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.match_candidate import MatchCandidate
from app.services.embedding_service import (
    generate_embedding,
    compute_cosine_similarity
)
from app.services.extractor_service import extract_execution_event_with_gemini
from app.schemas.reconciliation_schema import (
    ReconciliationWeights,
    ReconciliationCandidate,
    ReconciliationResponse
)

logger = logging.getLogger("reconciliation_service")

DEFAULT_WEIGHTS = ReconciliationWeights(
    semantic_weight=0.40,
    identifier_weight=0.20,
    discipline_weight=0.15,
    location_weight=0.10,
    wbs_weight=0.10,
    temporal_weight=0.05
)

def normalize_text(s: Optional[str]) -> str:
    if not s:
        return ""
    return str(s).strip().lower()

def compute_component_signals(
    extracted_facts: Dict[str, Any],
    activity: Activity,
    semantic_similarity: float,
    report_date: Optional[datetime] = None
) -> Tuple[Dict[str, float], List[str], List[str], Dict[str, Any]]:
    """
    Evaluates multi-dimensional contextual signals between extracted facts and candidate activity.
    Adheres strictly to PROJECT_RULES.md:
    - Missing fields in field report are neutral/null (NOT penalized).
    - Returns: (scores_dict, positive_signals, conflicting_signals, raw_context_signals)
    """
    scores: Dict[str, float] = {}
    positives: List[str] = []
    conflicts: List[str] = []
    context_signals: Dict[str, Any] = {}

    # 1. Semantic Score (Dense Cosine Similarity)
    sem_score = max(0.0, min(1.0, float(semantic_similarity)))
    scores["semantic"] = round(sem_score, 4)
    if sem_score >= 0.80:
        positives.append(f"High semantic alignment ({round(sem_score * 100, 1)}%) with scheduled scope")
    elif sem_score >= 0.60:
        positives.append(f"Moderate semantic similarity ({round(sem_score * 100, 1)}%)")
    else:
        conflicts.append(f"Low semantic similarity ({round(sem_score * 100, 1)}%)")

    # 2. Asset / Line Identifier Match
    ext_line = normalize_text(extracted_facts.get("line_id"))
    act_line = normalize_text(activity.line_id)
    ext_asset = normalize_text(extracted_facts.get("asset_id"))
    act_asset = normalize_text(activity.asset_id)

    id_score = 1.0
    id_status = "NEUTRAL (No identifiers in report)"

    if ext_line and act_line:
        if ext_line == act_line or ext_line in act_line or act_line in ext_line:
            id_score = 1.0
            id_status = f"EXACT MATCH ({activity.line_id})"
            positives.append(f"Exact line identifier match ({activity.line_id})")
        else:
            id_score = 0.0
            id_status = f"MISMATCH ({extracted_facts.get('line_id')} vs {activity.line_id})"
            conflicts.append(f"Line ID mismatch: Report specifies '{extracted_facts.get('line_id')}' but activity is '{activity.line_id}'")
    elif ext_asset and act_asset:
        if ext_asset == act_asset or ext_asset in act_asset or act_asset in ext_asset:
            id_score = 1.0
            id_status = f"EXACT MATCH ({activity.asset_id})"
            positives.append(f"Exact asset identifier match ({activity.asset_id})")
        else:
            id_score = 0.0
            id_status = f"MISMATCH ({extracted_facts.get('asset_id')} vs {activity.asset_id})"
            conflicts.append(f"Asset tag mismatch: Report specifies '{extracted_facts.get('asset_id')}' but activity is '{activity.asset_id}'")
    elif ext_line or ext_asset:
        # Report specifies ID but activity lacks one (Partial / Unassigned)
        id_score = 0.50
        id_status = "UNMATCHED (Activity lacks matching identifier tag)"
        conflicts.append(f"Report mentions identifier '{ext_line or ext_asset}' but candidate activity has no tag")
    else:
        # Crucial missing data rule: Report has no identifiers -> neutral score (no penalty)
        id_score = 1.0
        id_status = "NEUTRAL (No identifiers in report)"

    scores["identifier"] = round(id_score, 4)
    context_signals["identifier_match"] = id_status

    # 3. Discipline Match
    ext_disc = normalize_text(extracted_facts.get("discipline"))
    act_disc = normalize_text(activity.discipline)

    disc_score = 1.0
    disc_status = "NEUTRAL (No discipline in report)"

    if not ext_disc or ext_disc in ["general", "none", "null", "unknown"]:
        disc_score = 1.0
        disc_status = "NEUTRAL (Unspecified in report)"
    elif act_disc == ext_disc:
        disc_score = 1.0
        disc_status = f"EXACT MATCH ({activity.discipline})"
        positives.append(f"Discipline exact match ({activity.discipline})")
    elif act_disc in ext_disc or ext_disc in act_disc:
        disc_score = 0.85
        disc_status = f"PARTIAL MATCH ({activity.discipline})"
        positives.append(f"Discipline partial match ({activity.discipline})")
    else:
        disc_score = 0.0
        disc_status = f"CONFLICT ({ext_disc.title()} vs {act_disc.title()})"
        conflicts.append(f"Discipline conflict: Report specifies '{ext_disc.title()}' but candidate is '{act_disc.title()}'")

    scores["discipline"] = round(disc_score, 4)
    context_signals["discipline_match"] = disc_status

    # 4. Location Match
    ext_loc = normalize_text(extracted_facts.get("location"))
    act_loc = normalize_text(activity.location)

    loc_score = 1.0
    loc_status = "NEUTRAL (No location in report)"

    if not ext_loc or not act_loc:
        loc_score = 1.0
        loc_status = "NEUTRAL (Location omitted / Unassigned)"
    elif act_loc == ext_loc or ext_loc in act_loc or act_loc in ext_loc:
        loc_score = 1.0
        loc_status = f"EXACT MATCH ({activity.location})"
        positives.append(f"Workfront location match ({activity.location})")
    else:
        loc_score = 0.0
        loc_status = f"DIFFERENT AREA ({extracted_facts.get('location')} vs {activity.location})"
        conflicts.append(f"Location difference: Report in '{extracted_facts.get('location')}' vs candidate '{activity.location}'")

    scores["location"] = round(loc_score, 4)
    context_signals["location_match"] = loc_status

    # 5. WBS / Hierarchy Consistency
    wbs_text = f"{activity.wbs_name or ''} {activity.wbs_code or ''} {activity.level or ''}".lower()
    act_name = normalize_text(activity.activity_name)
    raw_desc = normalize_text(extracted_facts.get("activity_description"))

    wbs_score = 0.90 # Baseline WBS alignment
    if raw_desc and any(tok in wbs_text for tok in raw_desc.split() if len(tok) > 3):
        wbs_score = 1.0
        positives.append(f"WBS hierarchy consistency ({activity.wbs_name or activity.wbs_code or 'Standard'})")
    elif activity.wbs_code:
        wbs_score = 0.90
    else:
        wbs_score = 0.80

    scores["wbs"] = round(wbs_score, 4)
    context_signals["wbs_consistency"] = f"Aligned ({activity.wbs_name or activity.wbs_code or 'L5 Scope'})"

    # 6. Temporal Consistency
    temp_score = 1.0
    temp_status = "NEUTRAL (No temporal constraints)"

    if report_date and activity.planned_start and activity.planned_finish:
        rep_d = report_date.date() if isinstance(report_date, datetime) else report_date
        plan_s = activity.planned_start.date() if isinstance(activity.planned_start, datetime) else activity.planned_start
        plan_f = activity.planned_finish.date() if isinstance(activity.planned_finish, datetime) else activity.planned_finish

        if plan_s <= rep_d <= plan_f:
            temp_score = 1.0
            temp_status = "WITHIN PLANNED WINDOW"
            positives.append(f"Report date falls within planned execution window ({plan_s} to {plan_f})")
        else:
            days_diff = min(abs((rep_d - plan_s).days), abs((rep_d - plan_f).days))
            if days_diff <= 14:
                temp_score = 0.85
                temp_status = f"NEAR WINDOW ({days_diff} days variance)"
            else:
                temp_score = 0.50
                temp_status = f"OUTSIDE WINDOW ({days_diff} days variance)"
                conflicts.append(f"Report date deviates from planned schedule window by {days_diff} days")
    else:
        temp_score = 1.0
        temp_status = "NEUTRAL (Standard schedule timeline)"

    scores["temporal"] = round(temp_score, 4)
    context_signals["temporal_alignment"] = temp_status

    return scores, positives, conflicts, context_signals

def compute_reconciliation_candidate(
    extracted_facts: Dict[str, Any],
    activity: Activity,
    semantic_similarity: float,
    weights: ReconciliationWeights,
    report_date: Optional[datetime] = None
) -> ReconciliationCandidate:
    """
    Computes component scores, weighted final confidence, and human-readable explainability.
    """
    scores, positives, conflicts, context_signals = compute_component_signals(
        extracted_facts=extracted_facts,
        activity=activity,
        semantic_similarity=semantic_similarity,
        report_date=report_date
    )

    # Normalize weights sum
    total_w = (
        weights.semantic_weight +
        weights.identifier_weight +
        weights.discipline_weight +
        weights.location_weight +
        weights.wbs_weight +
        weights.temporal_weight
    )
    if total_w <= 0:
        total_w = 1.0

    raw_confidence = (
        scores["semantic"] * weights.semantic_weight +
        scores["identifier"] * weights.identifier_weight +
        scores["discipline"] * weights.discipline_weight +
        scores["location"] * weights.location_weight +
        scores["wbs"] * weights.wbs_weight +
        scores["temporal"] * weights.temporal_weight
    ) / total_w

    # If there is a direct discipline or location conflict, apply risk penalty
    if any("Discipline conflict" in c for c in conflicts):
        raw_confidence = min(raw_confidence, 0.55)
    if any("Line ID mismatch" in c or "Asset tag mismatch" in c for c in conflicts):
        raw_confidence = min(raw_confidence, 0.60)

    final_confidence = round(max(0.0, min(1.0, raw_confidence)), 4)

    # Assign confidence tier
    if final_confidence >= 0.85:
        tier = "HIGH"
    elif final_confidence >= 0.60:
        tier = "MEDIUM"
    else:
        tier = "LOW"

    # Generate Human-Readable Reasoning String
    reason_parts = []
    if positives:
        reason_parts.append("Matched based on: " + "; ".join(positives[:3]))
    else:
        reason_parts.append(f"Semantic similarity score: {round(scores['semantic']*100, 1)}%")

    if conflicts:
        reason_parts.append("Risk / Discrepancies noted: " + "; ".join(conflicts[:2]))

    reasoning_text = ". ".join(reason_parts) + "."

    return ReconciliationCandidate(
        rank=1,
        activity_id=activity.activity_id,
        id=activity.id,
        activity_name=activity.activity_name,
        discipline=activity.discipline,
        location=activity.location,
        asset_id=activity.asset_id,
        line_id=activity.line_id,
        wbs_name=activity.wbs_name,
        wbs_code=activity.wbs_code,
        level=activity.level or "L5",
        planned_start=activity.planned_start.isoformat() if activity.planned_start else None,
        planned_finish=activity.planned_finish.isoformat() if activity.planned_finish else None,
        planned_progress=activity.planned_progress or 0.0,
        semantic_score=scores["semantic"],
        identifier_score=scores["identifier"],
        discipline_score=scores["discipline"],
        location_score=scores["location"],
        wbs_score=scores["wbs"],
        temporal_score=scores["temporal"],
        final_confidence=final_confidence,
        confidence_tier=tier,
        is_top_match=False,
        reasoning=reasoning_text,
        positive_signals=positives,
        conflicting_signals=conflicts,
        context_signals=context_signals
    )

def reconcile_execution_event(
    db: Session,
    project_id: str,
    raw_text: Optional[str] = None,
    event_id: Optional[str] = None,
    schedule_version: Optional[str] = None,
    top_k: int = 5,
    weights: Optional[ReconciliationWeights] = None,
    discipline_filter: Optional[str] = None,
    persist_candidates: bool = True
) -> ReconciliationResponse:
    """
    Milestone 7: Context-Aware L5/L6 Reconciliation Engine.
    Deterministically computes multi-signal scores (Semantic, ID, Discipline, Location, WBS, Temporal),
    applies user-configurable weights, evaluates missing data neutrally, and ranks candidates descending
    by final multi-signal confidence without auto-approving.
    """
    start_time = time.time()
    active_weights = weights or DEFAULT_WEIGHTS

    # 1. Resolve Project & Active Schedule Version
    proj = db.query(Project).filter(Project.id == project_id).first()
    active_version = schedule_version or (proj.active_schedule_version if proj else "v1.0")

    # 2. Resolve or Extract ExecutionEvent
    event = None
    extracted_facts = {}
    source_id = None
    query_text = ""
    report_date = None

    if event_id:
        event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
        if event:
            raw_text = event.raw_text
            source_id = event.source_id
            report_date = event.report_date

            # Extract facts on the fly if not already extracted
            if not event.activity_description and raw_text:
                extracted_data, _, _, _ = extract_execution_event_with_gemini(raw_text, project_id)
                event.activity_description = extracted_data.activity_description
                event.discipline = extracted_data.discipline
                event.location = extracted_data.location
                event.asset_id = extracted_data.asset_id
                event.line_id = extracted_data.line_id
                event.event_type = extracted_data.event_type
                event.event_progress = extracted_data.progress
                event.evidence_text = extracted_data.evidence_text
                event.extraction_confidence = extracted_data.extraction_confidence
                if extracted_data.actual_start:
                    try:
                        event.actual_start = datetime.fromisoformat(extracted_data.actual_start.replace("Z", "+00:00"))
                    except Exception:
                        pass
                if extracted_data.actual_finish:
                    try:
                        event.actual_finish = datetime.fromisoformat(extracted_data.actual_finish.replace("Z", "+00:00"))
                    except Exception:
                        pass
                db.commit()
                db.refresh(event)

            extracted_facts = {
                "activity_description": event.activity_description,
                "discipline": event.discipline,
                "location": event.location,
                "asset_id": event.asset_id,
                "line_id": event.line_id,
                "event_type": event.event_type,
                "progress": event.event_progress,
                "evidence_text": event.evidence_text,
                "extraction_confidence": event.extraction_confidence
            }
            query_text = f"{event.activity_description or ''} {event.discipline or ''} {event.location or ''} {event.line_id or ''} {event.asset_id or ''}".strip()
            if not query_text:
                query_text = event.raw_text

    if not query_text and raw_text:
        extracted_data, _, _, _ = extract_execution_event_with_gemini(raw_text, project_id)
        extracted_facts = extracted_data.model_dump()
        query_text = f"{extracted_data.activity_description or ''} {extracted_data.discipline or ''} {extracted_data.location or ''} {extracted_data.line_id or ''} {extracted_data.asset_id or ''}".strip()
        if not query_text:
            query_text = raw_text

    if not query_text:
        query_text = "General Construction Activity"

    # 3. Generate dense vector embedding for query text
    query_embedding = generate_embedding(query_text)

    # 4. Fetch schedule activities restricted to project and schedule version
    act_query = db.query(Activity).filter(
        Activity.project_id == project_id,
        Activity.schedule_version == active_version
    )
    if discipline_filter and discipline_filter != "ALL":
        act_query = act_query.filter(Activity.discipline == discipline_filter)

    activities = act_query.all()
    total_evaluated = len(activities)

    if total_evaluated == 0:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return ReconciliationResponse(
            success=True,
            message="No schedule activities found for this project version.",
            event_id=event_id,
            source_id=source_id,
            project_id=project_id,
            schedule_version=active_version,
            raw_text=raw_text,
            extracted_facts=extracted_facts,
            weights_used=active_weights,
            top_candidate=None,
            alternative_candidates=[],
            total_candidates=0,
            total_activities_evaluated=0,
            execution_time_ms=elapsed_ms
        )

    # 5. Compute multi-signal reconciliation score for each candidate activity
    evaluated_candidates: List[ReconciliationCandidate] = []

    for act in activities:
        act_embedding = None
        if act.embedding_json:
            try:
                act_embedding = json.loads(act.embedding_json)
            except Exception:
                act_embedding = None

        if not act_embedding:
            act_text = act.searchable_text or f"{act.activity_name} {act.discipline or ''} {act.location or ''}"
            act_embedding = generate_embedding(act_text)
            act.embedding_json = json.dumps(act_embedding)

        sem_sim = compute_cosine_similarity(query_embedding, act_embedding)

        cand = compute_reconciliation_candidate(
            extracted_facts=extracted_facts,
            activity=act,
            semantic_similarity=sem_sim,
            weights=active_weights,
            report_date=report_date
        )
        evaluated_candidates.append(cand)

    # 6. Rank candidates strictly by Final Multi-Signal Confidence (Descending)
    evaluated_candidates.sort(key=lambda x: x.final_confidence, reverse=True)
    top_candidates = evaluated_candidates[:top_k]

    # Assign ranks
    for rank_idx, cand in enumerate(top_candidates, 1):
        cand.rank = rank_idx
        if rank_idx == 1:
            cand.is_top_match = True

    top_candidate = top_candidates[0] if top_candidates else None
    alternative_candidates = top_candidates[1:] if len(top_candidates) > 1 else []

    # 7. Persist MatchCandidate lineage records in DB for audit trail
    if persist_candidates and event:
        db.query(MatchCandidate).filter(MatchCandidate.event_id == event.id).delete()
        
        db_candidates = []
        for cand in top_candidates:
            mc = MatchCandidate(
                id=f"mc_{uuid.uuid4().hex[:12]}",
                event_id=event.id,
                activity_id=cand.id,
                rank=cand.rank,
                is_top_match=cand.is_top_match,
                semantic_score=cand.semantic_score,
                identifier_score=cand.identifier_score,
                discipline_score=cand.discipline_score,
                location_score=cand.location_score,
                wbs_score=cand.wbs_score,
                temporal_score=cand.temporal_score,
                final_confidence=cand.final_confidence,
                reasoning=cand.reasoning,
                conflicting_signals_json=json.dumps(cand.conflicting_signals),
                status="pending_review",
                created_at=datetime.now(timezone.utc)
            )
            db_candidates.append(mc)

        db.add_all(db_candidates)
        db.commit()

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return ReconciliationResponse(
        success=True,
        message=f"Context-aware reconciliation ranked Top-{len(top_candidates)} candidate activities from {total_evaluated} schedule tasks.",
        event_id=event_id,
        source_id=source_id,
        project_id=project_id,
        schedule_version=active_version,
        raw_text=raw_text,
        extracted_facts=extracted_facts,
        weights_used=active_weights,
        top_candidate=top_candidate,
        alternative_candidates=alternative_candidates,
        total_candidates=len(top_candidates),
        total_activities_evaluated=total_evaluated,
        execution_time_ms=elapsed_ms
    )
