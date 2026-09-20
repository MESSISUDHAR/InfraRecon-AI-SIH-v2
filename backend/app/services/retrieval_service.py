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
from app.models.match_candidate import MatchCandidate
from app.services.embedding_service import (
    generate_embedding,
    compute_cosine_similarity
)
from app.services.extractor_service import extract_execution_event_with_gemini
from app.schemas.candidate_schema import (
    CandidateActivityDetail,
    CandidateRetrievalResponse
)

logger = logging.getLogger("retrieval_service")

def normalize_str(s: Optional[str]) -> str:
    if not s:
        return ""
    return str(s).strip().lower()

def evaluate_context_signals(
    extracted_discipline: Optional[str],
    extracted_location: Optional[str],
    extracted_asset_id: Optional[str],
    extracted_line_id: Optional[str],
    activity: Activity
) -> Dict[str, Any]:
    """
    Evaluates alignment between extracted facts and candidate schedule activity.
    Adheres to the missing data rule: missing fields in field report are neutral/null,
    not negative penalties.
    """
    signals = {}
    
    # 1. Discipline Signal
    act_disc = normalize_str(activity.discipline)
    ext_disc = normalize_str(extracted_discipline)
    if not ext_disc or ext_disc in ["general", "none", "null"]:
        signals["discipline_match"] = "NEUTRAL (No specific discipline in report)"
        signals["discipline_aligned"] = True
    elif act_disc == ext_disc:
        signals["discipline_match"] = f"EXACT MATCH ({activity.discipline})"
        signals["discipline_aligned"] = True
    elif act_disc in ext_disc or ext_disc in act_disc:
        signals["discipline_match"] = f"PARTIAL MATCH ({activity.discipline})"
        signals["discipline_aligned"] = True
    else:
        signals["discipline_match"] = f"MISMATCH ({ext_disc.title()} vs {act_disc.title()})"
        signals["discipline_aligned"] = False

    # 2. Location Signal
    act_loc = normalize_str(activity.location)
    ext_loc = normalize_str(extracted_location)
    if not ext_loc:
        signals["location_match"] = "NEUTRAL (No location specified in report)"
        signals["location_aligned"] = True
    elif not act_loc:
        signals["location_match"] = "NEUTRAL (Activity has no location tag)"
        signals["location_aligned"] = True
    elif act_loc == ext_loc or ext_loc in act_loc or act_loc in ext_loc:
        signals["location_match"] = f"MATCH ({activity.location})"
        signals["location_aligned"] = True
    else:
        signals["location_match"] = f"DIFFERENT ({extracted_location} vs {activity.location})"
        signals["location_aligned"] = False

    # 3. Line / Asset Identifier Signal
    act_line = normalize_str(activity.line_id)
    ext_line = normalize_str(extracted_line_id)
    act_asset = normalize_str(activity.asset_id)
    ext_asset = normalize_str(extracted_asset_id)

    id_match_type = "NEUTRAL (No identifiers in report)"
    id_aligned = True

    if ext_line and act_line and (ext_line == act_line or ext_line in act_line or act_line in ext_line):
        id_match_type = f"LINE ID MATCH ({activity.line_id})"
        id_aligned = True
    elif ext_asset and act_asset and (ext_asset == act_asset or ext_asset in act_asset or act_asset in ext_asset):
        id_match_type = f"ASSET ID MATCH ({activity.asset_id})"
        id_aligned = True
    elif (ext_line and act_line and ext_line != act_line) or (ext_asset and act_asset and ext_asset != act_asset):
        id_match_type = "IDENTIFIER MISMATCH"
        id_aligned = False
    elif ext_line or ext_asset:
        id_match_type = "UNMATCHED IDENTIFIER (Activity lacks matching tag)"

    signals["identifier_match"] = id_match_type
    signals["identifier_aligned"] = id_aligned

    return signals

def retrieve_top_k_candidates(
    db: Session,
    project_id: str,
    raw_text: Optional[str] = None,
    event_id: Optional[str] = None,
    schedule_version: Optional[str] = None,
    top_k: int = 5,
    discipline_filter: Optional[str] = None,
    persist_candidates: bool = True
) -> CandidateRetrievalResponse:
    """
    Milestone 6: Restricts candidate retrieval to active schedule, generates query embedding,
    computes dense cosine similarities against all project activities, evaluates available
    context dimensions, and returns ranked Top-K candidate list without auto-approving.
    """
    start_time = time.time()
    
    # 1. Resolve Target Project & Schedule Version
    proj = db.query(Project).filter(Project.id == project_id).first()
    active_version = schedule_version or (proj.active_schedule_version if proj else "v1.0")

    # 2. Resolve or Extract ExecutionEvent
    event = None
    extracted_facts = {}
    source_id = None
    query_text = ""

    if event_id:
        event = db.query(ExecutionEvent).filter(ExecutionEvent.id == event_id).first()
        if event:
            raw_text = event.raw_text
            source_id = event.source_id
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
        # Extract structured facts on the fly using extraction service
        extracted_data, _, _, _ = extract_execution_event_with_gemini(raw_text, project_id)
        extracted_facts = extracted_data.model_dump()
        query_text = f"{extracted_data.activity_description or ''} {extracted_data.discipline or ''} {extracted_data.location or ''} {extracted_data.line_id or ''} {extracted_data.asset_id or ''}".strip()
        if not query_text:
            query_text = raw_text

    if not query_text:
        query_text = "General Construction Activity"

    # 3. Generate dense vector embedding for the query
    query_embedding = generate_embedding(query_text)

    # 4. Fetch Activities restricted to Project and Schedule Version
    act_query = db.query(Activity).filter(
        Activity.project_id == project_id,
        Activity.schedule_version == active_version
    )
    if discipline_filter and discipline_filter != "ALL":
        act_query = act_query.filter(Activity.discipline == discipline_filter)

    activities = act_query.all()
    total_searched = len(activities)

    if total_searched == 0:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return CandidateRetrievalResponse(
            success=True,
            message="No schedule activities found for this project version.",
            event_id=event_id,
            source_id=source_id,
            project_id=project_id,
            schedule_version=active_version,
            raw_text=raw_text,
            extracted_facts=extracted_facts,
            top_candidate=None,
            alternative_candidates=[],
            total_candidates=0,
            total_activities_searched=0,
            execution_time_ms=elapsed_ms
        )

    # 5. Score Candidates via Sentence Transformers Cosine Similarity
    candidates_list: List[CandidateActivityDetail] = []
    
    for act in activities:
        act_embedding = None
        if act.embedding is not None:
            act_embedding = act.embedding if isinstance(act.embedding, list) else list(act.embedding)
        elif act.embedding_json:
            try:
                act_embedding = json.loads(act.embedding_json)
            except Exception:
                act_embedding = None

        if not act_embedding:
            act_text = act.searchable_text or f"{act.activity_name} {act.discipline or ''} {act.location or ''}"
            act_embedding = generate_embedding(act_text)
            act.embedding = act_embedding
            act.embedding_json = json.dumps(act_embedding)

        similarity = compute_cosine_similarity(query_embedding, act_embedding)

        # Context alignment evaluation
        signals = evaluate_context_signals(
            extracted_discipline=extracted_facts.get("discipline"),
            extracted_location=extracted_facts.get("location"),
            extracted_asset_id=extracted_facts.get("asset_id"),
            extracted_line_id=extracted_facts.get("line_id"),
            activity=act
        )

        candidates_list.append(
            CandidateActivityDetail(
                rank=1,
                activity_id=act.activity_id,
                id=act.id,
                activity_name=act.activity_name,
                discipline=act.discipline,
                location=act.location,
                asset_id=act.asset_id,
                line_id=act.line_id,
                wbs_name=act.wbs_name,
                wbs_code=act.wbs_code,
                level=act.level or "L5",
                planned_start=act.planned_start.isoformat() if act.planned_start else None,
                planned_finish=act.planned_finish.isoformat() if act.planned_finish else None,
                planned_progress=act.planned_progress or 0.0,
                semantic_score=round(similarity, 4),
                is_top_match=False,
                context_signals=signals
            )
        )

    # 6. Rank candidates descending by semantic similarity score
    candidates_list.sort(key=lambda x: x.semantic_score, reverse=True)
    top_candidates = candidates_list[:top_k]

    # Assign ranks and mark top match
    for rank_idx, cand in enumerate(top_candidates, 1):
        cand.rank = rank_idx
        if rank_idx == 1:
            cand.is_top_match = True

    top_candidate = top_candidates[0] if top_candidates else None
    alternative_candidates = top_candidates[1:] if len(top_candidates) > 1 else []

    # 7. Optionally persist MatchCandidate records for audit & lineage (status: pending_review)
    if persist_candidates and event:
        # Clear previous candidates for this event to keep fresh Top-K
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
                status="pending_review",
                created_at=datetime.now(timezone.utc)
            )
            db_candidates.append(mc)
            
        db.add_all(db_candidates)
        db.commit()

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return CandidateRetrievalResponse(
        success=True,
        message=f"Retrieved Top-{len(top_candidates)} candidate activities from {total_searched} scheduled tasks.",
        event_id=event_id,
        source_id=source_id,
        project_id=project_id,
        schedule_version=active_version,
        raw_text=raw_text,
        extracted_facts=extracted_facts,
        top_candidate=top_candidate,
        alternative_candidates=alternative_candidates,
        total_candidates=len(top_candidates),
        total_activities_searched=total_searched,
        execution_time_ms=elapsed_ms
    )
