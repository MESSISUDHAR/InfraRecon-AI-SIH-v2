import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.models.project import Project
from app.models.activity import Activity
from app.models.execution_state import ExecutionState
from app.models.execution_event import ExecutionEvent
from app.models.match_candidate import MatchCandidate
from app.models.audit_log import AuditLog
from app.schemas.execution_state_schema import (
    ObservationHistoryItem,
    ActivityExecutionStateItem,
    ActivityExecutionStateDetail,
    ProjectExecutionSummary,
    ExecutionStateListResponse,
    ExecutionStateDetailResponse,
    ExecutionStateSummaryResponse
)

logger = logging.getLogger("execution_state_service")

def calculate_schedule_variance(
    activity: Activity,
    exec_state: Optional[ExecutionState]
) -> Tuple[Optional[float], Optional[float], bool]:
    """
    Computes schedule variance and delay metrics:
    - For COMPLETED activities: delay_days = actual_finish - planned_finish.
    - For INCOMPLETE activities: progress_variance = actual_progress - planned_progress.
      (Completion delay is NOT prematurely computed until actual finish is verified).
    Returns (delay_days, progress_variance, is_delayed).
    """
    if not exec_state:
        planned_prog = activity.planned_progress or 0.0
        return None, round(0.0 - planned_prog, 2), planned_prog > 0.0

    actual_prog = exec_state.actual_progress or 0.0
    planned_prog = activity.planned_progress or 0.0
    progress_variance = round(actual_prog - planned_prog, 2)

    delay_days = None
    is_delayed = False

    if exec_state.status == "Completed" and exec_state.actual_finish and activity.planned_finish:
        # Verified completion delay
        act_fin = exec_state.actual_finish.date() if hasattr(exec_state.actual_finish, "date") else exec_state.actual_finish
        pln_fin = activity.planned_finish.date() if hasattr(activity.planned_finish, "date") else activity.planned_finish
        diff = (act_fin - pln_fin).days
        delay_days = float(diff)
        is_delayed = delay_days > 0.0
    else:
        # In-progress activity variance
        if progress_variance < -5.0:
            is_delayed = True
        elif activity.planned_finish and datetime.now(timezone.utc).date() > activity.planned_finish.date() and actual_prog < 100.0:
            is_delayed = True

    return delay_days, progress_variance, is_delayed

def get_project_execution_summary(db: Session, project_id: str = "PRJ-REF-04") -> ProjectExecutionSummary:
    """
    Computes overall project rollup metrics from verified execution states.
    """
    activities = db.query(Activity).filter(Activity.project_id == project_id).all()
    total_acts = len(activities)

    if total_acts == 0:
        return ProjectExecutionSummary(
            project_id=project_id,
            total_activities=0,
            verified_activities_count=0,
            not_started_count=0,
            in_progress_count=0,
            completed_count=0,
            delayed_count=0,
            overall_planned_progress=0.0,
            overall_actual_progress=0.0,
            overall_progress_variance=0.0,
            total_verified_observations=0,
            last_observation_timestamp=None
        )

    states_by_act_id = {
        s.activity_id: s for s in db.query(ExecutionState).filter(ExecutionState.project_id == project_id).all()
    }

    verified_count = 0
    not_started_count = 0
    in_progress_count = 0
    completed_count = 0
    delayed_count = 0
    total_observations = 0
    sum_planned_prog = 0.0
    sum_actual_prog = 0.0
    last_obs_ts = None

    for act in activities:
        pln_prog = act.planned_progress or 0.0
        sum_planned_prog += pln_prog

        st = states_by_act_id.get(act.id)
        if st and st.verified_observations_count > 0:
            verified_count += 1
            act_prog = st.actual_progress or 0.0
            sum_actual_prog += act_prog
            total_observations += st.verified_observations_count

            if st.last_updated:
                ts_str = st.last_updated.isoformat() if hasattr(st.last_updated, "isoformat") else str(st.last_updated)
                if not last_obs_ts or ts_str > last_obs_ts:
                    last_obs_ts = ts_str

            if st.status == "Completed":
                completed_count += 1
            elif st.status == "In Progress":
                in_progress_count += 1
            else:
                not_started_count += 1

            _, _, is_del = calculate_schedule_variance(act, st)
            if is_del:
                delayed_count += 1
        else:
            not_started_count += 1

    overall_pln = round(sum_planned_prog / total_acts, 2) if total_acts > 0 else 0.0
    overall_act = round(sum_actual_prog / total_acts, 2) if total_acts > 0 else 0.0
    overall_var = round(overall_act - overall_pln, 2)

    return ProjectExecutionSummary(
        project_id=project_id,
        total_activities=total_acts,
        verified_activities_count=verified_count,
        not_started_count=not_started_count,
        in_progress_count=in_progress_count,
        completed_count=completed_count,
        delayed_count=delayed_count,
        overall_planned_progress=overall_pln,
        overall_actual_progress=overall_act,
        overall_progress_variance=overall_var,
        total_verified_observations=total_observations,
        last_observation_timestamp=last_obs_ts
    )

def get_project_execution_states(
    db: Session,
    project_id: str = "PRJ-REF-04",
    discipline: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> ExecutionStateListResponse:
    """
    Returns list of activities and their verified execution state with variance and delay metrics.
    """
    act_query = db.query(Activity).filter(Activity.project_id == project_id)

    if discipline and discipline != "ALL":
        act_query = act_query.filter(Activity.discipline.ilike(f"%{discipline}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        act_query = act_query.filter(
            or_(
                Activity.activity_id.ilike(term),
                Activity.activity_name.ilike(term),
                Activity.location.ilike(term),
                Activity.asset_id.ilike(term),
                Activity.line_id.ilike(term)
            )
        )

    activities = act_query.order_by(Activity.activity_id.asc()).all()

    # Load states
    states_by_act = {
        s.activity_id: s for s in db.query(ExecutionState).filter(ExecutionState.project_id == project_id).all()
    }

    items: List[ActivityExecutionStateItem] = []

    for act in activities:
        st = states_by_act.get(act.id)
        delay_days, progress_variance, is_delayed = calculate_schedule_variance(act, st)

        act_status = st.status if st else "Not Started"
        if is_delayed and act_status != "Completed":
            act_status = "Behind Schedule"

        if status and status != "ALL":
            if status == "DELAYED" and not is_delayed:
                continue
            elif status != "DELAYED" and act_status != status:
                continue

        planned_start_str = act.planned_start.isoformat() if (act.planned_start and hasattr(act.planned_start, "isoformat")) else (str(act.planned_start) if act.planned_start else None)
        planned_finish_str = act.planned_finish.isoformat() if (act.planned_finish and hasattr(act.planned_finish, "isoformat")) else (str(act.planned_finish) if act.planned_finish else None)
        
        actual_start_str = None
        actual_finish_str = None
        last_updated_str = None
        actual_prog = 0.0
        obs_count = 0
        last_evt_id = None
        app_state = "VERIFIED"
        delay_rsn = None

        if st:
            actual_prog = st.actual_progress or 0.0
            obs_count = st.verified_observations_count or 0
            last_evt_id = st.last_event_id
            app_state = st.approval_state or "VERIFIED"
            delay_rsn = st.delay_reason
            if st.actual_start:
                actual_start_str = st.actual_start.isoformat() if hasattr(st.actual_start, "isoformat") else str(st.actual_start)
            if st.actual_finish:
                actual_finish_str = st.actual_finish.isoformat() if hasattr(st.actual_finish, "isoformat") else str(st.actual_finish)
            if st.last_updated:
                last_updated_str = st.last_updated.isoformat() if hasattr(st.last_updated, "isoformat") else str(st.last_updated)

        item = ActivityExecutionStateItem(
            activity_id=act.activity_id,
            db_id=act.id,
            project_id=project_id,
            activity_name=act.activity_name,
            discipline=act.discipline,
            location=act.location,
            wbs_code=act.wbs_code,
            wbs_name=act.wbs_name,
            planned_start=planned_start_str,
            planned_finish=planned_finish_str,
            planned_duration_days=act.planned_duration,
            planned_progress=act.planned_progress or 0.0,
            actual_start=actual_start_str,
            actual_finish=actual_finish_str,
            actual_progress=actual_prog,
            status=act_status,
            delay_days=delay_days,
            progress_variance=progress_variance,
            is_delayed=is_delayed,
            delay_reason=delay_rsn,
            verified_observations_count=obs_count,
            last_event_id=last_evt_id,
            last_updated=last_updated_str,
            approval_state=app_state
        )
        items.append(item)

    paginated = items[offset:offset + limit]

    return ExecutionStateListResponse(
        success=True,
        project_id=project_id,
        total_count=len(items),
        items=paginated
    )

def get_activity_execution_state_detail(
    db: Session,
    project_id: str,
    activity_id: str
) -> ActivityExecutionStateDetail:
    """
    Retrieves complete verified execution state for an activity including full observation history timeline.
    """
    act = db.query(Activity).filter(
        (Activity.id == activity_id) | (Activity.activity_id == activity_id),
        Activity.project_id == project_id
    ).first()

    if not act:
        raise ValueError(f"Activity '{activity_id}' not found in project '{project_id}'.")

    st = db.query(ExecutionState).filter(ExecutionState.activity_id == act.id).first()
    delay_days, progress_variance, is_delayed = calculate_schedule_variance(act, st)

    act_status = st.status if st else "Not Started"
    if is_delayed and act_status != "Completed":
        act_status = "Behind Schedule"

    planned_start_str = act.planned_start.isoformat() if (act.planned_start and hasattr(act.planned_start, "isoformat")) else (str(act.planned_start) if act.planned_start else None)
    planned_finish_str = act.planned_finish.isoformat() if (act.planned_finish and hasattr(act.planned_finish, "isoformat")) else (str(act.planned_finish) if act.planned_finish else None)

    actual_start_str = None
    actual_finish_str = None
    last_updated_str = None
    actual_prog = 0.0
    obs_count = 0
    last_evt_id = None
    app_state = "VERIFIED"
    delay_rsn = None

    if st:
        actual_prog = st.actual_progress or 0.0
        obs_count = st.verified_observations_count or 0
        last_evt_id = st.last_event_id
        app_state = st.approval_state or "VERIFIED"
        delay_rsn = st.delay_reason
        if st.actual_start:
            actual_start_str = st.actual_start.isoformat() if hasattr(st.actual_start, "isoformat") else str(st.actual_start)
        if st.actual_finish:
            actual_finish_str = st.actual_finish.isoformat() if hasattr(st.actual_finish, "isoformat") else str(st.actual_finish)
        if st.last_updated:
            last_updated_str = st.last_updated.isoformat() if hasattr(st.last_updated, "isoformat") else str(st.last_updated)

    # 1. Retrieve all mapped observations from AuditLog and MatchCandidate
    audit_records = db.query(AuditLog).filter(
        AuditLog.activity_id == act.id
    ).order_by(AuditLog.timestamp.asc()).all()

    observations_history: List[ObservationHistoryItem] = []
    audit_logs_list: List[Dict[str, Any]] = []

    for aud in audit_records:
        audit_logs_list.append({
            "id": aud.id,
            "action_type": aud.action_type,
            "decision_reason": aud.decision_reason,
            "confidence": aud.confidence,
            "performed_by": aud.performed_by,
            "timestamp": aud.timestamp.isoformat() if (aud.timestamp and hasattr(aud.timestamp, "isoformat")) else str(aud.timestamp),
            "previous_state": json.loads(aud.previous_state_json) if aud.previous_state_json else {},
            "new_state": json.loads(aud.new_state_json) if aud.new_state_json else {}
        })

        if aud.event_id:
            ev = db.query(ExecutionEvent).filter(ExecutionEvent.id == aud.event_id).first()
            if ev:
                new_state = json.loads(aud.new_state_json) if aud.new_state_json else {}
                resulting_prog = new_state.get("actual_progress", actual_prog)
                
                rep_date_str = ev.report_date.isoformat() if (ev.report_date and hasattr(ev.report_date, "isoformat")) else (str(ev.report_date) if ev.report_date else None)
                aud_time_str = aud.timestamp.isoformat() if (aud.timestamp and hasattr(aud.timestamp, "isoformat")) else str(aud.timestamp)

                obs_item = ObservationHistoryItem(
                    event_id=ev.id,
                    source_id=ev.source_id,
                    source_type=ev.source_type,
                    report_date=rep_date_str,
                    raw_text=ev.raw_text,
                    evidence_text=ev.evidence_text,
                    event_progress=ev.event_progress,
                    progress_mode=new_state.get("progress_mode", "CUMULATIVE_ACTIVITY"),
                    is_activity_complete=new_state.get("is_activity_complete", False),
                    resulting_activity_progress=float(resulting_prog),
                    reviewer_id=aud.performed_by,
                    approval_timestamp=aud_time_str,
                    notes=aud.decision_reason
                )
                observations_history.append(obs_item)

    return ActivityExecutionStateDetail(
        activity_id=act.activity_id,
        db_id=act.id,
        project_id=project_id,
        activity_name=act.activity_name,
        discipline=act.discipline,
        location=act.location,
        wbs_code=act.wbs_code,
        wbs_name=act.wbs_name,
        planned_start=planned_start_str,
        planned_finish=planned_finish_str,
        planned_duration_days=act.planned_duration,
        planned_progress=act.planned_progress or 0.0,
        actual_start=actual_start_str,
        actual_finish=actual_finish_str,
        actual_progress=actual_prog,
        status=act_status,
        delay_days=delay_days,
        progress_variance=progress_variance,
        is_delayed=is_delayed,
        delay_reason=delay_rsn,
        verified_observations_count=obs_count,
        last_event_id=last_evt_id,
        last_updated=last_updated_str,
        approval_state=app_state,
        observations_history=observations_history,
        audit_logs=audit_logs_list
    )
