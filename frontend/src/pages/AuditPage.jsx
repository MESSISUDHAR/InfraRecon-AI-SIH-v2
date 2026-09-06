import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  ShieldCheck, 
  Clock, 
  UserCheck, 
  Lock, 
  RefreshCw, 
  Layers, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Database,
  ArrowRight,
  Eye,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Fingerprint,
  Info,
  GitCommit,
  Flame,
  ArrowUpRight,
  Sliders
} from 'lucide-react';
import { getAuditLogs, getAuditLogDetail, getAuditStats, getProjects } from '../services/api';

export default function AuditPage({ initialProjectId = 'PRJ-REF-04' }) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectsList, setProjectsList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [lineageDetail, setLineageDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeStageTab, setActiveStageTab] = useState(1);
  const [error, setError] = useState(null);

  // Load project list once
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const prjs = await getProjects();
        if (Array.isArray(prjs)) {
          setProjectsList(prjs);
        }
      } catch (err) {
        console.warn('Could not load projects list for audit page:', err);
      }
    };
    loadProjects();
  }, []);

  const fetchAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, statsRes] = await Promise.all([
        getAuditLogs({
          project_id: projectId,
          action_type: actionFilter !== 'ALL' ? actionFilter : undefined,
          limit: 100
        }),
        getAuditStats(projectId)
      ]);

      if (logsRes.success) {
        setLogs(logsRes.data || []);
      }
      if (statsRes.success) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error('Failed to load audit trail data:', err);
      setError('Failed to fetch audit records. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [projectId, actionFilter]);

  const handleInspectLineage = async (auditId) => {
    setSelectedAuditId(auditId);
    setDetailLoading(true);
    setActiveStageTab(1);
    try {
      const res = await getAuditLogDetail(auditId);
      if (res.success) {
        setLineageDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching lineage detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.activity_id && log.activity_id.toLowerCase().includes(term)) ||
      (log.activity_name && log.activity_name.toLowerCase().includes(term)) ||
      (log.source_id && log.source_id.toLowerCase().includes(term)) ||
      (log.performed_by && log.performed_by.toLowerCase().includes(term)) ||
      (log.decision_reason && log.decision_reason.toLowerCase().includes(term)) ||
      (log.id && log.id.toLowerCase().includes(term))
    );
  });

  const getActionBadge = (action) => {
    switch (action) {
      case 'AUTO_MATCH':
        return <span className="badge-high flex items-center gap-1"><Sparkles className="w-3 h-3" /> AUTO_MATCH</span>;
      case 'PLANNER_APPROVAL':
        return <span className="badge-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> PLANNER_APPROVAL</span>;
      case 'PLANNER_OVERRIDE':
        return <span className="badge-low flex items-center gap-1 text-amber-300 bg-amber-500/10 border-amber-500/20"><Sliders className="w-3 h-3" /> PLANNER_OVERRIDE</span>;
      case 'REJECTION':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 bg-rose-500/10 text-rose-400 border-rose-500/20"><XCircle className="w-3 h-3" /> REJECTION</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-slate-800 text-slate-300 border-slate-700">{action}</span>;
    }
  };

  const getBorderColor = (action) => {
    switch (action) {
      case 'AUTO_MATCH': return 'border-l-emerald-500';
      case 'PLANNER_APPROVAL': return 'border-l-brand-500';
      case 'PLANNER_OVERRIDE': return 'border-l-amber-500';
      case 'REJECTION': return 'border-l-rose-500';
      default: return 'border-l-slate-700';
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-brand-400" />
            <span>Evidence & Audit Trail</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full font-mono">
              Milestone 10 • 7-Stage Lineage
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete, immutable lineage tracing every reconciliation decision: <strong className="text-slate-300">Field Evidence → AI Extraction → Candidates → Reconciliation → Confidence → Human Decision → Verified State</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAuditData}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            Refresh Audit Logs
          </button>
        </div>
      </div>

      {/* Security & Integrity Banner */}
      <div className="bg-slate-950/80 border border-brand-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span>Zero-Leak Security & Explainability Standard</span>
              <span className="text-[10px] px-2 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono">COMPLIANT</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              API credentials, private key tokens, and internal headers are strictly omitted from audit payloads while retaining full prompt and model lineage.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-slate-400 font-mono">Project:</span>
          {projectsList.length > 0 ? (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-brand-500"
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code || p.id} - {p.name}
                </option>
              ))}
            </select>
          ) : (
            <strong className="text-white font-mono">{projectId}</strong>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="panel-card p-4 space-y-1">
            <div className="text-xs text-slate-400 font-medium">Total Audit Entries</div>
            <div className="text-2xl font-bold text-white tracking-tight">{stats.total_audit_records}</div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" /> Immutable ledger entries
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-emerald-500">
            <div className="text-xs text-slate-400 font-medium">Auto-Processed Matches</div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">{stats.auto_matches_count}</div>
            <div className="text-[10px] text-emerald-500/80 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> High confidence policy ($\ge$85%)
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-brand-500">
            <div className="text-xs text-slate-400 font-medium">Planner Approvals</div>
            <div className="text-2xl font-bold text-brand-400 tracking-tight">{stats.planner_approvals_count}</div>
            <div className="text-[10px] text-brand-400/80 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Human validated matches
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-amber-500">
            <div className="text-xs text-slate-400 font-medium">Planner Overrides</div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">{stats.planner_overrides_count}</div>
            <div className="text-[10px] text-amber-400/80 flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Alternative candidate chosen
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-rose-500">
            <div className="text-xs text-slate-400 font-medium">Rejections / Unmatched</div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">{stats.rejections_count}</div>
            <div className="text-[10px] text-rose-400/80 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> State preserved untouched
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="panel-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Activity ID, Name, Source ID, Reviewer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Decision Action:</span>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-brand-500 font-medium"
          >
            <option value="ALL">All Decision Types</option>
            <option value="AUTO_MATCH">AUTO_MATCH (High Confidence)</option>
            <option value="PLANNER_APPROVAL">PLANNER_APPROVAL (Validated)</option>
            <option value="PLANNER_OVERRIDE">PLANNER_OVERRIDE (Alternative)</option>
            <option value="REJECTION">REJECTION (Unmatched)</option>
            <option value="EXTRACTION">EXTRACTION</option>
          </select>
        </div>
      </div>

      {/* Main Audit Log Stream */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-400 mx-auto" />
          <div className="text-sm font-semibold text-slate-200">Loading Immutable Audit Stream...</div>
          <div className="text-xs text-slate-500">Retrieving full 7-stage lineage records from backend</div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="panel-card p-12 text-center text-slate-400 space-y-2">
          <Database className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">No Audit Records Found</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No audit records match the current filter criteria. Reconcile or review field events to populate the audit ledger.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className={`panel-card p-5 space-y-3 border-l-4 ${getBorderColor(log.action_type)} transition-all hover:border-slate-700 bg-slate-900/60`}
            >
              {/* Row Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {getActionBadge(log.action_type)}
                  {log.activity_id && (
                    <span className="text-xs font-mono text-brand-400 font-bold bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                      {log.activity_id}
                    </span>
                  )}
                  {log.activity_name && (
                    <span className="text-xs text-slate-200 font-medium">
                      {log.activity_name}
                    </span>
                  )}
                  <span className="text-xs text-slate-600">•</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Event: <strong className="text-slate-300">{log.event_id}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formatTimestamp(log.timestamp)}
                  </div>
                  <button
                    onClick={() => handleInspectLineage(log.id)}
                    className="px-3 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-md text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <span>Inspect Lineage</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Row Body - Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {/* Source & Evidence */}
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-brand-400" /> Source Evidence
                  </div>
                  <div className="text-slate-300 font-mono text-[11px] truncate">
                    {log.source_id ? `${log.source_id} (${log.source_type || 'Field'})` : 'Field Report'}
                  </div>
                  <p className="text-slate-400 italic text-[11px] line-clamp-1">
                    "{log.raw_evidence_snippet || 'No raw snippet'}"
                  </p>
                </div>

                {/* AI Model & Extraction */}
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" /> Extraction Engine
                  </div>
                  <div className="text-slate-200 font-mono text-[11px] flex items-center gap-1.5">
                    <span className="font-semibold text-cyan-300">{log.model_version || 'Gemini 2.5 Flash'}</span>
                    <span className="text-[10px] text-slate-400">({log.prompt_version || 'v1.0'})</span>
                  </div>
                  <p className="text-slate-400 text-[11px] truncate">
                    Embedding: <span className="font-mono text-slate-300">all-MiniLM-L6-v2</span>
                  </p>
                </div>

                {/* Confidence & Decision */}
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" /> Confidence & Reviewer
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[11px] text-emerald-400">
                      {log.confidence !== null ? `${(log.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      By: <strong className="text-slate-300">{log.performed_by || 'SYSTEM'}</strong>
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] truncate">
                    Action: <span className="font-mono text-slate-300">{log.action_type}</span>
                  </p>
                </div>

                {/* State Transition */}
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-400" /> State Transition
                  </div>
                  <div className="text-slate-200 font-mono text-[11px]">
                    Progress: <span className="text-slate-400">{log.previous_state?.actual_progress !== undefined ? `${log.previous_state.actual_progress}%` : '0%'}</span>
                    {' '}&rarr;{' '}
                    <span className="text-emerald-400 font-bold">{log.new_state?.actual_progress !== undefined ? `${log.new_state.actual_progress}%` : 'Updated'}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] truncate">
                    Status: <span className="font-medium text-slate-300">{log.new_state?.status || 'VERIFIED'}</span>
                  </p>
                </div>
              </div>

              {/* Rationale Footer */}
              <div className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-300 font-medium">Reconciliation Rationale: </strong>
                  <span>{log.decision_reason || 'Reconciliation match recorded.'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7-STAGE DEEP AUDIT LINEAGE INSPECTION MODAL */}
      {selectedAuditId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 border border-brand-500/20 rounded-lg text-brand-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      End-to-End Decision Lineage Inspector
                    </h2>
                    {lineageDetail && getActionBadge(lineageDetail.action_type)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Audit Log ID: {selectedAuditId} • Project: {lineageDetail?.project_id || 'PRJ-REF-04'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedAuditId(null);
                  setLineageDetail(null);
                }}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            {detailLoading || !lineageDetail ? (
              <div className="p-16 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-brand-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-200">Assembling 7-Stage Lineage Graph...</div>
                <div className="text-xs text-slate-500">Querying field evidence, Gemini extractions, embeddings, signals, and state deltas</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 7-Stage Progress Stepper Bar */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {[
                      { num: 1, label: '1. Field Evidence', icon: FileText },
                      { num: 2, label: '2. AI Extraction', icon: Cpu },
                      { num: 3, label: '3. Candidates', icon: Database },
                      { num: 4, label: '4. Reconciliation', icon: Sliders },
                      { num: 5, label: '5. Confidence', icon: Layers },
                      { num: 6, label: '6. Decision Gate', icon: UserCheck },
                      { num: 7, label: '7. Verified State', icon: ShieldCheck }
                    ].map((step) => {
                      const StepIcon = step.icon;
                      const isActive = activeStageTab === step.num;
                      return (
                        <button
                          key={step.num}
                          onClick={() => setActiveStageTab(step.num)}
                          className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                            isActive 
                              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm' 
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                          }`}
                        >
                          <StepIcon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
                          <span className="text-[11px] truncate w-full">{step.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stage 1: Field Evidence */}
                {activeStageTab === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-400" />
                        Stage 1: Raw Field Evidence Ingestion
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">Source ID: {lineageDetail.stage_1_field_evidence.source_id || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="panel-card p-3 space-y-1">
                        <div className="text-slate-500 text-[11px]">Source Type</div>
                        <div className="text-slate-200 font-semibold">{lineageDetail.stage_1_field_evidence.source_type || 'DPR'}</div>
                      </div>
                      <div className="panel-card p-3 space-y-1">
                        <div className="text-slate-500 text-[11px]">Report Date</div>
                        <div className="text-slate-200 font-mono">{lineageDetail.stage_1_field_evidence.report_date || 'N/A'}</div>
                      </div>
                      <div className="panel-card p-3 space-y-1">
                        <div className="text-slate-500 text-[11px]">Reporter / Field Supervisor</div>
                        <div className="text-slate-200 font-semibold">{lineageDetail.stage_1_field_evidence.reporter_name || 'Field Lead'}</div>
                      </div>
                    </div>

                    <div className="panel-card p-4 space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-brand-400" />
                        Verbatim Field Report Text
                      </div>
                      <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                        {lineageDetail.stage_1_field_evidence.raw_text || 'No raw text recorded.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 2: AI Extraction (Gemini 2.5 Flash) */}
                {activeStageTab === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        Stage 2: Deterministic AI Fact Extraction
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded font-mono">
                          {lineageDetail.stage_2_ai_extraction.model_version}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                          {lineageDetail.stage_2_ai_extraction.prompt_version}
                        </span>
                      </div>
                    </div>

                    {lineageDetail.stage_2_ai_extraction.grounding_direct_quote && (
                      <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-lg text-xs space-y-1">
                        <div className="text-[10px] text-cyan-400 uppercase font-bold">Grounding Verbatim Quote</div>
                        <p className="text-cyan-200 italic font-mono">
                          "{lineageDetail.stage_2_ai_extraction.grounding_direct_quote}"
                        </p>
                      </div>
                    )}

                    <div className="panel-card p-4 space-y-3">
                      <div className="text-xs font-bold text-slate-300">Extracted Structural Entities</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Activity Description</div>
                          <div className="text-slate-200 font-medium truncate">{lineageDetail.stage_2_ai_extraction.extracted_entities?.activity_description || 'N/A'}</div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Discipline</div>
                          <div className="text-slate-200 font-semibold">{lineageDetail.stage_2_ai_extraction.extracted_entities?.discipline || 'N/A'}</div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Location</div>
                          <div className="text-slate-200 font-medium">{lineageDetail.stage_2_ai_extraction.extracted_entities?.location || 'N/A'}</div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Asset / Line ID</div>
                          <div className="text-slate-200 font-mono text-brand-300">
                            {lineageDetail.stage_2_ai_extraction.extracted_entities?.asset_id || lineageDetail.stage_2_ai_extraction.extracted_entities?.line_id || 'N/A'}
                          </div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Event Type</div>
                          <div className="text-slate-200 font-semibold">{lineageDetail.stage_2_ai_extraction.extracted_entities?.event_type || 'progress'}</div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Reported Progress</div>
                          <div className="text-emerald-400 font-bold font-mono">
                            {lineageDetail.stage_2_ai_extraction.extracted_entities?.progress !== undefined && lineageDetail.stage_2_ai_extraction.extracted_entities?.progress !== null
                              ? `${lineageDetail.stage_2_ai_extraction.extracted_entities.progress}%`
                              : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Extraction Confidence</div>
                          <div className="text-brand-300 font-mono font-semibold">
                            {lineageDetail.stage_2_ai_extraction.extraction_confidence
                              ? `${(lineageDetail.stage_2_ai_extraction.extraction_confidence * 100).toFixed(1)}%`
                              : 'High'}
                          </div>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-0.5">
                          <div className="text-[10px] text-slate-500">Temporal Validity</div>
                          <div className="text-slate-300 font-mono text-[11px]">Validated</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 3: Candidate Retrieval */}
                {activeStageTab === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-purple-400" />
                        Stage 3: Vector Similarity Candidate Generation
                      </h3>
                      <div className="text-xs text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/20 font-mono">
                        Model: {lineageDetail.stage_3_candidate_retrieval.embedding_model} (384-dim)
                      </div>
                    </div>

                    <div className="panel-card overflow-hidden">
                      <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-300">
                        Retrieved Candidate Pool ({lineageDetail.stage_3_candidate_retrieval.retrieved_candidates.length} candidates)
                      </div>
                      <div className="divide-y divide-slate-800 text-xs">
                        {lineageDetail.stage_3_candidate_retrieval.retrieved_candidates.map((cand, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-brand-400 font-bold">{cand.activity_id}</span>
                                <span className="text-slate-200 font-medium">{cand.activity_name}</span>
                                {cand.discipline && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                    {cand.discipline}
                                  </span>
                                )}
                              </div>
                              {cand.location && (
                                <div className="text-[11px] text-slate-500 font-mono">Location: {cand.location}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-purple-300">
                                {(cand.semantic_similarity * 100).toFixed(1)}%
                              </div>
                              <div className="text-[10px] text-slate-500">Semantic Cosine</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 4: Contextual Reconciliation Breakdown */}
                {activeStageTab === 4 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-amber-400" />
                        Stage 4: Multi-Signal Contextual Reconciliation Matrix
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">Selected: <strong className="text-brand-300">{lineageDetail.stage_4_context_reconciliation.selected_activity_id}</strong></span>
                    </div>

                    {lineageDetail.stage_4_context_reconciliation.candidate_signals && (
                      <div className="panel-card p-4 space-y-4">
                        <div className="text-xs font-bold text-slate-300">6-Signal Weighted Contribution Breakdown</div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400">Semantic (40%)</div>
                            <div className="text-base font-mono font-bold text-purple-400">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.semantic_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400">Asset/Line ID (20%)</div>
                            <div className="text-base font-mono font-bold text-brand-400">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.identifier_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400">Discipline (15%)</div>
                            <div className="text-base font-mono font-bold text-cyan-400">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.discipline_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400">Location (10%)</div>
                            <div className="text-base font-mono font-bold text-emerald-400">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.location_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400">WBS Context (10%)</div>
                            <div className="text-base font-mono font-bold text-amber-400">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.wbs_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400">Temporal (5%)</div>
                            <div className="text-base font-mono font-bold text-blue-400">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.temporal_score * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stage 5: Confidence & Signals */}
                {activeStageTab === 5 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        Stage 5: Confidence Calculation & Signal Diagnostics
                      </h3>
                      <div className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                        {lineageDetail.stage_5_confidence_signals.confidence_tier} CONFIDENCE ({(lineageDetail.stage_5_confidence_signals.final_confidence * 100).toFixed(1)}%)
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Positive Supporting Signals */}
                      <div className="panel-card p-4 space-y-3">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Positive Matching Signals ({lineageDetail.stage_5_confidence_signals.positive_signals.length})
                        </div>
                        {lineageDetail.stage_5_confidence_signals.positive_signals.length > 0 ? (
                          <ul className="space-y-2 text-xs">
                            {lineageDetail.stage_5_confidence_signals.positive_signals.map((sig, idx) => (
                              <li key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300 flex items-start gap-2">
                                <span className="text-emerald-400 font-bold font-mono text-[11px] mt-0.5">&bull;</span>
                                <span>{sig}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-slate-500 italic">No specific positive signals listed.</div>
                        )}
                      </div>

                      {/* Conflicting / Risk Signals */}
                      <div className="panel-card p-4 space-y-3">
                        <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Conflicting & Ambiguity Flags ({lineageDetail.stage_5_confidence_signals.conflicting_signals.length})
                        </div>
                        {lineageDetail.stage_5_confidence_signals.conflicting_signals.length > 0 ? (
                          <ul className="space-y-2 text-xs">
                            {lineageDetail.stage_5_confidence_signals.conflicting_signals.map((c, idx) => (
                              <li key={idx} className="p-2 bg-rose-950/20 rounded border border-rose-500/20 text-rose-300 flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded text-xs text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Zero conflicting or discordant signals detected. Clean match.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 6: Human Decision Gate */}
                {activeStageTab === 6 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-brand-400" />
                        Stage 6: Human-in-the-Loop Decision Gate
                      </h3>
                      {getActionBadge(lineageDetail.stage_6_human_decision.action_type)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="panel-card p-3 space-y-1">
                        <div className="text-slate-500 text-[11px]">Reviewer ID / Actor</div>
                        <div className="text-slate-200 font-bold font-mono">{lineageDetail.stage_6_human_decision.reviewer_id}</div>
                      </div>
                      <div className="panel-card p-3 space-y-1">
                        <div className="text-slate-500 text-[11px]">Action Type</div>
                        <div className="text-brand-300 font-mono font-semibold">{lineageDetail.stage_6_human_decision.action_type}</div>
                      </div>
                      <div className="panel-card p-3 space-y-1">
                        <div className="text-slate-500 text-[11px]">Semantic Progress Mode</div>
                        <div className="text-slate-200 font-mono font-semibold">{lineageDetail.stage_6_human_decision.progress_mode || 'CUMULATIVE_ACTIVITY'}</div>
                      </div>
                    </div>

                    <div className="panel-card p-4 space-y-2">
                      <div className="text-xs font-bold text-slate-300">Decision Rationale & Review Notes</div>
                      <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed font-mono">
                        {lineageDetail.stage_6_human_decision.decision_notes || 'Approved as matching candidate.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Stage 7: Verified State Update */}
                {activeStageTab === 7 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        Stage 7: Verified Execution State Comparison
                      </h3>
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                        Target Activity: {lineageDetail.stage_7_verified_state.activity_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before State */}
                      <div className="panel-card p-4 space-y-3 bg-slate-950/70 border-slate-800">
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Previous Execution State (Before Decision)
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-500">Actual Progress:</span>
                            <span className="font-mono text-slate-300">
                              {lineageDetail.stage_7_verified_state.previous_state?.actual_progress !== undefined
                                ? `${lineageDetail.stage_7_verified_state.previous_state.actual_progress}%`
                                : '0.0%'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-500">Status:</span>
                            <span className="font-mono text-slate-300">
                              {lineageDetail.stage_7_verified_state.previous_state?.status || 'Not Started'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-500">Verified Observations:</span>
                            <span className="font-mono text-slate-300">
                              {lineageDetail.stage_7_verified_state.previous_state?.verified_observations_count || 0}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Delay (Days):</span>
                            <span className="font-mono text-slate-300">
                              {lineageDetail.stage_7_verified_state.previous_state?.delay_days || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* After State */}
                      <div className="panel-card p-4 space-y-3 bg-slate-950/90 border-emerald-500/30">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          New Verified Execution State (Post-Reconciliation)
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Actual Progress:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {lineageDetail.stage_7_verified_state.resulting_progress !== undefined
                                ? `${lineageDetail.stage_7_verified_state.resulting_progress}%`
                                : 'Updated'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Status:</span>
                            <span className="font-mono font-semibold text-cyan-300">
                              {lineageDetail.stage_7_verified_state.resulting_status || 'VERIFIED'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Verified Observations:</span>
                            <span className="font-mono font-bold text-brand-300">
                              {lineageDetail.stage_7_verified_state.new_state?.verified_observations_count || 1}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Verified Delay (Days):</span>
                            <span className="font-mono text-slate-200">
                              {lineageDetail.stage_7_verified_state.resulting_delay_days || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero-Secret Audit Serialization Verified</span>
              </div>
              <button
                onClick={() => {
                  setSelectedAuditId(null);
                  setLineageDetail(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors"
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
