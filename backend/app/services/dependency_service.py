import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_state import ExecutionState
from app.models.dependency import Dependency
from app.services.execution_state_service import calculate_schedule_variance
from app.schemas.dependency_schema import (
    DependencyLink,
    UpstreamPredecessorItem,
    DownstreamImpactItem,
    ImpactChainItem,
    ActivityDependencyDetail,
    ProjectDependencyImpactSummary
)

logger = logging.getLogger("dependency_service")

def parse_predecessor_codes(raw_predecessors: Optional[str]) -> List[str]:
    """
    Parses comma-separated, semicolon-separated, or JSON string of predecessor IDs.
    Returns normalized list of clean activity ID codes.
    """
    if not raw_predecessors or not str(raw_predecessors).strip():
        return []
    
    text = str(raw_predecessors).strip()
    if text.lower() in ("nan", "none", "null", "[]"):
        return []

    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(p).strip() for p in parsed if str(p).strip()]
        except Exception:
            pass

    # Normalize delimiters
    text = text.replace(";", ",")
    items = text.split(",")
    results = []
    for item in items:
        clean = item.strip()
        # Remove any link type / lag suffix if present e.g. "PIP-01+2d" or "PIP-01FS"
        if "+" in clean:
            clean = clean.split("+")[0].strip()
        elif "-" in clean and not any(clean.startswith(prefix) for prefix in ("PIP-", "CIV-", "ELE-", "MEC-", "INS-", "HYD-", "ACT-")):
            clean = clean.split("-")[0].strip()
        if clean:
            results.append(clean)
    return results

def build_project_dependency_graph(
    activities: List[Activity]
) -> Tuple[Dict[str, List[str]], Dict[str, List[str]], Dict[str, Activity]]:
    """
    Builds forward (predecessor -> successors) and backward (activity -> predecessors) adjacency maps.
    Keys are activity_id (e.g. PIP-L5-034).
    """
    adj_forward: Dict[str, List[str]] = {}
    adj_backward: Dict[str, List[str]] = {}
    act_by_code: Dict[str, Activity] = {}

    for act in activities:
        code = act.activity_id
        act_by_code[code] = act
        if code not in adj_forward:
            adj_forward[code] = []
        if code not in adj_backward:
            adj_backward[code] = []

    # Map predecessors
    for act in activities:
        succ_code = act.activity_id
        pred_codes = parse_predecessor_codes(act.predecessor_ids)
        for pred_code in pred_codes:
            # Add to backward map
            if pred_code not in adj_backward[succ_code]:
                adj_backward[succ_code].append(pred_code)
            
            # Add to forward map
            if pred_code not in adj_forward:
                adj_forward[pred_code] = []
            if succ_code not in adj_forward[pred_code]:
                adj_forward[pred_code].append(succ_code)

    return adj_forward, adj_backward, act_by_code

def parse_date_obj(val: Any) -> Optional[datetime.date]:
    """
    Robustly converts datetime, date, or date string into a datetime.date object.
    """
    if not val:
        return None
    if hasattr(val, "date") and callable(getattr(val, "date")):
        return val.date()
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        val_str = val.strip()
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d-%b-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(val_str, fmt).date()
            except ValueError:
                pass
        try:
            return datetime.fromisoformat(val_str).date()
        except Exception:
            return None
    return None

def calculate_buffer_days(pred_act: Activity, succ_act: Activity) -> float:
    """
    Calculates Finish-to-Start float / buffer days between predecessor planned finish and successor planned start.
    Buffer = succ.planned_start - pred.planned_finish.
    """
    p_fin = parse_date_obj(pred_act.planned_finish)
    s_start = parse_date_obj(succ_act.planned_start)
    if not p_fin or not s_start:
        return 0.0
    
    diff = (s_start - p_fin).days
    return float(max(0, diff))


def calculate_activity_effective_delay(act: Activity, state: Optional[ExecutionState]) -> Tuple[bool, float]:
    """
    Determines if an activity is verified as delayed and computes delay days.
    """
    if not state:
        # If unstarted but planned finish is past today
        p_fin = parse_date_obj(act.planned_finish)
        if p_fin:
            today = datetime.now(timezone.utc).date()
            if today > p_fin:
                return True, float((today - p_fin).days)
        return False, 0.0

    effective_delay = 0.0
    if state.delay_days is not None and state.delay_days > 0.0:
        effective_delay = float(state.delay_days)

    delay_days, variance, is_delayed = calculate_schedule_variance(act, state)
    if delay_days is not None and delay_days > 0.0:
        effective_delay = max(effective_delay, float(delay_days))

    if not is_delayed and effective_delay > 0.0:
        is_delayed = True

    if not is_delayed:
        if variance is not None and variance < -5.0:
            dur = act.planned_duration or 7.0
            effective_delay = round(abs(variance / 100.0) * dur, 1)
            is_delayed = True
        elif act.planned_finish and (state.actual_progress or 0.0) < 100.0:
            p_fin = parse_date_obj(act.planned_finish)
            if p_fin:
                today = datetime.now(timezone.utc).date()
                if today > p_fin:
                    effective_delay = float((today - p_fin).days)
                    is_delayed = True

    return is_delayed, max(0.0, effective_delay)



def analyze_activity_downstream_impact(
    db: Session,
    project_id: str,
    activity_id: str
) -> ActivityDependencyDetail:
    """
    Milestone 12: Rule-based dependency traversal for a single activity.
    Inspects upstream predecessors and calculates immediate and multi-tier downstream impact.
    """
    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    states_list = db.query(ExecutionState).filter(ExecutionState.project_id == project_id).all()
    
    # Robust map by both DB primary key and activity code (e.g. PIP-L5-034)
    states_by_act_id: Dict[str, ExecutionState] = {}
    for s in states_list:
        states_by_act_id[s.activity_id] = s
        linked_act = next((a for a in activities if a.id == s.activity_id or a.activity_id == s.activity_id), None)
        if linked_act:
            states_by_act_id[linked_act.id] = s
            states_by_act_id[linked_act.activity_id] = s

    adj_forward, adj_backward, act_by_code = build_project_dependency_graph(activities)

    # Find target activity
    target_act = next((a for a in activities if a.activity_id == activity_id or a.id == activity_id), None)
    if not target_act:
        raise ValueError(f"Activity '{activity_id}' not found in project '{project_id}'.")

    target_code = target_act.activity_id
    target_state = states_by_act_id.get(target_act.id) or states_by_act_id.get(target_act.activity_id)
    is_delayed, delay_days = calculate_activity_effective_delay(target_act, target_state)

    # 1. Inspect Upstream Predecessors
    predecessors: List[UpstreamPredecessorItem] = []
    pred_codes = adj_backward.get(target_code, [])
    for p_code in pred_codes:
        p_act = act_by_code.get(p_code)
        if not p_act:
            continue
        p_state = states_by_act_id.get(p_act.id) or states_by_act_id.get(p_act.activity_id)
        p_delayed, p_delay_days = calculate_activity_effective_delay(p_act, p_state)
        p_buffer = calculate_buffer_days(p_act, target_act)

        p_fin_str = p_act.planned_finish.strftime("%d-%b-%Y") if (p_act.planned_finish and hasattr(p_act.planned_finish, "strftime")) else str(p_act.planned_finish) if p_act.planned_finish else None
        a_fin_str = None
        if p_state and p_state.actual_finish:
            a_fin_str = p_state.actual_finish.strftime("%d-%b-%Y") if hasattr(p_state.actual_finish, "strftime") else str(p_state.actual_finish)

        predecessors.append(UpstreamPredecessorItem(
            activity_id=p_act.activity_id,
            activity_name=p_act.activity_name,
            discipline=p_act.discipline,
            dependency_type="FS",
            planned_finish=p_fin_str,
            actual_finish=a_fin_str,
            status=p_state.status if p_state else "Not Started",
            is_delayed=p_delayed,
            delay_days=p_delay_days if p_delayed else None,
            buffer_days=p_buffer
        ))


    # 2. Inspect Immediate Successors (Tier 1) and Multi-Tier Cascade (BFS)
    immediate_successors: List[DownstreamImpactItem] = []
    downstream_cascade: List[DownstreamImpactItem] = []
    
    # BFS Queue: (current_code, incoming_delay, tier, visited_set)
    queue = [(target_code, delay_days, 1, {target_code})]
    max_slippage = 0.0

    while queue:
        curr_code, incoming_delay, tier, visited = queue.pop(0)
        curr_act = act_by_code.get(curr_code)
        if not curr_act:
            continue

        succ_codes = adj_forward.get(curr_code, [])
        for s_code in succ_codes:
            if s_code in visited:
                continue  # Prevent cycle loop

            s_act = act_by_code.get(s_code)
            if not s_act:
                continue

            s_state = states_by_act_id.get(s_act.id)
            buffer_days = calculate_buffer_days(curr_act, s_act)
            
            # Rule-based potential delay slippage: Max(0, incoming_delay - buffer)
            potential_slippage = max(0.0, incoming_delay - buffer_days) if incoming_delay > 0 else 0.0
            if potential_slippage > max_slippage:
                max_slippage = potential_slippage

            # Determine Risk Severity
            if potential_slippage >= 4.0:
                severity = "CRITICAL"
            elif potential_slippage >= 1.0:
                severity = "HIGH"
            elif potential_slippage > 0.0:
                severity = "MEDIUM"
            else:
                severity = "BUFFERED"

            # Explanation
            if incoming_delay > 0:
                if potential_slippage > 0:
                    exp = (
                        f"Predecessor {curr_act.activity_id} has {incoming_delay}d delay. "
                        f"Buffer to {s_act.activity_id} is {buffer_days}d. "
                        f"Successor start is at risk of slipping by up to {potential_slippage}d."
                    )
                else:
                    exp = (
                        f"Predecessor {curr_act.activity_id} has {incoming_delay}d delay, "
                        f"which is absorbed by {buffer_days}d scheduled float buffer. Zero slippage expected."
                    )
            else:
                exp = f"Predecessor {curr_act.activity_id} is on schedule. Successor planned start is unhindered."

            s_start_str = s_act.planned_start.strftime("%d-%b-%Y") if (s_act.planned_start and hasattr(s_act.planned_start, "strftime")) else str(s_act.planned_start) if s_act.planned_start else None
            s_fin_str = s_act.planned_finish.strftime("%d-%b-%Y") if (s_act.planned_finish and hasattr(s_act.planned_finish, "strftime")) else str(s_act.planned_finish) if s_act.planned_finish else None

            impact_item = DownstreamImpactItem(
                successor_activity_id=s_act.activity_id,
                successor_activity_name=s_act.activity_name,
                discipline=s_act.discipline,
                location=s_act.location,
                dependency_type="FS",
                planned_start=s_start_str,
                planned_finish=s_fin_str,
                current_status=s_state.status if s_state else "Not Started",
                current_progress=s_state.actual_progress if s_state else 0.0,
                buffer_days=buffer_days,
                predecessor_delay_days=incoming_delay,
                potential_delay_impact_days=potential_slippage,
                risk_severity=severity,
                impact_explanation=exp,
                tier=tier
            )

            if tier == 1:
                immediate_successors.append(impact_item)
            downstream_cascade.append(impact_item)

            # Continue BFS up to tier 3 if there's slippage
            if tier < 3 and potential_slippage > 0:
                new_visited = set(visited)
                new_visited.add(s_code)
                queue.append((s_code, potential_slippage, tier + 1, new_visited))

    return ActivityDependencyDetail(
        success=True,
        project_id=project_id,
        activity_id=target_act.activity_id,
        activity_name=target_act.activity_name,
        discipline=target_act.discipline,
        location=target_act.location,
        status=target_state.status if target_state else "Not Started",
        actual_progress=target_state.actual_progress if target_state else 0.0,
        is_delayed=is_delayed,
        delay_days=delay_days if is_delayed else None,
        predecessors=predecessors,
        immediate_successors=immediate_successors,
        downstream_cascade=downstream_cascade,
        total_downstream_at_risk=sum(1 for it in downstream_cascade if it.potential_delay_impact_days > 0),
        max_downstream_slippage_days=max_slippage
    )

def get_project_dependency_impact_summary(
    db: Session,
    project_id: str = "PRJ-REF-04"
) -> ProjectDependencyImpactSummary:
    """
    Milestone 12: Project-wide dependency impact intelligence rollup.
    Scans all delayed activities, traverses downstream chains, and identifies critical slippage paths.
    """
    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    states_list = db.query(ExecutionState).filter(ExecutionState.project_id == project_id).all()
    
    states_by_act_id: Dict[str, ExecutionState] = {}
    for s in states_list:
        states_by_act_id[s.activity_id] = s
        linked_act = next((a for a in activities if a.id == s.activity_id or a.activity_id == s.activity_id), None)
        if linked_act:
            states_by_act_id[linked_act.id] = s
            states_by_act_id[linked_act.activity_id] = s

    adj_forward, adj_backward, act_by_code = build_project_dependency_graph(activities)

    # Count total links
    total_links = sum(len(succs) for succs in adj_forward.values())

    impact_chains: List[ImpactChainItem] = []
    all_downstream: List[DownstreamImpactItem] = []
    delayed_with_succ_count = 0
    at_risk_unique_codes: Set[str] = set()

    # Identify all delayed activities
    for act in activities:
        succ_codes = adj_forward.get(act.activity_id, [])
        if not succ_codes:
            continue  # No downstream dependencies

        st = states_by_act_id.get(act.id) or states_by_act_id.get(act.activity_id)
        is_del, delay_days = calculate_activity_effective_delay(act, st)

        if not is_del or delay_days <= 0:
            continue

        delayed_with_succ_count += 1


        # Analyze downstream impact for this delayed activity
        detail = analyze_activity_downstream_impact(db, project_id, act.activity_id)
        if detail.downstream_cascade:
            all_downstream.extend(detail.downstream_cascade)
            for it in detail.downstream_cascade:
                if it.potential_delay_impact_days > 0:
                    at_risk_unique_codes.add(it.successor_activity_id)

            # Build impact chain summary path
            chain_path = [f"{act.activity_id} (+{delay_days}d delay)"]
            for it in detail.downstream_cascade[:3]:
                chain_path.append(f"{it.successor_activity_id} (Tier {it.tier}: +{it.potential_delay_impact_days}d)")

            highest_sev = "MEDIUM"
            if any(it.risk_severity == "CRITICAL" for it in detail.downstream_cascade):
                highest_sev = "CRITICAL"
            elif any(it.risk_severity == "HIGH" for it in detail.downstream_cascade):
                highest_sev = "HIGH"

            impact_chains.append(ImpactChainItem(
                chain_id=f"chain_{act.activity_id}",
                source_delayed_activity_id=act.activity_id,
                source_delayed_activity_name=act.activity_name,
                source_delay_days=delay_days,
                affected_successors_count=len(detail.downstream_cascade),
                max_cascade_slippage_days=detail.max_downstream_slippage_days,
                highest_risk_severity=highest_sev,
                path_summary=" → ".join(chain_path),
                affected_activities=detail.downstream_cascade
            ))

    impact_chains.sort(key=lambda x: x.max_cascade_slippage_days, reverse=True)

    return ProjectDependencyImpactSummary(
        success=True,
        project_id=project_id,
        total_dependency_links=total_links,
        delayed_activities_with_successors=delayed_with_succ_count,
        total_downstream_activities_at_risk=len(at_risk_unique_codes),
        critical_impact_chains_count=sum(1 for c in impact_chains if c.highest_risk_severity in ("CRITICAL", "HIGH")),
        impact_chains=impact_chains,
        all_downstream_impacts=all_downstream
    )
