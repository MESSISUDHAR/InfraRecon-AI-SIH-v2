import React, { useState, useEffect } from 'react';
import {
  getExecutionStateSummary,
  getExecutionStateList,
  getActivityExecutionStateDetail,
  getActivityDependencyDetail,
  getProjects
} from '../services/api';

const ExecutionStatePage = ({ initialProjectId = 'PRJ-REF-04' }) => {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectsList, setProjectsList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Activity Detail for History Timeline Drawer
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState('TIMELINE'); // 'TIMELINE' | 'DEPENDENCIES' | 'AUDIT'
  const [dependencyDetail, setDependencyDetail] = useState(null);
  const [dependencyLoading, setDependencyLoading] = useState(false);

  // Load project list once
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const prjs = await getProjects();
        if (Array.isArray(prjs)) {
          setProjectsList(prjs);
        }
      } catch (err) {
        console.warn('Could not load projects list for execution state:', err);
      }
    };
    loadProjects();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, listRes] = await Promise.all([
        getExecutionStateSummary(projectId),
        getExecutionStateList({
          project_id: projectId,
          discipline: disciplineFilter !== 'ALL' ? disciplineFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchTerm ? searchTerm : undefined,
          limit: 100,
          offset: 0
        })
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (listRes.success) {
        setActivities(listRes.items || []);
        setTotalCount(listRes.total_count || 0);
      }
    } catch (err) {
      console.error('Failed to load verified execution states:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load execution state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId, disciplineFilter, statusFilter, searchTerm]);

  const handleOpenDetail = async (activityId) => {
    setDetailLoading(true);
    setDrawerOpen(true);
    setDrawerTab('TIMELINE');
    setDependencyDetail(null);
    try {
      const [actRes, depRes] = await Promise.all([
        getActivityExecutionStateDetail(activityId, projectId),
        getActivityDependencyDetail(activityId, projectId).catch(e => {
          console.warn('Dependency detail load failed:', e);
          return null;
        })
      ]);

      if (actRes.success) {
        setSelectedActivity(actRes.data);
      }
      if (depRes && depRes.success) {
        setDependencyDetail(depRes.data);
      }
    } catch (err) {
      console.error('Failed to load activity details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return <span className="badge badge-success">✓ Completed</span>;
      case 'In Progress':
        return <span className="badge badge-primary">⏳ In Progress</span>;
      case 'Behind Schedule':
        return <span className="badge badge-error">⚠ Behind Schedule</span>;
      default:
        return <span className="badge badge-neutral">⚪ Not Started</span>;
    }
  };

  const getRiskSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            MEDIUM
          </span>
        );
      case 'BUFFERED':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            BUFFERED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            {severity || 'NONE'}
          </span>
        );
    }
  };

  const getProgressModeBadge = (mode) => {
    switch (mode) {
      case 'CUMULATIVE_ACTIVITY':
        return <span className="badge badge-primary text-xs">Cumulative Activity</span>;
      case 'SUB_WORK':
        return <span className="badge badge-warning text-xs">Sub-Work / Component</span>;
      case 'EXPLICIT_COMPLETION':
        return <span className="badge badge-success text-xs">Explicit Completion</span>;
      default:
        return <span className="badge badge-neutral text-xs">{mode}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Project Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              Verified Execution State
            </h1>
            <span className="badge badge-success text-xs font-semibold px-2.5 py-1">
              Milestone 9 Active
            </span>
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Separation of raw field extractions from trusted project progress with cumulative multi-observation lineage and delay tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input text-sm py-1.5 px-3 bg-card-bg border-border rounded-lg text-text-primary font-mono"
          >
            {projectsList.length > 0 ? (
              projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code || p.id} - {p.name}
                </option>
              ))
            ) : (
              <option value="PRJ-REF-04">Refinery Expansion (PRJ-REF-04)</option>
            )}
          </select>
          <button
            onClick={fetchData}
            className="btn btn-secondary text-sm py-1.5 px-3"
            title="Refresh Data"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Semantic Distinction Banner */}
      <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
        <div className="text-xl">💡</div>
        <div className="text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary block font-semibold text-sm mb-0.5">
            Architecture Rule: Event-Level Progress vs Verified Activity Progress
          </strong>
          Raw field observations capture discrete sub-work segments (e.g. 100% of a foundation sub-pour or 50m spool segment) without prematurely marking whole scheduled tasks complete. Verified cumulative progress accumulates monotonically under planner governance, preserving every historical observation and audit trace.
        </div>
      </div>

      {/* Executive Rollup KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4 border-l-4 border-l-primary bg-card-bg">
            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
              Verified Progress
            </div>
            <div className="text-2xl font-bold text-text-primary mt-1">
              {summary.overall_actual_progress}%
            </div>
            <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
              <span>Planned: {summary.overall_planned_progress}%</span>
              <span className={`font-semibold ${summary.overall_progress_variance >= 0 ? 'text-success' : 'text-error'}`}>
                ({summary.overall_progress_variance >= 0 ? '+' : ''}{summary.overall_progress_variance}%)
              </span>
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-success bg-card-bg">
            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
              Completed Tasks
            </div>
            <div className="text-2xl font-bold text-success mt-1">
              {summary.completed_count}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              of {summary.total_activities} activities
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-blue-500 bg-card-bg">
            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
              In Progress
            </div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {summary.in_progress_count}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Active field workfronts
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-error bg-card-bg">
            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
              Behind Schedule
            </div>
            <div className="text-2xl font-bold text-error mt-1">
              {summary.delayed_count}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Progress or date variance
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-purple-500 bg-card-bg">
            <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
              Field Observations
            </div>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {summary.total_verified_observations}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Mapped DPR reports
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg/60 p-3 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by code, name, area, line..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input text-sm py-1.5 px-3 w-64 bg-background border-border rounded-lg text-text-primary"
          />

          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value)}
            className="input text-sm py-1.5 px-3 bg-background border-border rounded-lg text-text-primary"
          >
            <option value="ALL">All Disciplines</option>
            <option value="Piping">Piping</option>
            <option value="Civil">Civil</option>
            <option value="Electrical">Electrical</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Instrumentation">Instrumentation</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-sm py-1.5 px-3 bg-background border-border rounded-lg text-text-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Not Started">Not Started</option>
            <option value="Behind Schedule">Behind Schedule</option>
          </select>
        </div>

        <div className="text-xs text-text-secondary font-medium">
          Showing {activities.length} of {totalCount} activities
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-error/10 border border-error/30 text-error rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Activity Execution State Table */}
      <div className="card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs uppercase font-semibold text-text-secondary">
                <th className="py-3 px-4">Activity Code & Scope</th>
                <th className="py-3 px-4">Discipline / Area</th>
                <th className="py-3 px-4 w-56">Verified vs Planned Progress</th>
                <th className="py-3 px-4">Dates (Planned vs Actual)</th>
                <th className="py-3 px-4">Status & Delay</th>
                <th className="py-3 px-4 text-center">Observations</th>
                <th className="py-3 px-4 text-right">Lineage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading verified execution states...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-secondary">
                    No activities found matching your criteria.
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr
                    key={act.db_id}
                    className="hover:bg-muted/30 transition-colors duration-150"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-primary">
                        {act.activity_id}
                      </div>
                      <div className="text-xs text-text-primary font-medium mt-0.5 max-w-xs truncate" title={act.activity_name}>
                        {act.activity_name}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-xs text-text-primary font-medium">
                        {act.discipline || 'General'}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {act.location || 'Unassigned'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-text-primary">
                          {act.actual_progress}%
                        </span>
                        <span className="text-text-secondary">
                          Plan: {act.planned_progress || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full transition-all duration-300 ${
                            act.actual_progress >= 100
                              ? 'bg-success'
                              : act.is_delayed
                              ? 'bg-error'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, act.actual_progress)}%` }}
                        />
                      </div>
                      {act.progress_variance !== null && act.progress_variance !== 0 && (
                        <div className={`text-[10px] mt-0.5 ${act.progress_variance >= 0 ? 'text-success' : 'text-error'}`}>
                          Variance: {act.progress_variance > 0 ? '+' : ''}{act.progress_variance}%
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <div className="text-text-secondary">
                        P: {act.planned_start ? act.planned_start.slice(0, 10) : '-'} → {act.planned_finish ? act.planned_finish.slice(0, 10) : '-'}
                      </div>
                      <div className="text-text-primary font-medium mt-0.5">
                        A: {act.actual_start ? act.actual_start.slice(0, 10) : 'Not Started'} → {act.actual_finish ? act.actual_finish.slice(0, 10) : (act.actual_progress > 0 ? 'In Progress' : '-')}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(act.status)}
                        {act.delay_days !== null && act.delay_days > 0 && (
                          <span className="text-[10px] text-error font-semibold">
                            +{act.delay_days}d completion delay
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        act.verified_observations_count > 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-text-secondary'
                      }`}>
                        {act.verified_observations_count}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(act.activity_id)}
                        className="btn btn-secondary text-xs py-1 px-2.5 font-medium hover:bg-primary hover:text-white transition-colors"
                      >
                        Timeline & Audit →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observation History & Audit Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-card-bg h-full shadow-2xl flex flex-col border-l border-border animate-slide-left">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">
                    {selectedActivity?.activity_id}
                  </span>
                  {selectedActivity && getStatusBadge(selectedActivity.status)}
                </div>
                <h3 className="text-base font-semibold text-text-primary mt-1">
                  {selectedActivity?.activity_name}
                </h3>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-text-secondary hover:text-text-primary p-2 text-lg rounded-lg hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center h-48 text-text-secondary">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2">Loading observation history...</span>
                </div>
              ) : selectedActivity ? (
                <>
                  {/* Verified State Summary Card */}
                  <div className="card p-4 bg-muted/10 border border-border grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[11px] text-text-secondary uppercase">Verified Progress</div>
                      <div className="text-xl font-bold text-primary mt-0.5">
                        {selectedActivity.actual_progress}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-text-secondary uppercase">Actual Start</div>
                      <div className="text-sm font-semibold text-text-primary mt-1">
                        {selectedActivity.actual_start ? selectedActivity.actual_start.slice(0, 10) : 'Not Started'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-text-secondary uppercase">Actual Finish</div>
                      <div className="text-sm font-semibold text-text-primary mt-1">
                        {selectedActivity.actual_finish ? selectedActivity.actual_finish.slice(0, 10) : 'Active'}
                      </div>
                    </div>
                  </div>

                  {/* Tab Navigation Header */}
                  <div className="flex border-b border-border gap-2">
                    <button
                      onClick={() => setDrawerTab('TIMELINE')}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                        drawerTab === 'TIMELINE'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      📜 Observations ({selectedActivity.observations_history?.length || 0})
                    </button>
                    <button
                      onClick={() => setDrawerTab('DEPENDENCIES')}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                        drawerTab === 'DEPENDENCIES'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span>🔗 Dependency Intelligence</span>
                      {dependencyDetail && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-primary/20 text-primary rounded-full">
                          {(dependencyDetail.upstream_predecessors?.length || 0) + (dependencyDetail.downstream_successors?.length || 0)}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setDrawerTab('AUDIT')}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                        drawerTab === 'AUDIT'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      🛡️ Audit ({selectedActivity.audit_logs?.length || 0})
                    </button>
                  </div>

                  {/* TAB 1: Multi-Observation Timeline */}
                  {drawerTab === 'TIMELINE' && (
                    <div>
                      <h4 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                        <span>📜 Field Observations History</span>
                        <span className="badge badge-primary text-xs">
                          {selectedActivity.observations_history?.length || 0} Observations
                        </span>
                      </h4>

                      {selectedActivity.observations_history?.length === 0 ? (
                        <div className="text-xs text-text-secondary italic p-4 bg-muted/20 rounded-lg text-center">
                          No verified field observations mapped to this activity yet.
                        </div>
                      ) : (
                        <div className="relative border-l-2 border-primary/30 ml-4 space-y-4">
                          {selectedActivity.observations_history.map((obs, idx) => (
                            <div key={obs.event_id || idx} className="ml-6 relative">
                              {/* Timeline node icon */}
                              <span className="absolute -left-[31px] top-1 w-4 h-4 bg-primary rounded-full border-2 border-card-bg" />

                              <div className="card p-3.5 bg-card-bg border border-border hover:border-primary/50 transition-colors shadow-sm">
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="font-mono font-bold text-text-primary">
                                    Observation #{idx + 1} • {obs.source_id || 'DPR'}
                                  </span>
                                  <span className="text-text-secondary">
                                    {obs.approval_timestamp ? obs.approval_timestamp.slice(0, 16).replace('T', ' ') : ''}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  {getProgressModeBadge(obs.progress_mode)}
                                  {obs.event_progress !== null && (
                                    <span className="badge badge-neutral text-xs">
                                      Event Progress: {obs.event_progress}%
                                    </span>
                                  )}
                                  <span className="badge badge-success text-xs font-semibold">
                                    Resulting Activity Progress: {obs.resulting_activity_progress}%
                                  </span>
                                </div>

                                <div className="text-xs text-text-primary bg-muted/20 p-2.5 rounded border border-border/60 my-2">
                                  <span className="font-semibold text-text-secondary block text-[10px] uppercase mb-0.5">Raw Field Evidence</span>
                                  "{obs.raw_text}"
                                </div>

                                {obs.evidence_text && (
                                  <div className="text-xs text-primary bg-primary/5 p-2 rounded border border-primary/20 my-1">
                                    <span className="font-semibold text-text-secondary block text-[10px] uppercase mb-0.5">Grounded Extract Quote</span>
                                    "{obs.evidence_text}"
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] text-text-secondary mt-2 pt-2 border-t border-border/40">
                                  <span>Verified by: <strong className="text-text-primary">{obs.reviewer_id}</strong></span>
                                  {obs.notes && <span>Note: {obs.notes}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Dependency Intelligence (Milestone 12) */}
                  {drawerTab === 'DEPENDENCIES' && (
                    <div className="space-y-5">
                      {/* Explicit Non-Predictive Disclaimer */}
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                        <strong>Rule-Based Schedule Impact Notice:</strong>
                        <p className="mt-0.5 text-amber-400/90 text-[11px]">
                          Deterministic rule-based schedule dependency impact derived strictly from CPM predecessor-successor links. No predictive forecasting claimed.
                        </p>
                      </div>

                      {/* Current Activity Delay Status */}
                      <div className="p-3.5 bg-muted/20 rounded-lg border border-border flex items-center justify-between">
                        <div>
                          <div className="text-xs text-text-secondary font-medium uppercase">Current Activity Delay Status</div>
                          <div className="text-sm font-bold text-text-primary mt-0.5">
                            {dependencyDetail?.effective_delay_days > 0 ? (
                              <span className="text-rose-400">Lagging by +{dependencyDetail.effective_delay_days} days</span>
                            ) : (
                              <span className="text-emerald-400">On Track (0 days delay)</span>
                            )}
                          </div>
                          {dependencyDetail?.delay_reason && (
                            <div className="text-[11px] text-text-secondary mt-0.5">
                              {dependencyDetail.delay_reason}
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-text-secondary">Discipline: </span>
                          <span className="text-primary font-bold">{dependencyDetail?.discipline || 'General'}</span>
                        </div>
                      </div>

                      {/* Upstream Predecessors */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center justify-between">
                          <span>⬅️ Upstream Predecessors ({dependencyDetail?.upstream_predecessors?.length || 0})</span>
                          <span className="text-[10px] text-text-secondary font-normal font-sans">Must finish before this activity</span>
                        </h4>

                        {(!dependencyDetail?.upstream_predecessors || dependencyDetail.upstream_predecessors.length === 0) ? (
                          <div className="p-3 bg-muted/10 rounded-lg border border-border text-xs text-text-secondary italic text-center">
                            No upstream predecessors defined in CPM schedule.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {dependencyDetail.upstream_predecessors.map((p, idx) => (
                              <div key={idx} className="p-3 bg-card-bg rounded-lg border border-border text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-primary">{p.predecessor_code}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-muted rounded font-mono text-text-secondary">{p.dependency_type}</span>
                                    {p.is_predecessor_delayed ? (
                                      <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-400 rounded font-semibold">
                                        Delayed +{p.predecessor_delay_days}d
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">
                                        On Schedule
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-text-primary font-medium">{p.predecessor_name}</div>
                                  <div className="text-[11px] text-text-secondary">
                                    Planned Finish: {p.predecessor_planned_finish || 'N/A'} • Status: {p.predecessor_status || 'Unknown'}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[11px] text-text-secondary">Float Buffer</div>
                                  <div className="font-mono font-bold text-text-primary">{p.buffer_days_to_this} days</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Downstream Successors & Potential Impact */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center justify-between">
                          <span>➡️ Downstream Successors Impact ({dependencyDetail?.downstream_successors?.length || 0})</span>
                          <span className="text-[10px] text-text-secondary font-normal font-sans">Activities waiting on this task</span>
                        </h4>

                        {(!dependencyDetail?.downstream_successors || dependencyDetail.downstream_successors.length === 0) ? (
                          <div className="p-3 bg-muted/10 rounded-lg border border-border text-xs text-text-secondary italic text-center">
                            No downstream successor dependencies mapped to this activity.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {dependencyDetail.downstream_successors.map((s, idx) => (
                              <div key={idx} className="p-3 bg-card-bg rounded-lg border border-border text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-primary">{s.successor_code}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-muted rounded font-mono text-text-secondary">{s.dependency_type}</span>
                                    {getRiskSeverityBadge(s.risk_severity)}
                                  </div>
                                  <div className="text-text-primary font-medium">{s.successor_name}</div>
                                  <div className="text-[11px] text-text-secondary">
                                    Planned Start: {s.successor_planned_start || 'N/A'} • Discipline: {s.successor_discipline || 'General'}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[11px] text-text-secondary">
                                    Buffer: <span className="font-mono font-semibold text-text-primary">{s.buffer_days}d</span>
                                  </div>
                                  <div className="text-xs font-mono font-bold mt-0.5">
                                    {s.potential_delay_slippage_days > 0 ? (
                                      <span className="text-rose-400">+{s.potential_delay_slippage_days}d Slippage</span>
                                    ) : (
                                      <span className="text-emerald-400">Buffered (0d)</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cascading Impact Chains */}
                      {dependencyDetail?.cascading_chains && dependencyDetail.cascading_chains.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                            ⛓️ Multi-Tier Cascade Chains ({dependencyDetail.cascading_chains.length})
                          </h4>
                          <div className="space-y-2">
                            {dependencyDetail.cascading_chains.map((chain, cIdx) => (
                              <div key={cIdx} className="p-3 bg-rose-500/5 rounded-lg border border-rose-500/20 text-xs space-y-1">
                                <div className="flex items-center justify-between font-mono font-semibold text-text-primary">
                                  <span>Chain #{cIdx + 1} (Tier {chain.tier})</span>
                                  {getRiskSeverityBadge(chain.severity)}
                                </div>
                                <div className="font-mono text-primary text-[11px] flex items-center gap-1.5 flex-wrap">
                                  {chain.chain_nodes.map((node, nIdx) => (
                                    <React.Fragment key={nIdx}>
                                      <span className="px-1.5 py-0.5 bg-muted rounded">{node}</span>
                                      {nIdx < chain.chain_nodes.length - 1 && <span>&rarr;</span>}
                                    </React.Fragment>
                                  ))}
                                </div>
                                <div className="text-[11px] text-text-secondary pt-1 flex justify-between">
                                  <span>Cum. Slippage: <strong className="text-rose-400 font-mono">+{chain.cumulative_slippage_days}d</strong></span>
                                  <span>Total Buffer: <strong className="text-text-primary font-mono">{chain.total_buffer_days}d</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Audit Trail Lineage */}
                  {drawerTab === 'AUDIT' && (
                    <div>
                      <h4 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                        <span>🛡️ Immutable Audit Trail</span>
                        <span className="badge badge-neutral text-xs">
                          {selectedActivity.audit_logs?.length || 0} Entries
                        </span>
                      </h4>

                      <div className="space-y-2">
                        {selectedActivity.audit_logs?.map((aud) => (
                          <div key={aud.id} className="p-2.5 bg-muted/20 border border-border rounded-lg text-xs">
                            <div className="flex items-center justify-between font-medium text-text-primary">
                              <span>{aud.action_type}</span>
                              <span className="text-text-secondary">{aud.timestamp?.slice(0, 19).replace('T', ' ')}</span>
                            </div>
                            <div className="text-text-secondary mt-1">
                              {aud.decision_reason} (by {aud.performed_by})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
              <button
                onClick={() => setDrawerOpen(false)}
                className="btn btn-secondary text-xs py-1.5 px-4"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionStatePage;
