import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from app.database import is_postgresql
from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_event import ExecutionEvent
from app.models.execution_state import ExecutionState
from app.models.match_candidate import MatchCandidate
from app.models.audit_log import AuditLog
from app.services.embedding_service import (
    generate_embedding,
    generate_embeddings_batch,
    compute_cosine_similarity
)
from app.schemas.historical_memory_schema import (
    HistoricalMemoryResult,
    HistoricalMemoryResponse,
    HistoricalMemoryStatsResponse,
    TopDelayReasonMetric
)

logger = logging.getLogger("historical_memory_service")

def _normalize(s: Optional[str]) -> str:
    if not s:
        return ""
    return str(s).strip().lower()

def _compute_context_signals(
    query_facts: Dict[str, Any],
    hist_event: ExecutionEvent,
    hist_act: Optional[Activity] = None
) -> Tuple[float, List[str]]:
    """
    Evaluates contextual signals between query facts and historical verified record.
    Adheres strictly to the project rule: Missing != Contradictory.
    Returns: (context_multiplier_score, matched_signals_list)
    """
    signals: List[str] = []
    scores = []
    
    # 1. Discipline Signal
    q_disc = _normalize(query_facts.get("discipline"))
    h_disc = _normalize(hist_event.discipline or (hist_act.discipline if hist_act else ""))
    
    if not q_disc or q_disc in ["general", "none", "null", "unknown", ""]:
        scores.append(1.0) # Neutral
    elif h_disc == q_disc:
        scores.append(1.0)
        signals.append(f"Same discipline: {(hist_event.discipline or hist_act.discipline).title()}")
    elif h_disc in q_disc or q_disc in h_disc:
        scores.append(0.85)
        signals.append(f"Related discipline: {(hist_event.discipline or hist_act.discipline).title()}")
    else:
        scores.append(0.30)

    # 2. Location Signal
    q_loc = _normalize(query_facts.get("location"))
    h_loc = _normalize(hist_event.location or (hist_act.location if hist_act else ""))
    if not q_loc or not h_loc:
        scores.append(1.0) # Neutral
    elif q_loc == h_loc or q_loc in h_loc or h_loc in q_loc:
        scores.append(1.0)
        signals.append(f"Similar workfront location ({hist_event.location or hist_act.location})")
    else:
        scores.append(0.60)

    # 3. Line / Asset Identifier Signal
    q_asset = _normalize(query_facts.get("asset_id"))
    h_asset = _normalize(hist_event.asset_id or (hist_act.asset_id if hist_act else ""))
    q_line = _normalize(query_facts.get("line_id"))
    h_line = _normalize(hist_event.line_id or (hist_act.line_id if hist_act else ""))
    
    if (q_asset and h_asset and (q_asset == h_asset or q_asset in h_asset or h_asset in q_asset)):
        scores.append(1.0)
        signals.append(f"Same asset tag ({hist_event.asset_id or hist_act.asset_id})")
    elif (q_line and h_line and (q_line == h_line or q_line in h_line or h_line in q_line)):
        scores.append(1.0)
        signals.append(f"Same line identifier ({hist_event.line_id or hist_act.line_id})")
    else:
        scores.append(1.0) # Neutral when unassigned or across projects

    # 4. Event Type Signal
    q_type = _normalize(query_facts.get("event_type"))
    h_type = _normalize(hist_event.event_type)
    if q_type and h_type and q_type == h_type:
        scores.append(1.0)
        signals.append(f"Matching event type ({hist_event.event_type})")
    else:
        scores.append(0.90)

    context_score = float(np.mean(scores)) if scores else 1.0
    return context_score, signals

def search_historical_memory(
    db: Session,
    event_id: Optional[str] = None,
    raw_text: Optional[str] = None,
    extracted_facts: Optional[Dict[str, Any]] = None,
    project_id: Optional[str] = None,
    top_k: int = 5,
    min_similarity: float = 0.50
) -> HistoricalMemoryResponse:
    """
    Phase 4: Institutional Memory Retrieval Service.
    Retrieves verified historical execution events similar to the current execution event.
    Only records with status == 'VERIFIED' enter institutional memory.
    """
    query_text = ""
    query_facts: Dict[str, Any] = extracted_facts or {}
    exclude_event_id = event_id
    current_proj_id = project_id

    # 1. Resolve query context from current event if event_id is provided
    if event_id:
        current_event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
        if current_event:
            current_proj_id = current_event.project_id or current_proj_id
            if not query_facts:
                query_facts = {
                    "activity_description": current_event.activity_description,
                    "discipline": current_event.discipline,
                    "location": current_event.location,
                    "asset_id": current_event.asset_id,
                    "line_id": current_event.line_id,
                    "event_type": current_event.event_type
                }
            query_text = f"{current_event.activity_description or ''} {current_event.discipline or ''} {current_event.location or ''} {current_event.line_id or ''} {current_event.asset_id or ''}".strip()
            if not query_text:
                query_text = current_event.raw_text

    if not query_text and raw_text:
        query_text = raw_text.strip()
    if not query_text and query_facts.get("activity_description"):
        query_text = f"{query_facts.get('activity_description')} {query_facts.get('discipline') or ''} {query_facts.get('location') or ''}".strip()

    if not query_text:
        query_text = "General Construction Execution"

    # 2. Generate dense vector embedding for query text
    query_embedding = generate_embedding(query_text)

    # 3. Query all VERIFIED ExecutionEvents from DB (excluding the current event itself)
    base_query = db.query(ExecutionEvent).filter(
        ExecutionEvent.status == "VERIFIED"
    )
    if exclude_event_id:
        base_query = base_query.filter(ExecutionEvent.id != exclude_event_id)

    # If Postgres + pgvector is active, we can leverage vector distance as an index scan
    candidate_events: List[Tuple[ExecutionEvent, float]] = []
    
    if is_postgresql():
        try:
            vec_query = db.query(
                ExecutionEvent,
                ExecutionEvent.embedding.cosine_distance(query_embedding).label("dist")
            ).filter(
                ExecutionEvent.status == "VERIFIED",
                ExecutionEvent.embedding.isnot(None)
            )
            if exclude_event_id:
                vec_query = vec_query.filter(ExecutionEvent.id != exclude_event_id)
            
            results = vec_query.order_by("dist").limit(top_k * 3).all()
            for ev, dist in results:
                sem_sim = max(0.0, min(1.0, 1.0 - float(dist) if dist is not None else 0.0))
                candidate_events.append((ev, sem_sim))
        except Exception as e:
            logger.warning(f"Native pgvector historical search failed ({e}). Falling back to in-memory.")
            candidate_events = []

    # Fallback / SQLite path
    if not candidate_events:
        all_verified_events = base_query.all()
        for ev in all_verified_events:
            ev_emb = None
            if ev.embedding is not None:
                ev_emb = ev.embedding if isinstance(ev.embedding, (list, np.ndarray)) else list(ev.embedding)
            elif ev.embedding_json:
                try:
                    ev_emb = json.loads(ev.embedding_json)
                except Exception:
                    ev_emb = None

            if not ev_emb:
                ev_text = f"{ev.activity_description or ev.raw_text} {ev.discipline or ''} {ev.location or ''}".strip()
                ev_emb = generate_embedding(ev_text)
                ev.embedding = ev_emb
                ev.embedding_json = json.dumps(ev_emb)

            sem_sim = compute_cosine_similarity(query_embedding, ev_emb)
            candidate_events.append((ev, sem_sim))

    total_searched = len(candidate_events)

    if total_searched == 0:
        return HistoricalMemoryResponse(
            success=True,
            message="No relevant verified historical evidence found.",
            event_id=event_id,
            query_description=query_text,
            total_historical_verified_searched=0,
            total_results=0,
            results=[],
            historical_delay_summary=None
        )

    # 4. Score and populate rich provenance for each candidate
    scored_results: List[HistoricalMemoryResult] = []
    
    # Pre-cache projects
    projects_map = {p.id: p.name for p in db.query(Project).all()}

    for ev, sem_sim in candidate_events:
        # Resolve linked activity if available via approved candidate or execution state
        approved_cand = db.query(MatchCandidate).filter(
            MatchCandidate.event_id == ev.id,
            MatchCandidate.status == "approved"
        ).first()

        linked_act = None
        linked_state = None
        if approved_cand:
            linked_act = db.query(Activity).filter(Activity.id == approved_cand.activity_id).first()
            if linked_act:
                linked_state = db.query(ExecutionState).filter(ExecutionState.activity_id == linked_act.id).first()

        context_score, signals = _compute_context_signals(query_facts, ev, linked_act)

        # Combined Similarity Score: 70% Semantic + 30% Contextual
        combined_similarity = round(max(0.0, min(1.0, (sem_sim * 0.70) + (context_score * 0.30))), 4)

        if sem_sim >= 0.75:
            signals.insert(0, f"High semantic alignment ({round(sem_sim * 100, 1)}%)")
        elif sem_sim >= 0.55:
            signals.insert(0, f"Moderate semantic similarity ({round(sem_sim * 100, 1)}%)")

        # Skip candidates below min_similarity threshold
        if combined_similarity < min_similarity:
            continue

        # Calculate Duration
        duration_days = None
        if ev.actual_start and ev.actual_finish:
            d_start = ev.actual_start.date() if hasattr(ev.actual_start, "date") else ev.actual_start
            d_fin = ev.actual_finish.date() if hasattr(ev.actual_finish, "date") else ev.actual_finish
            duration_days = max(1.0, float((d_fin - d_start).days))
        elif linked_act and linked_act.planned_duration:
            duration_days = float(linked_act.planned_duration)

        # Verification provenance
        ver_time_str = None
        if approved_cand and approved_cand.review_timestamp:
            ver_time_str = approved_cand.review_timestamp.strftime("%d %b %Y")
        elif ev.report_date:
            ver_time_str = ev.report_date.strftime("%d %b %Y")

        reviewer = approved_cand.reviewer_id if (approved_cand and approved_cand.reviewer_id) else "PLANNER_USER"

        delay_reason = ev.delay_reason or (linked_state.delay_reason if linked_state else None)
        delay_days = linked_state.delay_days if linked_state else 0.0

        is_same_proj = (current_proj_id is not None and ev.project_id == current_proj_id)

        result_item = HistoricalMemoryResult(
            historical_event_id=ev.id,
            project_id=ev.project_id,
            project_name=projects_map.get(ev.project_id, ev.project_id),
            activity_id=linked_act.activity_id if linked_act else None,
            activity_name=linked_act.activity_name if linked_act else (ev.activity_description or "Verified Execution"),
            activity_code=linked_act.activity_code if linked_act else None,
            description=ev.activity_description or ev.raw_text,
            raw_text=ev.raw_text,
            discipline=ev.discipline or (linked_act.discipline if linked_act else None),
            location=ev.location or (linked_act.location if linked_act else None),
            asset_id=ev.asset_id or (linked_act.asset_id if linked_act else None),
            line_id=ev.line_id or (linked_act.line_id if linked_act else None),
            event_type=ev.event_type or "progress",
            actual_start=ev.actual_start.isoformat() if ev.actual_start else None,
            actual_finish=ev.actual_finish.isoformat() if ev.actual_finish else None,
            actual_progress=ev.event_progress or (linked_state.actual_progress if linked_state else 100.0),
            duration_days=duration_days,
            delay_days=delay_days,
            delay_reason=delay_reason,
            verification_status="VERIFIED",
            verification_timestamp=ver_time_str,
            reviewer_id=reviewer,
            evidence_text=ev.evidence_text,
            source_reference=ev.source_reference or ev.source_id,
            similarity=combined_similarity,
            semantic_similarity=round(sem_sim, 4),
            matched_signals=signals,
            is_same_project=is_same_proj
        )
        scored_results.append(result_item)

    # 5. Rank: Cross-project history is highly valued, sort descending by similarity
    scored_results.sort(key=lambda x: x.similarity, reverse=True)
    top_results = scored_results[:top_k]

    if not top_results:
        return HistoricalMemoryResponse(
            success=True,
            message="No relevant verified historical evidence found.",
            event_id=event_id,
            query_description=query_text,
            total_historical_verified_searched=total_searched,
            total_results=0,
            results=[],
            historical_delay_summary=None
        )

    # 6. Compute Descriptive Historical Delay Summary (NO PREDICTIVE AI)
    delayed_items = [r for r in top_results if (r.delay_reason and len(r.delay_reason.strip()) > 0 and r.delay_reason.lower() not in ["none", "no delay", "on schedule", "null"])]
    num_delayed = len(delayed_items)
    total_retrieved = len(top_results)

    if num_delayed > 0:
        delay_causes = [d.delay_reason for d in delayed_items if d.delay_reason]
        cause_sample = f" (e.g. {delay_causes[0]})" if delay_causes else ""
        delay_summary = f"Historical pattern: {num_delayed} of {total_retrieved} retrieved similar verified activities recorded a delay{cause_sample}."
    else:
        delay_summary = f"Historical pattern: None of the {total_retrieved} retrieved similar verified activities recorded a delay."

    return HistoricalMemoryResponse(
        success=True,
        message=f"Found {len(top_results)} verified historical execution records matching criteria.",
        event_id=event_id,
        query_description=query_text,
        total_historical_verified_searched=total_searched,
        total_results=len(top_results),
        results=top_results,
        historical_delay_summary=delay_summary
    )

def get_historical_memory_stats(db: Session) -> HistoricalMemoryStatsResponse:
    """
    Computes real aggregate metrics from verified historical executions in the database.
    Strictly zero fabrication.
    """
    verified_events = db.query(ExecutionEvent).filter(ExecutionEvent.status == "VERIFIED").all()
    total_verified = len(verified_events)
    
    if total_verified == 0:
        return HistoricalMemoryStatsResponse(
            success=True,
            total_verified_historical_events=0,
            verified_events_with_delays=0,
            delay_incidence_rate=0.0,
            projects_count=0,
            disciplines_count=0,
            top_delay_reasons=[]
        )

    projects_set = set()
    disciplines_set = set()
    delay_count = 0
    delay_reasons_map: Dict[str, Dict[str, Any]] = {}

    for ev in verified_events:
        if ev.project_id:
            projects_set.add(ev.project_id)
        if ev.discipline:
            disciplines_set.add(ev.discipline)
        
        d_reason = ev.delay_reason
        if d_reason and len(d_reason.strip()) > 0 and d_reason.lower() not in ["none", "no delay", "on schedule", "null"]:
            delay_count += 1
            clean_reason = d_reason.strip()
            if clean_reason not in delay_reasons_map:
                delay_reasons_map[clean_reason] = {"count": 0, "disciplines": set()}
            delay_reasons_map[clean_reason]["count"] += 1
            if ev.discipline:
                delay_reasons_map[clean_reason]["disciplines"].add(ev.discipline)

    incidence_rate = round((delay_count / total_verified) * 100, 1) if total_verified > 0 else 0.0

    top_reasons_list = [
        TopDelayReasonMetric(
            reason=r,
            count=data["count"],
            disciplines=list(data["disciplines"])
        )
        for r, data in delay_reasons_map.items()
    ]
    top_reasons_list.sort(key=lambda x: x.count, reverse=True)

    return HistoricalMemoryStatsResponse(
        success=True,
        total_verified_historical_events=total_verified,
        verified_events_with_delays=delay_count,
        delay_incidence_rate=incidence_rate,
        projects_count=len(projects_set),
        disciplines_count=len(disciplines_set),
        top_delay_reasons=top_reasons_list[:5]
    )

def seed_demo_historical_memory(db: Session) -> int:
    """
    Seeds a realistic, deterministic historical execution dataset representing
    prior verified projects (PRJ-ALPHA, PRJ-BETA).
    Strictly goes through standard data models and VERIFIED lifecycle state.
    """
    existing_count = db.query(ExecutionEvent).filter(
        ExecutionEvent.project_id.in_(["PRJ-ALPHA", "PRJ-BETA"]),
        ExecutionEvent.status == "VERIFIED"
    ).count()

    if existing_count >= 6:
        return existing_count

    # 1. Ensure Projects Exist
    p_alpha = db.query(Project).filter(Project.id == "PRJ-ALPHA").first()
    if not p_alpha:
        p_alpha = Project(
            id="PRJ-ALPHA",
            name="Alpha Petrochemical Complex - Phase 1",
            code="PRJ-ALPHA",
            active_schedule_version="v1.0"
        )
        db.add(p_alpha)

    p_beta = db.query(Project).filter(Project.id == "PRJ-BETA").first()
    if not p_beta:
        p_beta = Project(
            id="PRJ-BETA",
            name="Beta Gas Pipeline & Compressor Station",
            code="PRJ-BETA",
            active_schedule_version="v1.0"
        )
        db.add(p_beta)

    db.flush()

    # 2. Historical Activity Scopes
    historical_activities_data = [
        # Project Alpha Activities
        {
            "id": "PRJ-ALPHA_v1.0_MEC-AL-01",
            "project_id": "PRJ-ALPHA",
            "schedule_version": "v1.0",
            "activity_id": "MEC-AL-01",
            "activity_code": "PMP-ALIGN-01",
            "activity_name": "Centrifugal Pump P-101A Alignment & Coupling",
            "discipline": "Mechanical",
            "location": "Pump House Bay 1",
            "asset_id": "P-101A",
            "planned_duration": 2.0,
            "planned_progress": 100.0,
            "searchable_text": "Activity: Centrifugal Pump P-101A Alignment & Coupling | Discipline: Mechanical | Location: Pump House Bay 1 | Asset: P-101A"
        },
        {
            "id": "PRJ-ALPHA_v1.0_CIV-AL-02",
            "project_id": "PRJ-ALPHA",
            "schedule_version": "v1.0",
            "activity_id": "CIV-AL-02",
            "activity_code": "CIV-FND-02",
            "activity_name": "Pump Foundation Pedestal Concrete Pouring",
            "discipline": "Civil",
            "location": "Area PR-01",
            "asset_id": "P-101A",
            "planned_duration": 4.0,
            "planned_progress": 100.0,
            "searchable_text": "Activity: Pump Foundation Pedestal Concrete Pouring | Discipline: Civil | Location: Area PR-01 | Asset: P-101A"
        },
        {
            "id": "PRJ-ALPHA_v1.0_PIP-AL-03",
            "project_id": "PRJ-ALPHA",
            "schedule_version": "v1.0",
            "activity_id": "PIP-AL-03",
            "activity_code": "PIP-WLD-03",
            "activity_name": "24-inch Carbon Steel Process Pipe Spool Welding & Radiography",
            "discipline": "Piping",
            "location": "Area PR-04",
            "line_id": "24-XX-01",
            "planned_duration": 3.0,
            "planned_progress": 100.0,
            "searchable_text": "Activity: 24-inch Carbon Steel Process Pipe Spool Welding & Radiography | Discipline: Piping | Location: Area PR-04 | Line: 24-XX-01"
        },
        # Project Beta Activities
        {
            "id": "PRJ-BETA_v1.0_MEC-BT-01",
            "project_id": "PRJ-BETA",
            "schedule_version": "v1.0",
            "activity_id": "MEC-BT-01",
            "activity_code": "CMP-ALIGN-01",
            "activity_name": "Booster Compressor Shaft Laser Alignment",
            "discipline": "Mechanical",
            "location": "Compressor Bay 2",
            "asset_id": "CMP-02",
            "planned_duration": 3.0,
            "planned_progress": 100.0,
            "searchable_text": "Activity: Booster Compressor Shaft Laser Alignment | Discipline: Mechanical | Location: Compressor Bay 2 | Asset: CMP-02"
        },
        {
            "id": "PRJ-BETA_v1.0_ELE-BT-02",
            "project_id": "PRJ-BETA",
            "schedule_version": "v1.0",
            "activity_id": "ELE-BT-02",
            "activity_code": "ELE-CBL-02",
            "activity_name": "33kV Medium Voltage Power Cable Pulling & Termination",
            "discipline": "Electrical",
            "location": "Substation 3 Trench",
            "asset_id": "TR-03",
            "planned_duration": 5.0,
            "planned_progress": 100.0,
            "searchable_text": "Activity: 33kV Medium Voltage Power Cable Pulling & Termination | Discipline: Electrical | Location: Substation 3 Trench | Asset: TR-03"
        },
        {
            "id": "PRJ-BETA_v1.0_PIP-BT-03",
            "project_id": "PRJ-BETA",
            "schedule_version": "v1.0",
            "activity_id": "PIP-BT-03",
            "activity_code": "PIP-FIT-03",
            "activity_name": "16-inch Gas Header Pipe Spool Erection & Bolt Torque",
            "discipline": "Piping",
            "location": "Gas Metering Station",
            "line_id": "16-GS-10",
            "planned_duration": 2.0,
            "planned_progress": 100.0,
            "searchable_text": "Activity: 16-inch Gas Header Pipe Spool Erection & Bolt Torque | Discipline: Piping | Location: Gas Metering Station | Line: 16-GS-10"
        }
    ]

    for item in historical_activities_data:
        existing_act = db.query(Activity).filter(Activity.id == item["id"]).first()
        if not existing_act:
            emb = generate_embedding(item["searchable_text"])
            act = Activity(
                id=item["id"],
                project_id=item["project_id"],
                schedule_version=item["schedule_version"],
                activity_id=item["activity_id"],
                activity_code=item["activity_code"],
                activity_name=item["activity_name"],
                discipline=item["discipline"],
                location=item["location"],
                asset_id=item.get("asset_id"),
                line_id=item.get("line_id"),
                planned_duration=item["planned_duration"],
                planned_progress=item["planned_progress"],
                searchable_text=item["searchable_text"],
                embedding=emb,
                embedding_json=json.dumps(emb)
            )
            db.add(act)

    db.flush()

    # 3. Verified Historical Execution Events
    now = datetime.now(timezone.utc)
    historical_events_data = [
        {
            "id": "HIST-EV-ALPHA-01",
            "project_id": "PRJ-ALPHA",
            "source_id": "DPR-ALPHA-2025-11-14",
            "source_type": "SITE_DIARY",
            "source_reference": "DPR_ALPHA_MEC_20251114.pdf",
            "reporter_name": "K. Sengupta (Lead Mech Supervisor)",
            "report_date": now - timedelta(days=180),
            "raw_text": "Completed pump alignment and dial gauge runout inspection for centrifugal pump P-101A at Pump House Bay 1. Dial readings within 0.03mm tolerance. Minor 1-day lag experienced due to alignment rework and soft foot correction.",
            "activity_description": "Centrifugal pump alignment and dial runout inspection",
            "discipline": "Mechanical",
            "location": "Pump House Bay 1",
            "asset_id": "P-101A",
            "event_type": "completion",
            "actual_start": now - timedelta(days=183),
            "actual_finish": now - timedelta(days=180),
            "event_progress": 100.0,
            "delay_reason": "Alignment rework and soft foot correction",
            "evidence_text": "Completed pump alignment and dial gauge runout inspection for centrifugal pump P-101A at Pump House Bay 1.",
            "target_act_id": "PRJ-ALPHA_v1.0_MEC-AL-01",
            "delay_days": 1.0
        },
        {
            "id": "HIST-EV-ALPHA-02",
            "project_id": "PRJ-ALPHA",
            "source_id": "DPR-ALPHA-2025-10-20",
            "source_type": "SUPERVISOR_LOG",
            "source_reference": "DPR_ALPHA_CIV_20251020.pdf",
            "reporter_name": "R. Verma (Civil Engineer)",
            "report_date": now - timedelta(days=210),
            "raw_text": "Finished pouring M35 grade concrete for pump foundation pedestal at Area PR-01. Curing blankets installed. No deviations.",
            "activity_description": "Pump foundation pedestal concrete pouring",
            "discipline": "Civil",
            "location": "Area PR-01",
            "asset_id": "P-101A",
            "event_type": "completion",
            "actual_start": now - timedelta(days=214),
            "actual_finish": now - timedelta(days=210),
            "event_progress": 100.0,
            "delay_reason": "None",
            "evidence_text": "Finished pouring M35 grade concrete for pump foundation pedestal at Area PR-01.",
            "target_act_id": "PRJ-ALPHA_v1.0_CIV-AL-02",
            "delay_days": 0.0
        },
        {
            "id": "HIST-EV-ALPHA-03",
            "project_id": "PRJ-ALPHA",
            "source_id": "DPR-ALPHA-2025-12-05",
            "source_type": "DPR_TEXT",
            "source_reference": "DPR_ALPHA_PIP_20251205.pdf",
            "reporter_name": "S. Naidu (Piping QC Inspector)",
            "report_date": now - timedelta(days=150),
            "raw_text": "24-inch spool welding and 100% radiography testing completed for Line 24-XX-01 in Area PR-04. 2 joint re-shoots required due to radiographic film blemish, causing 2 days delay.",
            "activity_description": "24-inch spool welding and radiography testing",
            "discipline": "Piping",
            "location": "Area PR-04",
            "line_id": "24-XX-01",
            "event_type": "completion",
            "actual_start": now - timedelta(days=155),
            "actual_finish": now - timedelta(days=150),
            "event_progress": 100.0,
            "delay_reason": "Radiography weld re-shot and film inspection delay",
            "evidence_text": "24-inch spool welding and 100% radiography testing completed for Line 24-XX-01 in Area PR-04.",
            "target_act_id": "PRJ-ALPHA_v1.0_PIP-AL-03",
            "delay_days": 2.0
        },
        {
            "id": "HIST-EV-BETA-01",
            "project_id": "PRJ-BETA",
            "source_id": "DPR-BETA-2026-01-18",
            "source_type": "SUPERVISOR_LOG",
            "source_reference": "DPR_BETA_MEC_20260118.pdf",
            "reporter_name": "A. Kulkarni (Rotating Equip Lead)",
            "report_date": now - timedelta(days=90),
            "raw_text": "Laser shaft alignment for booster compressor CMP-02 at Compressor Bay 2 verified 100% complete. Coupling bolts torqued to specification without issues.",
            "activity_description": "Compressor shaft laser alignment and coupling torque",
            "discipline": "Mechanical",
            "location": "Compressor Bay 2",
            "asset_id": "CMP-02",
            "event_type": "completion",
            "actual_start": now - timedelta(days=93),
            "actual_finish": now - timedelta(days=90),
            "event_progress": 100.0,
            "delay_reason": "None",
            "evidence_text": "Laser shaft alignment for booster compressor CMP-02 at Compressor Bay 2 verified 100% complete.",
            "target_act_id": "PRJ-BETA_v1.0_MEC-BT-01",
            "delay_days": 0.0
        },
        {
            "id": "HIST-EV-BETA-02",
            "project_id": "PRJ-BETA",
            "source_id": "DPR-BETA-2026-02-10",
            "source_type": "SITE_DIARY",
            "source_reference": "DPR_BETA_ELE_20260210.pdf",
            "reporter_name": "M. Joshi (Electrical Supv)",
            "report_date": now - timedelta(days=60),
            "raw_text": "Completed pulling 33kV medium voltage cable along Substation 3 trench. Hi-pot insulation testing passed. Cable tray bracket fabrication caused minor schedule slippage.",
            "activity_description": "33kV medium voltage cable pulling and insulation testing",
            "discipline": "Electrical",
            "location": "Substation 3 Trench",
            "asset_id": "TR-03",
            "event_type": "completion",
            "actual_start": now - timedelta(days=66),
            "actual_finish": now - timedelta(days=60),
            "event_progress": 100.0,
            "delay_reason": "Cable tray bracket fabrication lag",
            "evidence_text": "Completed pulling 33kV medium voltage cable along Substation 3 trench.",
            "target_act_id": "PRJ-BETA_v1.0_ELE-BT-02",
            "delay_days": 1.0
        },
        {
            "id": "HIST-EV-BETA-03",
            "project_id": "PRJ-BETA",
            "source_id": "DPR-BETA-2026-03-01",
            "source_type": "FILE_UPLOAD",
            "source_reference": "DPR_BETA_PIP_20260301.pdf",
            "reporter_name": "T. Bannerjee (Site Lead)",
            "report_date": now - timedelta(days=35),
            "raw_text": "Erection and flange bolting of 16-inch gas header spool on Line 16-GS-10 at Gas Metering Station completed and hydrotest punch list cleared.",
            "activity_description": "16-inch gas header spool erection and bolting",
            "discipline": "Piping",
            "location": "Gas Metering Station",
            "line_id": "16-GS-10",
            "event_type": "completion",
            "actual_start": now - timedelta(days=37),
            "actual_finish": now - timedelta(days=35),
            "event_progress": 100.0,
            "delay_reason": "None",
            "evidence_text": "Erection and flange bolting of 16-inch gas header spool on Line 16-GS-10 at Gas Metering Station completed.",
            "target_act_id": "PRJ-BETA_v1.0_PIP-BT-03",
            "delay_days": 0.0
        }
    ]

    inserted_count = 0
    for ev_data in historical_events_data:
        existing = db.query(ExecutionEvent).filter(ExecutionEvent.id == ev_data["id"]).first()
        if not existing:
            emb_text = f"{ev_data['activity_description']} {ev_data['discipline']} {ev_data['location']} {ev_data.get('line_id') or ''} {ev_data.get('asset_id') or ''}".strip()
            emb = generate_embedding(emb_text)
            
            ev_obj = ExecutionEvent(
                id=ev_data["id"],
                project_id=ev_data["project_id"],
                source_id=ev_data["source_id"],
                source_type=ev_data["source_type"],
                source_reference=ev_data["source_reference"],
                reporter_name=ev_data["reporter_name"],
                report_date=ev_data["report_date"],
                raw_text=ev_data["raw_text"],
                activity_description=ev_data["activity_description"],
                discipline=ev_data["discipline"],
                location=ev_data["location"],
                asset_id=ev_data.get("asset_id"),
                line_id=ev_data.get("line_id"),
                event_type=ev_data["event_type"],
                actual_start=ev_data["actual_start"],
                actual_finish=ev_data["actual_finish"],
                event_progress=ev_data["event_progress"],
                status="VERIFIED",
                delay_reason=ev_data["delay_reason"],
                evidence_text=ev_data["evidence_text"],
                extraction_confidence=0.96,
                embedding=emb,
                embedding_json=json.dumps(emb),
                ingestion_timestamp=ev_data["report_date"]
            )
            db.add(ev_obj)

            # ExecutionState
            st = db.query(ExecutionState).filter(ExecutionState.activity_id == ev_data["target_act_id"]).first()
            if not st:
                st = ExecutionState(
                    id=f"state_{ev_data['target_act_id']}",
                    project_id=ev_data["project_id"],
                    activity_id=ev_data["target_act_id"],
                    actual_start=ev_data["actual_start"],
                    actual_finish=ev_data["actual_finish"],
                    actual_progress=100.0,
                    status="Completed",
                    delay_days=ev_data["delay_days"],
                    delay_reason=ev_data["delay_reason"],
                    verified_observations_count=1,
                    last_event_id=ev_data["id"],
                    last_updated=ev_data["report_date"],
                    approval_state="VERIFIED"
                )
                db.add(st)
            else:
                st.actual_progress = 100.0
                st.status = "Completed"
                st.approval_state = "VERIFIED"
                st.delay_days = ev_data["delay_days"]
                st.delay_reason = ev_data["delay_reason"]

            # MatchCandidate
            cand_id = f"mc_{uuid.uuid4().hex[:12]}"
            cand = MatchCandidate(
                id=cand_id,
                event_id=ev_data["id"],
                activity_id=ev_data["target_act_id"],
                rank=1,
                is_top_match=True,
                semantic_score=0.94,
                identifier_score=1.0,
                discipline_score=1.0,
                location_score=1.0,
                wbs_score=1.0,
                temporal_score=1.0,
                final_confidence=0.95,
                reasoning="Historical verified match approved by Lead Planner.",
                status="approved",
                reviewer_id="HISTORICAL_LEAD_PLANNER",
                review_timestamp=ev_data["report_date"]
            )
            db.add(cand)

            # AuditLog
            audit = AuditLog(
                id=f"aud_{uuid.uuid4().hex[:12]}",
                project_id=ev_data["project_id"],
                event_id=ev_data["id"],
                activity_id=ev_data["target_act_id"],
                action_type="PLANNER_APPROVAL",
                decision_reason="Verified historical milestone approved into institutional memory.",
                confidence=0.95,
                performed_by="HISTORICAL_LEAD_PLANNER",
                timestamp=ev_data["report_date"]
            )
            db.add(audit)

            inserted_count += 1

    db.commit()
    logger.info(f"Seed demo historical memory completed: {inserted_count} verified records initialized.")
    return inserted_count
