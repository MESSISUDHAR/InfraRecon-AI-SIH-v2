import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  GitFork,
  ArrowUpRight,
  Activity as ActivityIcon,
  Calendar,
  RefreshCw,
  Sliders,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Filter,
  Search,
  Database,
  Info,
  Sparkles,
  ChevronRight,
  GitBranch,
  Split,
  Link as LinkIcon,
  AlertOctagon,
  ArrowRightCircle,
  Maximize2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  getDashboardSummary,
  getDependencyImpactSummary,
  getActivityDependencyDetail,
  getProjects
} from '../services/api';

export default function DashboardPage({ onNavigate, initialProjectId = 'PRJ-REF-04' }) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectsList, setProjectsList] = useState([]);
  const [data, setData] = useState(null);
  const [dependencyData, setDependencyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delayedSearch, setDelayedSearch] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [depTab, setDepTab] = useState('CHAINS'); // 'CHAINS' | 'MATRIX' | 'PREDECESSORS'
  const [error, setError] = useState(null);

  // Activity Dependency Inspector Modal
  const [selectedDepActivity, setSelectedDepActivity] = useState(null);
  const [depModalOpen, setDepModalOpen] = useState(false);
  const [depModalLoading, setDepModalLoading] = useState(false);

  // Load projects list
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const prjs = await getProjects();
        if (Array.isArray(prjs)) {
          setProjectsList(prjs);
        }
      } catch (err) {
        console.warn('Could not load projects list for dashboard:', err);
      }
    };
    loadProjects();
  }, []);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [res, depRes] = await Promise.all([
        getDashboardSummary(projectId),
        getDependencyImpactSummary(projectId).catch(e => {
          console.warn('Dependency impact load failed:', e);
          return null;
        })
      ]);

      if (res.success) {
        setData(res);
      }
      if (depRes && depRes.success) {
        setDependencyData(depRes.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to fetch live dashboard metrics. Ensure backend server is active.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [projectId]);

  const handleInspectDependency = async (activityId) => {
    setDepModalLoading(true);
    setDepModalOpen(true);
    setSelectedDepActivity(null);
    try {
      const res = await getActivityDependencyDetail(activityId, projectId);
      if (res.success) {
        setSelectedDepActivity(res.data);
      }
    } catch (err) {
      console.error('Failed to load activity dependency:', err);
    } finally {
      setDepModalLoading(false);
    }
  };

  const formatPercent = (val) => {
    if (val === undefined || val === null) return '0.0%';
    return `${Number(val).toFixed(1)}%`;
  };

  const formatVariance = (val) => {
    if (val === undefined || val === null) return '0.0%';
    const n = Number(val);
    if (n > 0) return `+${n.toFixed(1)}% (Ahead)`;
    if (n < 0) return `${n.toFixed(1)}% (Lag)`;
    return '0.0% (On Track)';
  };

  const getVarianceBadge = (variance) => {
    const v = Number(variance || 0);
    if (v > 0) {
      return (
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          +{v.toFixed(1)}%
        </span>
      );
    }
    if (v < -5.0) {
      return (
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
          {v.toFixed(1)}%
        </span>
      );
    }
    if (v < 0) {
      return (
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {v.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
        0.0%
      </span>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return <span className="badge-high">Completed</span>;
      case 'In Progress':
        return <span className="badge-medium">In Progress</span>;
      case 'Not Started':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">Not Started</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">{status}</span>;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'AUTO_MATCH':
        return <span className="badge-high text-[10px] py-0.2">AUTO_MATCH</span>;
      case 'PLANNER_APPROVAL':
        return <span className="badge-medium text-[10px] py-0.2">PLANNER_APPROVAL</span>;
      case 'PLANNER_OVERRIDE':
        return <span className="badge-low text-[10px] py-0.2 text-amber-300">PLANNER_OVERRIDE</span>;
      default:
        return <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">{action}</span>;
    }
  };

  const getRiskSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            MEDIUM
          </span>
        );
      case 'BUFFERED':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            BUFFERED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {severity || 'NONE'}
          </span>
        );
    }
  };

  const filteredDelayedActivities = (data?.delayed_activities || []).filter(act => {
    const matchesSearch = !delayedSearch || (
      act.activity_id.toLowerCase().includes(delayedSearch.toLowerCase()) ||
      act.activity_name.toLowerCase().includes(delayedSearch.toLowerCase()) ||
      (act.discipline && act.discipline.toLowerCase().includes(delayedSearch.toLowerCase()))
    );
    const matchesDisc = selectedDiscipline === 'ALL' || act.discipline === selectedDiscipline;
    return matchesSearch && matchesDisc;
  });

  const kpis = data?.kpis;
  const disciplines = data?.discipline_breakdown || [];
  const statusDist = data?.status_distribution || [];
  const sCurveData = data?.progress_s_curve || [];
  const transitions = data?.recent_transitions || [];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-[#D4AF37]" />
            <span>Project Intelligence & Execution Dashboard</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full font-mono">
              Live Verified State
            </span>
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Real-time Planned vs. Actual progress S-Curves, discipline performance variance, critical delay tracking, and human-in-the-loop review funnel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing || loading}
            className="px-3 py-2 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-[#EAEAEA] rounded-lg transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#A3A3A3] ${refreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
            <span>Sync Live DB</span>
          </button>
          
          <button 
            onClick={() => onNavigate && onNavigate('planner-review')}
            className="btn-secondary text-xs"
          >
            <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Planner Review ({kpis?.pending_reviews ?? 0})</span>
          </button>

          <button 
            onClick={() => onNavigate && onNavigate('execution-state')}
            className="btn-primary text-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified State</span>
          </button>
        </div>
      </div>

      {/* Zero Fabrication Integrity Banner */}
      <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sparta-card">
        <div className="flex items-center gap-2.5 text-xs text-[#EAEAEA]">
          <div className="p-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded text-[#D4AF37]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-white">Strict Calculation Guarantee: </strong>
            <span className="text-[#A3A3A3]">Every metric and chart is computed directly from active project schedule activities and verified execution state records.</span>
          </div>
        </div>
        <div className="text-[11px] text-[#A3A3A3] font-mono flex items-center gap-2 bg-[#0A0A0A] px-2.5 py-1 rounded border border-[#2A2A2A] shrink-0">
          <span>Project:</span>
          {projectsList.length > 0 ? (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-[#111111] border border-[#2A2A2A] rounded px-1.5 py-0.5 text-[#F4D06F] font-mono font-bold text-xs focus:outline-none focus:border-[#D4AF37]"
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code || p.id} - {p.name}
                </option>
              ))}
            </select>
          ) : (
            <strong className="text-[#F4D06F]">{projectId}</strong>
          )}
          <span className="text-[#6b6b6b]">•</span>
          <span>Schedule: <strong className="text-[#EAEAEA]">{data?.active_schedule_version || 'v1.0'}</strong></span>
        </div>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Schedule Activities */}
        <div className="panel-card p-4 space-y-1.5 border-l-4 border-l-[#D4AF37]">
          <div className="flex items-center justify-between text-[#A3A3A3] text-xs">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-[#D4AF37]">Schedule Activities</span>
            <Layers className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '...' : (kpis?.total_schedule_activities || 0)}
          </div>
          <div className="text-[11px] text-[#A3A3A3] flex items-center gap-1">
            <span className="text-[#F4D06F] font-medium">{disciplines.length} Disciplines</span>
            <span>• Active v1.0</span>
          </div>
        </div>

        {/* Card 2: Verified Activities */}
        <div className="panel-card p-4 space-y-1.5 border-l-4 border-l-[#10B981]">
          <div className="flex items-center justify-between text-[#A3A3A3] text-xs">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-[#10B981]">Verified Activities</span>
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold text-[#10B981] font-mono">
            {loading ? '...' : (kpis?.verified_activities || 0)}
          </div>
          <div className="text-[11px] text-[#A3A3A3] flex items-center gap-1">
            <span className="text-[#10B981] font-medium">
              {kpis?.total_schedule_activities ? `${((kpis.verified_activities / kpis.total_schedule_activities) * 100).toFixed(1)}%` : '0%'}
            </span>
            <span>coverage</span>
          </div>
        </div>

        {/* Card 3: Verified Actual vs Planned Progress */}
        <div className="panel-card p-4 space-y-1.5 border-l-4 border-l-[#F4D06F]">
          <div className="flex items-center justify-between text-[#A3A3A3] text-xs">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-[#F4D06F]">Verified Progress</span>
            <TrendingUp className="w-4 h-4 text-[#F4D06F]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F4D06F] font-mono">
              {loading ? '...' : formatPercent(kpis?.overall_actual_progress)}
            </span>
          </div>
          <div className="text-[11px] text-[#A3A3A3] flex items-center gap-1">
            <span>Planned: {formatPercent(kpis?.overall_planned_progress)}</span>
          </div>
        </div>

        {/* Card 4: Schedule Variance */}
        <div className="panel-card p-4 space-y-1.5 border-l-4 border-l-[#8B5CF6]">
          <div className="flex items-center justify-between text-[#A3A3A3] text-xs">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-[#8B5CF6]">Schedule Variance</span>
            <GitFork className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '...' : formatPercent(kpis?.overall_variance)}
          </div>
          <div className="text-[11px] text-[#A3A3A3]">
            {kpis && formatVariance(kpis.overall_variance)}
          </div>
        </div>

        {/* Card 5: Pending Reviews */}
        <div className="panel-card p-4 space-y-1.5 border-l-4 border-l-[#F59E0B]">
          <div className="flex items-center justify-between text-[#A3A3A3] text-xs">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-[#F59E0B]">Pending Reviews</span>
            <Clock className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-[#F59E0B] font-mono">
            {loading ? '...' : (kpis?.pending_reviews || 0)}
          </div>
          <div className="text-[11px] text-[#F59E0B]/90 flex items-center gap-1">
            <span>Requires planner action</span>
          </div>
        </div>

        {/* Card 6: Critical Delayed Activities */}
        <div className="panel-card p-4 space-y-1.5 border-l-4 border-l-[#EF4444]">
          <div className="flex items-center justify-between text-[#A3A3A3] text-xs">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-[#EF4444]">Delayed Activities</span>
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-2xl font-bold text-[#EF4444] font-mono">
            {loading ? '...' : (kpis?.delayed_activities || 0)}
          </div>
          <div className="text-[11px] text-[#EF4444]/90 flex items-center gap-1">
            <span>Behind baseline dates</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row 1: S-Curve Progress & Discipline Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: S-Curve Planned vs Verified Actual (Span 2) */}
        <div className="panel-card p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                Cumulative Planned vs. Actual Progress (S-Curve)
              </h2>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Baseline Planned Schedule vs. Verified Field Observations Progress Curve
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                <span className="w-3 h-1 bg-[#D4AF37] rounded-full" /> Planned Baseline
              </span>
              <span className="flex items-center gap-1.5 text-[#10B981] font-semibold">
                <span className="w-3 h-1 bg-[#10B981] rounded-full" /> Verified Actual
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[#A3A3A3] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mr-2" />
                Calculating S-Curve Trajectories...
              </div>
            ) : sCurveData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#A3A3A3] text-xs">
                No schedule dates available to generate progress curves.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sCurveData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" opacity={0.6} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#A3A3A3" 
                    fontSize={11} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#A3A3A3" 
                    fontSize={11} 
                    domain={[0, 100]} 
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#111111', 
                      borderColor: '#2A2A2A', 
                      borderRadius: '8px', 
                      fontSize: '12px',
                      color: '#EAEAEA' 
                    }}
                    formatter={(val) => [`${Number(val).toFixed(1)}%`, '']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="planned_cumulative" 
                    name="Planned Baseline" 
                    stroke="#D4AF37" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#plannedGradient)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actual_cumulative" 
                    name="Verified Actual" 
                    stroke="#10B981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#actualGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Status Distribution Donut Chart */}
        <div className="panel-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#D4AF37]" />
                Activity Status Breakdown
              </h2>
              <p className="text-xs text-[#A3A3A3] mt-0.5">Execution state distribution</p>
            </div>
            <span className="text-xs font-mono font-bold text-[#EAEAEA]">
              {kpis?.total_schedule_activities || 0} Total
            </span>
          </div>

          <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {statusDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#111111', 
                    borderColor: '#2A2A2A', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    color: '#EAEAEA' 
                  }}
                  formatter={(val, name, props) => [`${val} tasks (${props.payload.percentage}%)`, props.payload.status]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-white font-mono">
                {kpis?.verified_activities || 0}
              </span>
              <span className="text-[10px] text-[#D4AF37] uppercase font-semibold">Verified</span>
            </div>
          </div>

          {/* Status Legend List */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#2A2A2A]">
            {statusDist.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-1.5 bg-[#0A0A0A] rounded border border-[#2A2A2A]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[#EAEAEA] truncate text-[11px]">{item.status}</span>
                </div>
                <span className="font-mono font-bold text-[#EAEAEA] text-[11px] shrink-0 ml-1">
                  {item.count} <span className="text-[10px] text-[#A3A3A3] font-normal">({item.percentage}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Charts Row 2: Discipline Performance Comparison & Review Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discipline Comparison Bar Chart (Span 2) */}
        <div className="panel-card p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#D4AF37]" />
                Discipline Performance Comparison (Planned vs. Actual)
              </h2>
              <p className="text-xs text-[#A3A3A3] mt-0.5">Average progress percentage comparison by engineering discipline</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[#A3A3A3] font-medium">
                <span className="w-2.5 h-2.5 bg-[#383838] rounded" /> Planned
              </span>
              <span className="flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                <span className="w-2.5 h-2.5 bg-[#D4AF37] rounded" /> Verified Actual
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[#A3A3A3] text-xs">
                Loading Discipline Metrics...
              </div>
            ) : disciplines.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#A3A3A3] text-xs">
                No discipline data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={disciplines} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" opacity={0.6} />
                  <XAxis 
                    dataKey="discipline" 
                    stroke="#A3A3A3" 
                    fontSize={11} 
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    stroke="#A3A3A3" 
                    fontSize={11} 
                    domain={[0, 100]} 
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#111111', 
                      borderColor: '#2A2A2A', 
                      borderRadius: '8px', 
                      fontSize: '11px',
                      color: '#EAEAEA' 
                    }}
                    formatter={(val, name) => [`${Number(val).toFixed(1)}%`, name]}
                  />
                  <Bar dataKey="planned_progress" name="Planned Progress" fill="#383838" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual_progress" name="Verified Actual Progress" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Review & Reconciliation Funnel */}
        <div className="panel-card p-6 space-y-4">
          <div className="border-b border-[#2A2A2A] pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              Reconciliation & Review Funnel
            </h2>
            <p className="text-xs text-[#A3A3A3] mt-0.5">Pipeline from raw evidence to verified state</p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Step 1: Field Evidence */}
            <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] space-y-1">
              <div className="flex justify-between items-center text-[#A3A3A3] text-[11px]">
                <span className="font-semibold flex items-center gap-1.5 text-[#EAEAEA]">
                  <ActivityIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                  1. Ingested Field Events
                </span>
                <span className="font-mono font-bold text-white">{kpis?.total_field_events || 0}</span>
              </div>
              <p className="text-[11px] text-[#A3A3A3]">Raw DPRs, supervisor logs, and field reports</p>
            </div>

            {/* Step 2: Auto-Approved High Confidence */}
            <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#10B981]/30 space-y-1">
              <div className="flex justify-between items-center text-[#A3A3A3] text-[11px]">
                <span className="font-semibold text-[#10B981] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  2. High Confidence Matches (≥85%)
                </span>
                <span className="font-mono font-bold text-[#10B981]">
                  {kpis?.verified_activities ? Math.max(0, kpis.verified_activities - (kpis.pending_reviews || 0)) : 0}
                </span>
              </div>
              <p className="text-[11px] text-[#A3A3A3]">Auto-matched by multi-signal engine</p>
            </div>

            {/* Step 3: Pending Human Review */}
            <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#F59E0B]/30 space-y-1">
              <div className="flex justify-between items-center text-[#A3A3A3] text-[11px]">
                <span className="font-semibold text-[#F59E0B] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  3. Pending Planner Review
                </span>
                <span className="font-mono font-bold text-[#F59E0B]">{kpis?.pending_reviews || 0}</span>
              </div>
              <p className="text-[11px] text-[#A3A3A3]">Medium/Low confidence awaiting human validation</p>
            </div>

            {/* Step 4: Verified Execution State */}
            <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#D4AF37]/40 space-y-1">
              <div className="flex justify-between items-center text-[#A3A3A3] text-[11px]">
                <span className="font-semibold text-[#F4D06F] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                  4. Immutable Audit Records
                </span>
                <span className="font-mono font-bold text-[#F4D06F]">{kpis?.total_audit_logs || 0}</span>
              </div>
              <p className="text-[11px] text-[#A3A3A3]">Traceable 7-stage decisions with zero leaks</p>
            </div>
          </div>
        </div>
      </div>

      {/* MILESTONE 12: Dependency Intelligence & Cascading Slippage Analysis */}
      <div className="panel-card p-6 space-y-5 border-l-4 border-l-[#D4AF37]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <GitBranch className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Dependency Intelligence & Cascading Slippage Analysis
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full font-semibold">
                Milestone 12 Active
              </span>
            </div>
            <p className="text-xs text-[#A3A3A3] mt-1">
              Deterministic rule-based schedule dependency impact derived strictly from CPM predecessor-successor links. No predictive forecasting claimed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#A3A3A3] font-mono">CPM Float Traversal:</span>
            <span className="text-xs px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 rounded font-semibold font-mono">
              Deterministic
            </span>
          </div>
        </div>

        {/* 4 Dependency KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
            <div className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wider">Delayed Predecessors</div>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {dependencyData?.total_delayed_predecessors || 0}
            </div>
            <div className="text-[10px] text-[#A3A3A3] mt-0.5">Tasks blocking downstream work</div>
          </div>

          <div className="p-3.5 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
            <div className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wider">Downstream Impacted</div>
            <div className="text-xl font-bold font-mono text-[#F59E0B] mt-1">
              {dependencyData?.total_downstream_impacted_activities || 0}
            </div>
            <div className="text-[10px] text-[#A3A3A3] mt-0.5">Successors facing potential delay</div>
          </div>

          <div className="p-3.5 bg-[#0A0A0A] rounded-lg border border-[#EF4444]/30">
            <div className="text-[11px] text-[#EF4444] font-medium uppercase tracking-wider">Critical Cascades</div>
            <div className="text-xl font-bold font-mono text-[#EF4444] mt-1">
              {dependencyData?.critical_cascades_count || 0}
            </div>
            <div className="text-[10px] text-[#EF4444]/70 mt-0.5">Multi-tier critical paths</div>
          </div>

          <div className="p-3.5 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
            <div className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wider">Cumulative Slippage</div>
            <div className="text-xl font-bold font-mono text-[#F4D06F] mt-1">
              +{dependencyData?.total_estimated_slippage_days || 0}d
            </div>
            <div className="text-[10px] text-[#A3A3A3] mt-0.5">Total unbuffered delay days</div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex border-b border-[#2A2A2A] gap-3 text-xs">
          <button
            onClick={() => setDepTab('CHAINS')}
            className={`pb-2 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              depTab === 'CHAINS' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#A3A3A3] hover:text-[#EAEAEA]'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>Critical Cascade Chains ({dependencyData?.critical_cascade_chains?.length || 0})</span>
          </button>
          <button
            onClick={() => setDepTab('MATRIX')}
            className={`pb-2 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              depTab === 'MATRIX' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#A3A3A3] hover:text-[#EAEAEA]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Downstream Impact Matrix ({dependencyData?.downstream_impact_matrix?.length || 0})</span>
          </button>
          <button
            onClick={() => setDepTab('PREDECESSORS')}
            className={`pb-2 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              depTab === 'PREDECESSORS' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#A3A3A3] hover:text-[#EAEAEA]'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Delayed Predecessors ({dependencyData?.delayed_predecessors?.length || 0})</span>
          </button>
        </div>

        {/* Sub-tab 1: Critical Cascading Chains */}
        {depTab === 'CHAINS' && (
          <div className="space-y-3">
            {(!dependencyData?.critical_cascade_chains || dependencyData.critical_cascade_chains.length === 0) ? (
              <div className="p-6 text-center text-[#A3A3A3] text-xs bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                <CheckCircle2 className="w-6 h-6 text-[#10B981] mx-auto mb-1" />
                No multi-tier critical cascade chains detected in CPM network.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dependencyData.critical_cascade_chains.map((chain, cIdx) => (
                  <div key={cIdx} className="p-4 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] space-y-2 hover:border-[#D4AF37]/40 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#EAEAEA]">Cascade Chain #{cIdx + 1} (Tier {chain.tier})</span>
                      {getRiskSeverityBadge(chain.severity)}
                    </div>

                    {/* Chain Node Path */}
                    <div className="flex items-center gap-1.5 flex-wrap py-2 font-mono text-xs">
                      {chain.chain_nodes.map((node, nIdx) => (
                        <React.Fragment key={nIdx}>
                          <span className={`px-2 py-1 rounded font-bold ${
                            nIdx === 0 ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'bg-[#1A1A1A] text-[#EAEAEA] border border-[#2A2A2A]'
                          }`}>
                            {node}
                          </span>
                          {nIdx < chain.chain_nodes.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-[#6b6b6b] shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#A3A3A3] pt-2 border-t border-[#2A2A2A]">
                      <div>
                        <span>Cumulative Slippage: </span>
                        <strong className="text-[#EF4444] font-mono font-bold">+{chain.cumulative_slippage_days} days</strong>
                      </div>
                      <button
                        onClick={() => handleInspectDependency(chain.chain_nodes[0])}
                        className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#EAEAEA] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                      >
                        <span>Inspect Root Node</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-tab 2: Downstream Impact Matrix */}
        {depTab === 'MATRIX' && (
          <div className="overflow-x-auto">
            {(!dependencyData?.downstream_impact_matrix || dependencyData.downstream_impact_matrix.length === 0) ? (
              <div className="p-6 text-center text-[#A3A3A3] text-xs bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                No downstream impacts identified from current execution states.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-[#EAEAEA]">
                <thead className="text-[10px] uppercase font-bold text-[#D4AF37] bg-[#1A1A1A] border-b border-[#2A2A2A]">
                  <tr>
                    <th className="py-2.5 px-3">Predecessor (Delayed)</th>
                    <th className="py-2.5 px-3">Link</th>
                    <th className="py-2.5 px-3">Successor (Impacted)</th>
                    <th className="py-2.5 px-3">Predecessor Delay</th>
                    <th className="py-2.5 px-3">Float Buffer</th>
                    <th className="py-2.5 px-3">Potential Slippage</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {dependencyData.downstream_impact_matrix.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#D4AF37]">
                        {item.predecessor_code}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-[#A3A3A3]">
                        <span className="px-1.5 py-0.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded">{item.dependency_type}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-[#EAEAEA]">{item.successor_code}</div>
                        <div className="text-[10px] text-[#A3A3A3] line-clamp-1">{item.successor_name}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#EF4444] font-bold">
                        +{item.incoming_delay_days}d
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#A3A3A3]">
                        {item.buffer_days}d
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {item.potential_delay_slippage_days > 0 ? (
                          <span className="text-[#EF4444]">+{item.potential_delay_slippage_days}d</span>
                        ) : (
                          <span className="text-[#10B981]">0d (Buffered)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {getRiskSeverityBadge(item.risk_severity)}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleInspectDependency(item.predecessor_code)}
                          className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#EAEAEA] rounded text-[10px] font-medium transition-colors"
                        >
                          Inspect CPM
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Sub-tab 3: Delayed Predecessors */}
        {depTab === 'PREDECESSORS' && (
          <div className="space-y-3">
            {(!dependencyData?.delayed_predecessors || dependencyData.delayed_predecessors.length === 0) ? (
              <div className="p-6 text-center text-[#A3A3A3] text-xs bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                No delayed predecessor activities currently active.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dependencyData.delayed_predecessors.map((dp) => (
                  <div key={dp.activity_id} className="p-3.5 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#D4AF37]">{dp.activity_code}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded font-mono font-bold">
                          +{dp.effective_delay_days}d Delay
                        </span>
                      </div>
                      <div className="text-xs text-[#EAEAEA] font-medium line-clamp-1">{dp.activity_name}</div>
                      <div className="text-[10px] text-[#A3A3A3]">
                        {dp.downstream_successors?.length || 0} downstream successors dependent on this task
                      </div>
                    </div>
                    <button
                      onClick={() => handleInspectDependency(dp.activity_code)}
                      className="px-2.5 py-1.5 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#EAEAEA] rounded text-xs font-semibold transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delayed & Critical Path Activities Table */}
      <div className="panel-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              <span>Delayed & Critical Path Activities Tracking</span>
              <span className="text-xs px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 rounded-full font-mono">
                {filteredDelayedActivities.length} flagged
              </span>
            </h2>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              Activities where verified progress lags baseline or actual finish exceeds planned schedule
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter delayed activities..."
                value={delayedSearch}
                onChange={(e) => setDelayedSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs text-[#EAEAEA] placeholder-[#A3A3A3] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Discipline Dropdown */}
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs text-[#EAEAEA] px-3 py-1.5 focus:outline-none focus:border-[#D4AF37] font-medium cursor-pointer"
            >
              <option value="ALL">All Disciplines</option>
              {disciplines.map(d => (
                <option key={d.discipline} value={d.discipline}>{d.discipline}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredDelayedActivities.length === 0 ? (
          <div className="p-8 text-center text-[#A3A3A3] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto" />
            <div className="text-xs font-semibold text-[#EAEAEA]">No Critical Delays Detected</div>
            <p className="text-[11px] text-[#A3A3A3] max-w-sm mx-auto">
              All schedule activities are trending on schedule or within acceptable tolerance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#EAEAEA]">
              <thead className="text-[10px] uppercase font-bold text-[#D4AF37] bg-[#1A1A1A] border-b border-[#2A2A2A]">
                <tr>
                  <th className="py-2.5 px-3">Activity ID</th>
                  <th className="py-2.5 px-3">Scope Description</th>
                  <th className="py-2.5 px-3">Discipline</th>
                  <th className="py-2.5 px-3">Planned Finish</th>
                  <th className="py-2.5 px-3">Actual Finish / Status</th>
                  <th className="py-2.5 px-3">Planned</th>
                  <th className="py-2.5 px-3">Verified Actual</th>
                  <th className="py-2.5 px-3">Variance</th>
                  <th className="py-2.5 px-3">Delay Days</th>
                  <th className="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {filteredDelayedActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#D4AF37]">
                      {act.activity_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-[#EAEAEA] line-clamp-1 max-w-xs">{act.activity_name}</div>
                      {act.location && <div className="text-[10px] text-[#A3A3A3] font-mono">Loc: {act.location}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-[#A3A3A3]">
                      <span className="text-[11px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded">{act.discipline || 'General'}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#A3A3A3] text-[11px]">
                      {act.planned_finish || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {act.actual_finish ? (
                        <span className="text-[#10B981] font-bold">{act.actual_finish}</span>
                      ) : (
                        getStatusBadge(act.status)
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#A3A3A3]">
                      {formatPercent(act.planned_progress)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#F4D06F]">
                      {formatPercent(act.actual_progress)}
                    </td>
                    <td className="py-2.5 px-3">
                      {getVarianceBadge(act.variance)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {act.delay_days !== null && act.delay_days !== undefined ? (
                        <span className="text-[#EF4444] font-bold">+{act.delay_days}d</span>
                      ) : (
                        <span className="text-[#6b6b6b]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <button
                        onClick={() => handleInspectDependency(act.activity_id)}
                        className="px-2 py-1 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#F4D06F] border border-[#D4AF37]/30 rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                        title="Inspect CPM Dependencies"
                      >
                        <GitBranch className="w-3 h-3 text-[#D4AF37]" />
                        <span>CPM</span>
                      </button>
                      <button
                        onClick={() => onNavigate && onNavigate('execution-state')}
                        className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[#EAEAEA] rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent State Transitions Ledger (Bottom) */}
      {transitions.length > 0 && (
        <div className="panel-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                Latest Verified State Transitions
              </h2>
              <p className="text-xs text-[#A3A3A3] mt-0.5">Chronological audit decisions impacting project actual progress</p>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('execution-state')}
              className="text-xs text-[#D4AF37] hover:text-[#FFD700] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View Verified Execution State</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {transitions.slice(0, 6).map((item) => (
              <div key={item.audit_id} className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] flex items-center justify-between gap-3">
                <div className="space-y-1 truncate">
                  <div className="flex items-center gap-2">
                    {getActionBadge(item.action_type)}
                    <span className="font-mono text-[#D4AF37] font-bold">{item.activity_id}</span>
                  </div>
                  <div className="text-[#EAEAEA] font-medium truncate text-[11px]">{item.activity_name}</div>
                  <div className="text-[10px] text-[#A3A3A3] font-mono">By: {item.performed_by}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[#EAEAEA] font-mono text-[11px]">
                    <span className="text-[#A3A3A3]">{item.previous_progress !== undefined ? `${item.previous_progress}%` : '0%'}</span>
                    {' '}&rarr;{' '}
                    <span className="text-[#10B981] font-bold">{item.new_progress !== undefined ? `${item.new_progress}%` : 'Updated'}</span>
                  </div>
                  <div className="text-[10px] text-[#A3A3A3]">{item.status || 'VERIFIED'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive CPM Dependency Inspection Modal */}
      {depModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#0A0A0A]">
              <div className="flex items-center gap-2.5">
                <GitBranch className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>CPM Dependency Intelligence</span>
                    {selectedDepActivity && (
                      <span className="text-xs px-2 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 font-mono rounded">
                        {selectedDepActivity.activity_code}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[#A3A3A3]">{selectedDepActivity?.activity_name || 'Loading details...'}</p>
                </div>
              </div>
              <button
                onClick={() => setDepModalOpen(false)}
                className="text-[#A3A3A3] hover:text-[#D4AF37] p-1 rounded-lg hover:bg-[#1A1A1A] transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Disclaimer */}
              <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg text-[#F59E0B]">
                <strong>Rule-Based Schedule Impact Notice:</strong>
                <p className="mt-0.5 text-[#F59E0B]/90 text-[11px]">
                  Deterministic rule-based schedule dependency impact derived strictly from CPM predecessor-successor links. No predictive forecasting claimed.
                </p>
              </div>

              {depModalLoading ? (
                <div className="flex items-center justify-center h-40 text-[#A3A3A3]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mr-2" />
                  <span>Traversing CPM schedule dependencies...</span>
                </div>
              ) : selectedDepActivity ? (
                <>
                  {/* Activity Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                      <div className="text-[10px] text-[#A3A3A3] uppercase font-medium">Discipline</div>
                      <div className="text-xs font-bold text-white mt-0.5">{selectedDepActivity.discipline || 'General'}</div>
                    </div>
                    <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                      <div className="text-[10px] text-[#A3A3A3] uppercase font-medium">Planned Finish</div>
                      <div className="text-xs font-bold text-white font-mono mt-0.5">{selectedDepActivity.planned_finish || 'N/A'}</div>
                    </div>
                    <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                      <div className="text-[10px] text-[#A3A3A3] uppercase font-medium">Verified Status</div>
                      <div className="text-xs font-bold mt-0.5">{selectedDepActivity.status || 'Active'}</div>
                    </div>
                    <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A]">
                      <div className="text-[10px] text-[#A3A3A3] uppercase font-medium">Effective Delay</div>
                      <div className="text-xs font-bold font-mono mt-0.5">
                        {selectedDepActivity.effective_delay_days > 0 ? (
                          <span className="text-[#EF4444]">+{selectedDepActivity.effective_delay_days}d</span>
                        ) : (
                          <span className="text-[#10B981]">0d (On Schedule)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upstream Predecessors */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                      <span>⬅️ Upstream Predecessors ({selectedDepActivity.upstream_predecessors?.length || 0})</span>
                      <span className="text-[10px] text-[#A3A3A3] font-normal">Must complete before this activity</span>
                    </h4>

                    {(!selectedDepActivity.upstream_predecessors || selectedDepActivity.upstream_predecessors.length === 0) ? (
                      <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] text-[#A3A3A3] italic text-center">
                        No upstream predecessors in CPM schedule.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDepActivity.upstream_predecessors.map((p, idx) => (
                          <div key={idx} className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#D4AF37]">{p.predecessor_code}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] font-mono rounded">{p.dependency_type}</span>
                                {p.is_predecessor_delayed ? (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded font-bold">
                                    Delayed +{p.predecessor_delay_days}d
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded">
                                    On Schedule
                                  </span>
                                )}
                              </div>
                              <div className="text-[#EAEAEA] text-xs font-medium">{p.predecessor_name}</div>
                              <div className="text-[10px] text-[#A3A3A3] font-mono">
                                Finish: {p.predecessor_planned_finish || 'N/A'} • Status: {p.predecessor_status || 'Active'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[10px] text-[#A3A3A3]">Float Buffer</div>
                              <div className="font-mono font-bold text-[#EAEAEA]">{p.buffer_days_to_this} days</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Downstream Successors */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                      <span>➡️ Downstream Successors ({selectedDepActivity.downstream_successors?.length || 0})</span>
                      <span className="text-[10px] text-[#A3A3A3] font-normal">Tasks dependent on this activity</span>
                    </h4>

                    {(!selectedDepActivity.downstream_successors || selectedDepActivity.downstream_successors.length === 0) ? (
                      <div className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] text-[#A3A3A3] italic text-center">
                        No downstream successors mapped to this activity.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDepActivity.downstream_successors.map((s, idx) => (
                          <div key={idx} className="p-3 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#D4AF37]">{s.successor_code}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] font-mono rounded">{s.dependency_type}</span>
                                {getRiskSeverityBadge(s.risk_severity)}
                              </div>
                              <div className="text-[#EAEAEA] text-xs font-medium">{s.successor_name}</div>
                              <div className="text-[10px] text-[#A3A3A3] font-mono">
                                Planned Start: {s.successor_planned_start || 'N/A'} • Discipline: {s.successor_discipline || 'General'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[10px] text-[#A3A3A3]">Float Buffer: {s.buffer_days}d</div>
                              <div className="font-mono font-bold mt-0.5">
                                {s.potential_delay_slippage_days > 0 ? (
                                  <span className="text-[#EF4444]">+{s.potential_delay_slippage_days}d Slippage</span>
                                ) : (
                                  <span className="text-[#10B981]">Buffered (0d)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-[#2A2A2A] bg-[#0A0A0A] flex items-center justify-between">
              <span className="text-[11px] text-[#A3A3A3] font-mono">
                SIH Planning-to-Execution Intelligence Engine
              </span>
              <button
                onClick={() => setDepModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
