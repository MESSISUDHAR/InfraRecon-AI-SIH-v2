import React, { useState, useEffect } from 'react';
import {
  getExecutionStateSummary,
  getExecutionStateList,
  getActivityExecutionStateDetail,
  getActivityDependencyDetail,
  getProjects
} from '../services/api';
import TimelineAuditDrawer from '../components/ExecutionState/TimelineAuditDrawer';
import { Layers, Activity, RefreshCw, Sparkles, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

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
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [dependencyDetail, setDependencyDetail] = useState(null);

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
    setSelectedActivityId(activityId);
    setDetailLoading(true);
    setDrawerOpen(true);
    setDetailError(null);
    setDependencyDetail(null);
    
    // Quick preview from list while fetching full audit/evidence history
    const existing = activities.find(a => a.activity_id === activityId);
    if (existing) {
      setSelectedActivity(existing);
    }

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
      } else {
        setDetailError('Unable to load activity history.');
      }
      if (depRes && depRes.success) {
        setDependencyDetail(depRes.data);
      }
    } catch (err) {
      console.error('Failed to load activity details:', err);
      setDetailError(err.response?.data?.detail || err.message || 'Unable to load activity history.');
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" />
            <span>In Progress</span>
          </span>
        );
      case 'Behind Schedule':
        return (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            <span>Behind Schedule</span>
          </span>
        );
      default:
        return (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A] w-fit">
            ⚪ Not Started
          </span>
        );
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header & Project Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#111111] border border-[#D4AF37]/30 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <Activity className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#EAEAEA] tracking-tight">
                  Verified Execution State
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded-full font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Separation of raw field extractions from trusted project progress with cumulative multi-observation lineage and delay tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-xs py-2 px-3 bg-[#111111] border border-[#2A2A2A] rounded-xl text-[#EAEAEA] font-mono focus:outline-none focus:border-[#D4AF37]"
          >
            {projectsList.length > 0 ? (
              projectsList.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#111111] text-[#EAEAEA]">
                  {p.code || p.id} - {p.name}
                </option>
              ))
            ) : (
              <option value="PRJ-REF-04">Refinery Expansion (PRJ-REF-04)</option>
            )}
          </select>
          <button
            onClick={fetchData}
            className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Semantic Distinction Banner */}
      <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-xl p-4 flex items-start gap-3.5 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
        <div className="p-1.5 bg-[#D4AF37]/10 rounded-lg shrink-0 mt-0.5 border border-[#D4AF37]/20">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div className="text-xs text-[#A3A3A3] leading-relaxed">
          <strong className="text-[#D4AF37] block font-bold text-sm mb-0.5">
            Architecture Rule: Event-Level Progress vs Verified Activity Progress
          </strong>
          Raw field observations capture discrete sub-work segments (e.g. 100% of a foundation sub-pour or 50m spool segment) without prematurely marking whole scheduled tasks complete. Verified cumulative progress accumulates monotonically under planner governance, preserving every historical observation and audit trace.
        </div>
      </div>

      {/* Executive Rollup KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="panel-card p-4 border-l-4 border-l-[#D4AF37]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">
              Verified Progress
            </div>
            <div className="text-2xl font-black text-[#D4AF37] mt-1 font-mono">
              {summary.overall_actual_progress}%
            </div>
            <div className="text-xs text-[#A3A3A3] mt-1 flex items-center gap-1">
              <span>Planned: {summary.overall_planned_progress}%</span>
              <span className={`font-semibold font-mono ${summary.overall_progress_variance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                ({summary.overall_progress_variance >= 0 ? '+' : ''}{summary.overall_progress_variance}%)
              </span>
            </div>
          </div>

          <div className="panel-card p-4 border-l-4 border-l-[#10B981]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">
              Completed Tasks
            </div>
            <div className="text-2xl font-black text-[#10B981] mt-1 font-mono">
              {summary.completed_count}
            </div>
            <div className="text-xs text-[#A3A3A3] mt-1">
              of {summary.total_activities} activities
            </div>
          </div>

          <div className="panel-card p-4 border-l-4 border-l-[#3B82F6]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">
              In Progress
            </div>
            <div className="text-2xl font-black text-[#3B82F6] mt-1 font-mono">
              {summary.in_progress_count}
            </div>
            <div className="text-xs text-[#A3A3A3] mt-1">
              Active field workfronts
            </div>
          </div>

          <div className="panel-card p-4 border-l-4 border-l-[#EF4444]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">
              Behind Schedule
            </div>
            <div className="text-2xl font-black text-[#EF4444] mt-1 font-mono">
              {summary.delayed_count}
            </div>
            <div className="text-xs text-[#A3A3A3] mt-1">
              Progress or date variance
            </div>
          </div>

          <div className="panel-card p-4 border-l-4 border-l-[#A855F7]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">
              Field Observations
            </div>
            <div className="text-2xl font-black text-[#A855F7] mt-1 font-mono">
              {summary.total_verified_observations}
            </div>
            <div className="text-xs text-[#A3A3A3] mt-1">
              Mapped DPR reports
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111111] p-3 rounded-xl border border-[#2A2A2A]">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search by code, name, area, line..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs py-2 px-3 w-64 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-[#EAEAEA] placeholder-[#555555] focus:outline-none focus:border-[#D4AF37] font-mono"
          />

          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value)}
            className="text-xs py-2 px-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-[#EAEAEA] focus:outline-none focus:border-[#D4AF37]"
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
            className="text-xs py-2 px-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-[#EAEAEA] focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Not Started">Not Started</option>
            <option value="Behind Schedule">Behind Schedule</option>
          </select>
        </div>

        <div className="text-xs text-[#A3A3A3] font-medium">
          Showing <strong className="text-[#D4AF37] font-mono">{activities.length}</strong> of <strong className="text-[#EAEAEA] font-mono">{totalCount}</strong> activities
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Activity Execution State Table */}
      <div className="panel-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-[#2A2A2A] text-[10px] uppercase tracking-wider font-bold text-[#A3A3A3]">
                <th className="py-3 px-4">Activity Code & Scope</th>
                <th className="py-3 px-4">Discipline / Area</th>
                <th className="py-3 px-4 w-56">Verified vs Planned Progress</th>
                <th className="py-3 px-4">Dates (Planned vs Actual)</th>
                <th className="py-3 px-4">Status & Delay</th>
                <th className="py-3 px-4 text-center">Observations</th>
                <th className="py-3 px-4 text-right">Lineage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A3A3A3]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading verified execution states...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A3A3A3]">
                    No activities found matching your criteria.
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr
                    key={act.db_id}
                    className="hover:bg-[#1A1A1A] transition-colors duration-150"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-bold text-[#D4AF37]">
                        {act.activity_id}
                      </div>
                      <div className="text-xs text-[#EAEAEA] font-medium mt-0.5 max-w-xs truncate" title={act.activity_name}>
                        {act.activity_name}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-xs text-[#EAEAEA] font-medium">
                        {act.discipline || 'General'}
                      </div>
                      <div className="text-xs text-[#A3A3A3] mt-0.5">
                        {act.location || 'Unassigned'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-[#EAEAEA] font-mono">
                          {act.actual_progress}%
                        </span>
                        <span className="text-[#A3A3A3] font-mono text-[11px]">
                          Plan: {act.planned_progress || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden relative border border-[#2A2A2A]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            act.actual_progress >= 100
                              ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                              : act.is_delayed
                              ? 'bg-gradient-to-r from-[#EF4444] to-[#F87171]'
                              : 'bg-gradient-to-r from-[#D4AF37] to-[#F4D06F]'
                          }`}
                          style={{ width: `${Math.min(100, act.actual_progress)}%` }}
                        />
                      </div>
                      {act.progress_variance !== null && act.progress_variance !== 0 && (
                        <div className={`text-[10px] mt-0.5 font-mono ${act.progress_variance >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          Variance: {act.progress_variance > 0 ? '+' : ''}{act.progress_variance}%
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs font-mono">
                      <div className="text-[#A3A3A3] text-[11px]">
                        P: {act.planned_start ? act.planned_start.slice(0, 10) : '-'} → {act.planned_finish ? act.planned_finish.slice(0, 10) : '-'}
                      </div>
                      <div className="text-[#EAEAEA] font-medium mt-0.5">
                        A: {act.actual_start ? act.actual_start.slice(0, 10) : 'Not Started'} → {act.actual_finish ? act.actual_finish.slice(0, 10) : (act.actual_progress > 0 ? 'In Progress' : '-')}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(act.status)}
                        {act.delay_days !== null && act.delay_days > 0 && (
                          <span className="text-[10px] text-[#EF4444] font-bold font-mono">
                            +{act.delay_days}d delay
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                        act.verified_observations_count > 0 ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-[#0A0A0A] text-[#A3A3A3] border border-[#2A2A2A]'
                      }`}>
                        {act.verified_observations_count}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(act.activity_id)}
                        className="btn-secondary text-xs py-1 px-3 font-medium hover:border-[#D4AF37]/60 hover:text-[#D4AF37] transition-all inline-flex items-center gap-1"
                      >
                        <span>Timeline & Audit</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observation History & Audit Detail Drawer */}
      <TimelineAuditDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activity={selectedActivity}
        dependencyDetail={dependencyDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => selectedActivityId && handleOpenDetail(selectedActivityId)}
      />
    </div>
  );
};

export default ExecutionStatePage;

