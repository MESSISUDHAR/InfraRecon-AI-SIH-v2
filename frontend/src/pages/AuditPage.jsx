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
  Sliders,
  Cpu
} from 'lucide-react';
import { getAuditLogs, getAuditLogDetail, getAuditStats, getProjects } from '../services/api';
import { useActiveEvent } from '../context/EventContext';

export default function AuditPage({ initialProjectId = 'PRJ-REF-04' }) {
  const { activeEventId, setActiveEventId } = useActiveEvent();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectsList, setProjectsList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
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
    if (filterActiveOnly && activeEventId && log.event_id !== activeEventId) {
      return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.activity_id && log.activity_id.toLowerCase().includes(term)) ||
      (log.activity_name && log.activity_name.toLowerCase().includes(term)) ||
      (log.source_id && log.source_id.toLowerCase().includes(term)) ||
      (log.performed_by && log.performed_by.toLowerCase().includes(term)) ||
      (log.decision_reason && log.decision_reason.toLowerCase().includes(term)) ||
      (log.id && log.id.toLowerCase().includes(term)) ||
      (log.event_id && log.event_id.toLowerCase().includes(term))
    );
  });

  const getActionBadge = (action) => {
    switch (action) {
      case 'AUTO_MATCH':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AUTO_MATCH
          </span>
        );
      case 'PLANNER_APPROVAL':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> PLANNER_APPROVAL
          </span>
        );
      case 'PLANNER_OVERRIDE':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1">
            <Sliders className="w-3 h-3" /> PLANNER_OVERRIDE
          </span>
        );
      case 'REJECTION':
        return (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> REJECTION
          </span>
        );
      default:
        return (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A]">
            {action}
          </span>
        );
    }
  };

  const getBorderColor = (action) => {
    switch (action) {
      case 'AUTO_MATCH': return 'border-l-[#10B981]';
      case 'PLANNER_APPROVAL': return 'border-l-[#D4AF37]';
      case 'PLANNER_OVERRIDE': return 'border-l-[#F59E0B]';
      case 'REJECTION': return 'border-l-[#EF4444]';
      default: return 'border-l-[#2A2A2A]';
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
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#111111] border border-[#D4AF37]/30 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#EAEAEA] tracking-tight">
                  Evidence & Audit Trail
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full font-mono">
                  7-STAGE LINEAGE
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Complete, immutable lineage tracing every reconciliation decision from raw field report to verified execution state.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAuditData}
            disabled={loading}
            className="px-3.5 py-2 bg-[#111111] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37]/40 text-xs font-bold text-[#EAEAEA] rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit Logs</span>
          </button>
        </div>
      </div>

      {/* Security & Integrity Banner */}
      <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl text-[#10B981]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#EAEAEA] flex items-center gap-2">
              <span>Zero-Leak Security & Explainability Standard</span>
              <span className="text-[10px] px-2 py-0.2 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded font-mono font-bold">COMPLIANT</span>
            </div>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              API credentials, private key tokens, and internal headers are strictly omitted from audit payloads while retaining full prompt and model lineage.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#0A0A0A] px-3 py-1.5 rounded-xl border border-[#2A2A2A] text-xs">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="text-[#A3A3A3] font-mono">Project:</span>
          {projectsList.length > 0 ? (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-0.5 text-[#EAEAEA] font-mono font-bold text-xs focus:outline-none focus:border-[#D4AF37]"
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code || p.id} - {p.name}
                </option>
              ))}
            </select>
          ) : (
            <strong className="text-[#D4AF37] font-mono">{projectId}</strong>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="panel-card p-4 space-y-1">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">Total Audit Entries</div>
            <div className="text-2xl font-black text-[#EAEAEA] tracking-tight font-mono">{stats.total_audit_records}</div>
            <div className="text-[10px] text-[#A3A3A3] flex items-center gap-1">
              <Database className="w-3 h-3 text-[#D4AF37]" /> Immutable ledger entries
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-[#10B981]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">Auto-Processed</div>
            <div className="text-2xl font-black text-[#10B981] tracking-tight font-mono">{stats.auto_matches_count}</div>
            <div className="text-[10px] text-[#10B981] flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> High confidence policy (≥85%)
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-[#D4AF37]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">Planner Approvals</div>
            <div className="text-2xl font-black text-[#D4AF37] tracking-tight font-mono">{stats.planner_approvals_count}</div>
            <div className="text-[10px] text-[#D4AF37] flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Human validated matches
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-[#F59E0B]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">Planner Overrides</div>
            <div className="text-2xl font-black text-[#F59E0B] tracking-tight font-mono">{stats.planner_overrides_count}</div>
            <div className="text-[10px] text-[#F59E0B] flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Alternative candidate chosen
            </div>
          </div>

          <div className="panel-card p-4 space-y-1 border-t-2 border-t-[#EF4444]">
            <div className="text-xs text-[#A3A3A3] font-bold uppercase tracking-wider">Rejections</div>
            <div className="text-2xl font-black text-[#EF4444] tracking-tight font-mono">{stats.rejections_count}</div>
            <div className="text-[10px] text-[#EF4444] flex items-center gap-1">
              <XCircle className="w-3 h-3" /> State preserved untouched
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="panel-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Activity ID, Name, Source ID, Reviewer, Event ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-xs text-[#EAEAEA] placeholder-[#555555] focus:outline-none focus:border-[#D4AF37] transition-colors font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {activeEventId && (
            <button
              onClick={() => setFilterActiveOnly(!filterActiveOnly)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                filterActiveOnly 
                  ? 'bg-[#D4AF37] text-[#0A0A0A] border-[#D4AF37]' 
                  : 'bg-[#0A0A0A] text-[#A3A3A3] border-[#2A2A2A] hover:text-[#D4AF37]'
              }`}
            >
              <span>Active Event ({activeEventId})</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-[#A3A3A3]">
            <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Decision Action:</span>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-xs text-[#EAEAEA] px-3 py-2 focus:outline-none focus:border-[#D4AF37] font-medium"
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
        <div className="p-12 text-center text-[#A3A3A3] space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <div className="text-sm font-bold text-[#EAEAEA]">Loading Immutable Audit Stream...</div>
          <div className="text-xs text-[#A3A3A3]">Retrieving full 7-stage lineage records from backend</div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="panel-card p-12 text-center text-[#A3A3A3] space-y-2">
          <Database className="w-10 h-10 text-[#555555] mx-auto" />
          <div className="text-sm font-bold text-[#EAEAEA]">No Audit Records Found</div>
          <p className="text-xs text-[#A3A3A3] max-w-md mx-auto">
            {filterActiveOnly ? `No audit records for active event ${activeEventId}. Run reconciliation or planner review first.` : 'No audit records match the current filter criteria. Reconcile or review field events to populate the audit ledger.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isTargetEvent = activeEventId && log.event_id === activeEventId;
            return (
              <div 
                key={log.id} 
                className={`panel-card p-5 space-y-3 border-l-4 ${getBorderColor(log.action_type)} ${isTargetEvent ? 'ring-1 ring-[#D4AF37]/60 shadow-[0_0_15px_rgba(212,175,55,0.1)]' : ''} transition-all hover:border-[#D4AF37]/50`}
              >
                {/* Row Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#2A2A2A] pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {getActionBadge(log.action_type)}
                    {isTargetEvent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[#D4AF37] text-[#0A0A0A] rounded uppercase">
                        Active Event
                      </span>
                    )}
                    {log.activity_id && (
                      <span className="text-xs font-mono text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-md border border-[#D4AF37]/20">
                        {log.activity_id}
                      </span>
                    )}
                    {log.activity_name && (
                      <span className="text-xs text-[#EAEAEA] font-bold">
                        {log.activity_name}
                      </span>
                    )}
                    <span className="text-xs text-[#555555]">•</span>
                    <span className="text-xs text-[#A3A3A3] font-mono">
                      Event: <strong className="text-[#EAEAEA]">{log.event_id}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs text-[#A3A3A3] font-mono flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#D4AF37]" />
                      {formatTimestamp(log.timestamp)}
                    </div>
                    <button
                      onClick={() => handleInspectLineage(log.id)}
                      className="px-3 py-1 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <span>Inspect Lineage</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Row Body - Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  {/* Source & Evidence */}
                  <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                    <div className="text-[10px] text-[#A3A3A3] uppercase font-bold flex items-center gap-1">
                      <FileText className="w-3 h-3 text-[#D4AF37]" /> Source Evidence
                    </div>
                    <div className="text-[#EAEAEA] font-mono text-[11px] truncate font-medium">
                      {log.source_id ? `${log.source_id} (${log.source_type || 'Field'})` : 'Field Report'}
                    </div>
                    <p className="text-[#A3A3A3] italic text-[11px] line-clamp-1 font-sans">
                      "{log.raw_evidence_snippet || 'No raw snippet'}"
                    </p>
                  </div>

                  {/* AI Model & Extraction */}
                  <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                    <div className="text-[10px] text-[#A3A3A3] uppercase font-bold flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-[#3B82F6]" /> Extraction Engine
                    </div>
                    <div className="text-[#EAEAEA] font-mono text-[11px] flex items-center gap-1.5">
                      <span className="font-bold text-[#3B82F6]">{log.model_version || 'Gemini 2.5 Flash'}</span>
                      <span className="text-[10px] text-[#A3A3A3]">({log.prompt_version || 'v1.0'})</span>
                    </div>
                    <p className="text-[#A3A3A3] text-[11px] truncate">
                      Embedding: <span className="font-mono text-[#EAEAEA]">all-MiniLM-L6-v2</span>
                    </p>
                  </div>

                  {/* Confidence & Decision */}
                  <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                    <div className="text-[10px] text-[#A3A3A3] uppercase font-bold flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#10B981]" /> Confidence & Reviewer
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[11px] text-[#10B981]">
                        {log.confidence !== null ? `${(log.confidence * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                      <span className="text-[10px] text-[#A3A3A3] font-mono">
                        By: <strong className="text-[#EAEAEA]">{log.performed_by || 'SYSTEM'}</strong>
                      </span>
                    </div>
                    <p className="text-[#A3A3A3] text-[11px] truncate">
                      Action: <span className="font-mono text-[#EAEAEA]">{log.action_type}</span>
                    </p>
                  </div>

                  {/* State Transition */}
                  <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                    <div className="text-[10px] text-[#A3A3A3] uppercase font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#A855F7]" /> State Transition
                    </div>
                    <div className="text-[#EAEAEA] font-mono text-[11px]">
                      Progress: <span className="text-[#A3A3A3]">{log.previous_state?.actual_progress !== undefined ? `${log.previous_state.actual_progress}%` : '0%'}</span>
                      {' '}→{' '}
                      <span className="text-[#10B981] font-bold">{log.new_state?.actual_progress !== undefined ? `${log.new_state.actual_progress}%` : 'Updated'}</span>
                    </div>
                    <p className="text-[#A3A3A3] text-[11px] truncate">
                      Status: <span className="font-medium text-[#EAEAEA]">{log.new_state?.status || 'VERIFIED'}</span>
                    </p>
                  </div>
                </div>

                {/* Rationale Footer */}
                <div className="text-xs text-[#A3A3A3] bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] flex items-start gap-2.5">
                  <Info className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#D4AF37] font-semibold">Reconciliation Rationale: </strong>
                    <span>{log.decision_reason || 'Reconciliation match recorded.'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7-STAGE DEEP AUDIT LINEAGE INSPECTION MODAL */}
      {selectedAuditId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2A2A2A] flex items-center justify-between bg-[#111111]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl text-[#D4AF37]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#EAEAEA] tracking-tight">
                      End-to-End Decision Lineage Inspector
                    </h2>
                    {lineageDetail && getActionBadge(lineageDetail.action_type)}
                  </div>
                  <p className="text-xs text-[#A3A3A3] mt-0.5 font-mono">
                    Audit Log ID: {selectedAuditId} • Project: {lineageDetail?.project_id || 'PRJ-REF-04'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedAuditId(null);
                  setLineageDetail(null);
                }}
                className="p-2 hover:bg-[#1A1A1A] text-[#A3A3A3] hover:text-[#EAEAEA] rounded-xl transition-colors border border-transparent hover:border-[#2A2A2A]"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            {detailLoading || !lineageDetail ? (
              <div className="p-16 text-center text-[#A3A3A3] space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
                <div className="text-sm font-bold text-[#EAEAEA]">Assembling 7-Stage Lineage Graph...</div>
                <div className="text-xs text-[#A3A3A3]">Querying field evidence, Gemini extractions, embeddings, signals, and state deltas</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 7-Stage Progress Stepper Bar */}
                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="grid grid-cols-7 gap-1.5 text-center">
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
                          className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                            isActive 
                              ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-[0_0_12px_rgba(212,175,55,0.3)]' 
                              : 'text-[#A3A3A3] hover:text-[#EAEAEA] hover:bg-[#111111] border border-transparent'
                          }`}
                        >
                          <StepIcon className="w-4 h-4 shrink-0" />
                          <span className="text-[10px] truncate w-full">{step.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stage 1: Field Evidence */}
                {activeStageTab === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D4AF37]" />
                        Stage 1: Raw Field Evidence Ingestion
                      </h3>
                      <span className="text-xs text-[#A3A3A3] font-mono">Source ID: {lineageDetail.stage_1_field_evidence.source_id || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="panel-card p-3.5 space-y-1">
                        <div className="text-[#A3A3A3] text-[10px] uppercase font-bold">Source Type</div>
                        <div className="text-[#EAEAEA] font-semibold">{lineageDetail.stage_1_field_evidence.source_type || 'DPR'}</div>
                      </div>
                      <div className="panel-card p-3.5 space-y-1">
                        <div className="text-[#A3A3A3] text-[10px] uppercase font-bold">Report Date</div>
                        <div className="text-[#EAEAEA] font-mono">{lineageDetail.stage_1_field_evidence.report_date || 'N/A'}</div>
                      </div>
                      <div className="panel-card p-3.5 space-y-1">
                        <div className="text-[#A3A3A3] text-[10px] uppercase font-bold">Reporter / Field Supervisor</div>
                        <div className="text-[#EAEAEA] font-semibold">{lineageDetail.stage_1_field_evidence.reporter_name || 'Field Lead'}</div>
                      </div>
                    </div>

                    <div className="panel-card p-4 space-y-2">
                      <div className="text-xs font-bold text-[#EAEAEA] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Verbatim Field Report Text
                      </div>
                      <div className="p-3.5 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-xs text-[#EAEAEA] font-sans italic whitespace-pre-wrap leading-relaxed">
                        "{lineageDetail.stage_1_field_evidence.raw_text || 'No raw text recorded.'}"
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 2: AI Extraction (Gemini 2.5 Flash) */}
                {activeStageTab === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-[#3B82F6]" />
                        Stage 2: Deterministic AI Fact Extraction
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-0.5 bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 rounded font-mono font-bold">
                          {lineageDetail.stage_2_ai_extraction.model_version}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-[#0A0A0A] text-[#A3A3A3] border border-[#2A2A2A] rounded font-mono">
                          {lineageDetail.stage_2_ai_extraction.prompt_version}
                        </span>
                      </div>
                    </div>

                    {lineageDetail.stage_2_ai_extraction.grounding_direct_quote && (
                      <div className="p-3 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-xl text-xs space-y-1">
                        <div className="text-[10px] text-[#3B82F6] uppercase font-bold">Grounding Verbatim Quote</div>
                        <p className="text-[#3B82F6] italic font-mono">
                          "{lineageDetail.stage_2_ai_extraction.grounding_direct_quote}"
                        </p>
                      </div>
                    )}

                    <div className="panel-card p-4 space-y-3">
                      <div className="text-xs font-bold text-[#EAEAEA]">Extracted Structural Entities</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Activity Description</div>
                          <div className="text-[#EAEAEA] font-medium truncate">{lineageDetail.stage_2_ai_extraction.extracted_entities?.activity_description || 'N/A'}</div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Discipline</div>
                          <div className="text-[#EAEAEA] font-semibold">{lineageDetail.stage_2_ai_extraction.extracted_entities?.discipline || 'N/A'}</div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Location</div>
                          <div className="text-[#EAEAEA] font-medium">{lineageDetail.stage_2_ai_extraction.extracted_entities?.location || 'N/A'}</div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Asset / Line ID</div>
                          <div className="text-[#D4AF37] font-mono font-bold">
                            {lineageDetail.stage_2_ai_extraction.extracted_entities?.asset_id || lineageDetail.stage_2_ai_extraction.extracted_entities?.line_id || 'N/A'}
                          </div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Event Type</div>
                          <div className="text-[#EAEAEA] font-semibold">{lineageDetail.stage_2_ai_extraction.extracted_entities?.event_type || 'progress'}</div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Reported Progress</div>
                          <div className="text-[#10B981] font-bold font-mono">
                            {lineageDetail.stage_2_ai_extraction.extracted_entities?.progress !== undefined && lineageDetail.stage_2_ai_extraction.extracted_entities?.progress !== null
                              ? `${lineageDetail.stage_2_ai_extraction.extracted_entities.progress}%`
                              : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Extraction Confidence</div>
                          <div className="text-[#D4AF37] font-mono font-bold">
                            {lineageDetail.stage_2_ai_extraction.extraction_confidence
                              ? `${(lineageDetail.stage_2_ai_extraction.extraction_confidence * 100).toFixed(1)}%`
                              : 'High'}
                          </div>
                        </div>
                        <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-0.5">
                          <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Temporal Validity</div>
                          <div className="text-[#10B981] font-mono text-[11px] font-bold">Validated</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 3: Candidate Retrieval */}
                {activeStageTab === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <Database className="w-4 h-4 text-[#A855F7]" />
                        Stage 3: Vector Similarity Candidate Generation
                      </h3>
                      <div className="text-xs text-[#A855F7] bg-[#A855F7]/15 px-2.5 py-0.5 rounded border border-[#A855F7]/30 font-mono font-bold">
                        Model: {lineageDetail.stage_3_candidate_retrieval.embedding_model} (384-dim)
                      </div>
                    </div>

                    <div className="panel-card overflow-hidden">
                      <div className="p-3.5 bg-[#0A0A0A] border-b border-[#2A2A2A] text-xs font-bold text-[#EAEAEA]">
                        Retrieved Candidate Pool ({lineageDetail.stage_3_candidate_retrieval.retrieved_candidates.length} candidates)
                      </div>
                      <div className="divide-y divide-[#2A2A2A] text-xs">
                        {lineageDetail.stage_3_candidate_retrieval.retrieved_candidates.map((cand, idx) => (
                          <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-[#1A1A1A] transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[#D4AF37] font-bold">{cand.activity_id}</span>
                                <span className="text-[#EAEAEA] font-medium">{cand.activity_name}</span>
                                {cand.discipline && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#0A0A0A] text-[#A3A3A3] border border-[#2A2A2A] rounded">
                                    {cand.discipline}
                                  </span>
                                )}
                              </div>
                              {cand.location && (
                                <div className="text-[11px] text-[#A3A3A3] font-mono">Location: {cand.location}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-[#A855F7]">
                                {(cand.semantic_similarity * 100).toFixed(1)}%
                              </div>
                              <div className="text-[10px] text-[#A3A3A3]">Semantic Cosine</div>
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
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-[#F59E0B]" />
                        Stage 4: Multi-Signal Contextual Reconciliation Matrix
                      </h3>
                      <span className="text-xs text-[#A3A3A3] font-mono">Selected: <strong className="text-[#D4AF37]">{lineageDetail.stage_4_context_reconciliation.selected_activity_id}</strong></span>
                    </div>

                    {lineageDetail.stage_4_context_reconciliation.candidate_signals && (
                      <div className="panel-card p-4 space-y-4">
                        <div className="text-xs font-bold text-[#EAEAEA]">6-Signal Weighted Contribution Breakdown</div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                          <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                            <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Semantic (40%)</div>
                            <div className="text-base font-mono font-bold text-[#D4AF37]">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.semantic_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                            <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Asset/Line ID (20%)</div>
                            <div className="text-base font-mono font-bold text-[#10B981]">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.identifier_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                            <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Discipline (15%)</div>
                            <div className="text-base font-mono font-bold text-[#3B82F6]">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.discipline_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                            <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Location (10%)</div>
                            <div className="text-base font-mono font-bold text-[#F59E0B]">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.location_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                            <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">WBS Context (10%)</div>
                            <div className="text-base font-mono font-bold text-[#A855F7]">
                              {(lineageDetail.stage_4_context_reconciliation.candidate_signals.wbs_score * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] space-y-1">
                            <div className="text-[10px] text-[#A3A3A3] uppercase font-bold">Temporal (5%)</div>
                            <div className="text-base font-mono font-bold text-[#EC4899]">
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
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#10B981]" />
                        Stage 5: Confidence Calculation & Signal Diagnostics
                      </h3>
                      <div className="text-xs font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-2.5 py-0.5 rounded border border-[#10B981]/30">
                        {lineageDetail.stage_5_confidence_signals.confidence_tier} CONFIDENCE ({(lineageDetail.stage_5_confidence_signals.final_confidence * 100).toFixed(1)}%)
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Positive Supporting Signals */}
                      <div className="panel-card p-4 space-y-3">
                        <div className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Positive Matching Signals ({lineageDetail.stage_5_confidence_signals.positive_signals.length})
                        </div>
                        {lineageDetail.stage_5_confidence_signals.positive_signals.length > 0 ? (
                          <ul className="space-y-2 text-xs">
                            {lineageDetail.stage_5_confidence_signals.positive_signals.map((sig, idx) => (
                              <li key={idx} className="p-2.5 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-[#EAEAEA] flex items-start gap-2">
                                <span className="text-[#10B981] font-bold font-mono text-[11px] mt-0.5">•</span>
                                <span>{sig}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-[#A3A3A3] italic">No specific positive signals listed.</div>
                        )}
                      </div>

                      {/* Conflicting / Risk Signals */}
                      <div className="panel-card p-4 space-y-3">
                        <div className="text-xs font-bold text-[#EF4444] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Conflicting & Ambiguity Flags ({lineageDetail.stage_5_confidence_signals.conflicting_signals.length})
                        </div>
                        {lineageDetail.stage_5_confidence_signals.conflicting_signals.length > 0 ? (
                          <ul className="space-y-2 text-xs">
                            {lineageDetail.stage_5_confidence_signals.conflicting_signals.map((c, idx) => (
                              <li key={idx} className="p-2.5 bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/30 text-[#EF4444] flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="p-3.5 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl text-xs text-[#10B981] flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
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
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#D4AF37]" />
                        Stage 6: Human-in-the-Loop Decision Gate
                      </h3>
                      {getActionBadge(lineageDetail.stage_6_human_decision.action_type)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="panel-card p-3.5 space-y-1">
                        <div className="text-[#A3A3A3] text-[10px] uppercase font-bold">Reviewer ID / Actor</div>
                        <div className="text-[#EAEAEA] font-bold font-mono">{lineageDetail.stage_6_human_decision.reviewer_id}</div>
                      </div>
                      <div className="panel-card p-3.5 space-y-1">
                        <div className="text-[#A3A3A3] text-[10px] uppercase font-bold">Action Type</div>
                        <div className="text-[#D4AF37] font-mono font-bold">{lineageDetail.stage_6_human_decision.action_type}</div>
                      </div>
                      <div className="panel-card p-3.5 space-y-1">
                        <div className="text-[#A3A3A3] text-[10px] uppercase font-bold">Semantic Progress Mode</div>
                        <div className="text-[#EAEAEA] font-mono font-semibold">{lineageDetail.stage_6_human_decision.progress_mode || 'CUMULATIVE_ACTIVITY'}</div>
                      </div>
                    </div>

                    <div className="panel-card p-4 space-y-2">
                      <div className="text-xs font-bold text-[#EAEAEA]">Decision Rationale & Review Notes</div>
                      <p className="text-xs text-[#EAEAEA] bg-[#0A0A0A] p-3.5 rounded-xl border border-[#2A2A2A] leading-relaxed font-sans">
                        {lineageDetail.stage_6_human_decision.decision_notes || 'Approved as matching candidate.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Stage 7: Verified State Update */}
                {activeStageTab === 7 && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#EAEAEA] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                        Stage 7: Verified Execution State Comparison
                      </h3>
                      <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/15 px-2.5 py-0.5 rounded border border-[#10B981]/30 font-bold">
                        Target Activity: {lineageDetail.stage_7_verified_state.activity_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before State */}
                      <div className="panel-card p-4 space-y-3 bg-[#0A0A0A]">
                        <div className="text-xs font-bold text-[#A3A3A3] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Previous Execution State (Before Decision)
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                            <span className="text-[#A3A3A3]">Actual Progress:</span>
                            <span className="font-mono text-[#EAEAEA]">
                              {lineageDetail.stage_7_verified_state.previous_state?.actual_progress !== undefined
                                ? `${lineageDetail.stage_7_verified_state.previous_state.actual_progress}%`
                                : '0.0%'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                            <span className="text-[#A3A3A3]">Status:</span>
                            <span className="font-mono text-[#EAEAEA]">
                              {lineageDetail.stage_7_verified_state.previous_state?.status || 'Not Started'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                            <span className="text-[#A3A3A3]">Verified Observations:</span>
                            <span className="font-mono text-[#EAEAEA]">
                              {lineageDetail.stage_7_verified_state.previous_state?.verified_observations_count || 0}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[#A3A3A3]">Delay (Days):</span>
                            <span className="font-mono text-[#EAEAEA]">
                              {lineageDetail.stage_7_verified_state.previous_state?.delay_days || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* After State */}
                      <div className="panel-card p-4 space-y-3 bg-[#0A0A0A] border-[#10B981]/40">
                        <div className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          New Verified Execution State (Post-Reconciliation)
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                            <span className="text-[#A3A3A3]">Actual Progress:</span>
                            <span className="font-mono font-bold text-[#10B981]">
                              {lineageDetail.stage_7_verified_state.resulting_progress !== undefined
                                ? `${lineageDetail.stage_7_verified_state.resulting_progress}%`
                                : 'Updated'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                            <span className="text-[#A3A3A3]">Status:</span>
                            <span className="font-mono font-semibold text-[#D4AF37]">
                              {lineageDetail.stage_7_verified_state.resulting_status || 'VERIFIED'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                            <span className="text-[#A3A3A3]">Verified Observations:</span>
                            <span className="font-mono font-bold text-[#D4AF37]">
                              {lineageDetail.stage_7_verified_state.new_state?.verified_observations_count || 1}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[#A3A3A3]">Verified Delay (Days):</span>
                            <span className="font-mono text-[#EAEAEA]">
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
            <div className="p-4 bg-[#111111] border-t border-[#2A2A2A] flex items-center justify-between text-xs text-[#A3A3A3]">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Zero-Secret Audit Serialization Verified</span>
              </div>
              <button
                onClick={() => {
                  setSelectedAuditId(null);
                  setLineageDetail(null);
                }}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#EAEAEA] font-bold rounded-xl transition-colors border border-[#2A2A2A]"
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
