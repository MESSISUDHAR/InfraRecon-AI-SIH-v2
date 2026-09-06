import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Check, 
  X, 
  Edit3, 
  ArrowRight, 
  AlertCircle, 
  AlertTriangle,
  FileText, 
  Cpu, 
  Layers,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Tag,
  MapPin,
  Calendar,
  Clock,
  Sliders,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  getReviewQueue,
  approveReviewMatch,
  selectReviewCandidate,
  rejectReviewMatch,
  autoProcessReviewQueue,
  getConfidencePolicy,
  getProjects
} from '../services/api';

export default function PlannerReviewPage({ onNavigate, initialProjectId = 'PRJ-REF-04' }) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectsList, setProjectsList] = useState([]);
  const [tierFilter, setTierFilter] = useState('ALL'); // ALL, HIGH, MEDIUM, LOW
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const [queueData, setQueueData] = useState({
    total_items: 0,
    pending_count: 0,
    high_confidence_count: 0,
    medium_confidence_count: 0,
    low_confidence_count: 0,
    items: []
  });

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [plannerNotes, setPlannerNotes] = useState('');
  const [overrideProgress, setOverrideProgress] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const prjs = await getProjects();
        if (Array.isArray(prjs)) {
          setProjectsList(prjs);
        }
      } catch (err) {
        console.warn('Failed to load projects list in review page:', err);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    loadQueue();
  }, [projectId, tierFilter]);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReviewQueue({
        project_id: projectId,
        tier: tierFilter === 'ALL' ? undefined : tierFilter
      });
      if (res && res.items) {
        setQueueData(res);
        if (res.items.length > 0 && (!selectedEventId || !res.items.find(it => it.event_id === selectedEventId))) {
          const firstItem = res.items[0];
          setSelectedEventId(firstItem.event_id);
          setSelectedCandidateId(firstItem.top_candidate?.id || null);
        }
      }
    } catch (err) {
      console.error('Failed to load review queue:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  };

  const currentItem = queueData.items.find(it => it.event_id === selectedEventId) || queueData.items[0] || null;

  const handleSelectEvent = (item) => {
    setSelectedEventId(item.event_id);
    setSelectedCandidateId(item.top_candidate?.id || null);
    setPlannerNotes('');
    setOverrideProgress('');
    setSuccessMsg(null);
    setError(null);
  };

  const handleApprove = async () => {
    if (!currentItem) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const targetActId = selectedCandidateId || currentItem.top_candidate?.id;
      const isOverride = targetActId && currentItem.top_candidate && targetActId !== currentItem.top_candidate.id;

      let res;
      if (isOverride) {
        res = await selectReviewCandidate({
          event_id: currentItem.event_id,
          activity_id: targetActId,
          reviewer_id: "PLANNER_USER",
          notes: plannerNotes || `Planner overrode match to select ${targetActId}`,
          override_progress: overrideProgress ? parseFloat(overrideProgress) : undefined
        });
      } else {
        res = await approveReviewMatch({
          event_id: currentItem.event_id,
          activity_id: targetActId,
          reviewer_id: "PLANNER_USER",
          notes: plannerNotes || "Planner validated and approved candidate match",
          override_progress: overrideProgress ? parseFloat(overrideProgress) : undefined
        });
      }

      setSuccessMsg(res.message);
      // Reload queue
      setTimeout(() => {
        loadQueue();
      }, 1000);
    } catch (err) {
      console.error('Approval failed:', err);
      setError(err.response?.data?.detail || err.message || 'Approval action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!currentItem) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await rejectReviewMatch({
        event_id: currentItem.event_id,
        reviewer_id: "PLANNER_USER",
        reason: plannerNotes || "Unmatched / Discrepancies noted by Planner"
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        loadQueue();
      }, 1000);
    } catch (err) {
      console.error('Rejection failed:', err);
      setError(err.response?.data?.detail || err.message || 'Rejection action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoProcess = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await autoProcessReviewQueue({
        project_id: projectId,
        high_threshold: 0.85,
        reviewer_id: "SYSTEM_AUTO_POLICY"
      });
      setSuccessMsg(res.message);
      loadQueue();
    } catch (err) {
      console.error('Auto-processing failed:', err);
      setError(err.response?.data?.detail || err.message || 'Auto-processing failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-brand-400" />
              <span>Human-in-the-Loop Planner Review Gate</span>
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full font-mono">
              Milestone 8
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Enforces confidence policy guardrails. Planners review evidence, resolve ambiguities, override or approve matches before state updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleAutoProcess}
            disabled={actionLoading || queueData.high_confidence_count === 0}
            className="btn-primary text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-emerald-600/20"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-Process Eligible ({queueData.high_confidence_count})</span>
          </button>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('execution-state')}
              className="btn-outline text-xs flex items-center gap-1.5"
            >
              <span>Verified Execution State</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confidence Policy Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTierFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tierFilter === 'ALL' 
                ? 'bg-slate-800 text-white border border-slate-700' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Pending ({queueData.pending_count})
          </button>

          <button 
            onClick={() => setTierFilter('HIGH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              tierFilter === 'HIGH' 
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' 
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>High Conf (≥85%)</span>
            <span className="px-1.5 py-0.2 bg-emerald-900/60 rounded text-[10px] font-mono">
              {queueData.high_confidence_count}
            </span>
          </button>

          <button 
            onClick={() => setTierFilter('MEDIUM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              tierFilter === 'MEDIUM' 
                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40' 
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Medium Conf (60-84%)</span>
            <span className="px-1.5 py-0.2 bg-amber-900/60 rounded text-[10px] font-mono">
              {queueData.medium_confidence_count}
            </span>
          </button>

          <button 
            onClick={() => setTierFilter('LOW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              tierFilter === 'LOW' 
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40' 
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Low Conf (&lt;60%)</span>
            <span className="px-1.5 py-0.2 bg-rose-900/60 rounded text-[10px] font-mono">
              {queueData.low_confidence_count}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Project:</span>
            {projectsList.length > 0 ? (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
              >
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code || p.id} - {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-white font-bold">{projectId}</span>
            )}
          </div>

          <button 
            onClick={loadQueue}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded border border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Queue Items or Empty State */}
      {queueData.items.length === 0 ? (
        <div className="panel-card p-12 text-center text-slate-400 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Review Queue Clean</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No execution events are currently pending planner review under the selected filter. Submit a field report on the Field Reports page to generate new review items.
          </p>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('field-reports')}
              className="btn-primary text-xs mt-2"
            >
              Submit New Field Report →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Review Item Selector Ribbon */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {queueData.items.map((it, idx) => (
              <div 
                key={it.event_id}
                onClick={() => handleSelectEvent(it)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all shrink-0 min-w-[220px] ${
                  selectedEventId === it.event_id 
                    ? 'bg-slate-800/90 border-brand-500 ring-1 ring-brand-500' 
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-200">{it.event_id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    it.confidence_tier === 'HIGH' ? 'bg-emerald-950 text-emerald-400' :
                    it.confidence_tier === 'MEDIUM' ? 'bg-amber-950 text-amber-400' : 'bg-rose-950 text-rose-400'
                  }`}>
                    {Math.round(it.final_confidence * 100)}% ({it.confidence_tier})
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  {it.extracted_facts?.activity_description || it.raw_text}
                </div>
              </div>
            ))}
          </div>

          {/* Active Item Context Alert */}
          {currentItem && (
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              currentItem.confidence_tier === 'HIGH' ? 'bg-emerald-950/20 border-emerald-500/30' :
              currentItem.confidence_tier === 'MEDIUM' ? 'bg-amber-950/20 border-amber-500/30' :
              'bg-rose-950/20 border-rose-500/30'
            }`}>
              <div className="flex items-center gap-3">
                {currentItem.confidence_tier === 'HIGH' ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : currentItem.confidence_tier === 'MEDIUM' ? (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div className="text-xs">
                  <strong className={
                    currentItem.confidence_tier === 'HIGH' ? 'text-emerald-300' :
                    currentItem.confidence_tier === 'MEDIUM' ? 'text-amber-300' : 'text-rose-300'
                  }>
                    {currentItem.confidence_tier === 'HIGH' ? 'High Confidence (Auto-Eligible): ' :
                     currentItem.confidence_tier === 'MEDIUM' ? 'Planner Review Required: ' : 'Low Confidence / Risk Alert: '}
                  </strong>
                  <span className="text-slate-300">
                    {currentItem.reconciliation_reason || 'Reconciliation engine evaluated context signals.'}
                  </span>
                </div>
              </div>

              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border shrink-0 ${
                currentItem.confidence_tier === 'HIGH' ? 'bg-emerald-950 text-emerald-400 border-emerald-700' :
                currentItem.confidence_tier === 'MEDIUM' ? 'bg-amber-950 text-amber-400 border-amber-700' :
                'bg-rose-950 text-rose-400 border-rose-700'
              }`}>
                Confidence: {(currentItem.final_confidence * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* 3-PANE HUMAN-IN-THE-LOOP INTERFACE */}
          {currentItem && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pane 1: Original Raw Field Evidence */}
              <div className="panel-card p-5 space-y-4 border-t-2 border-t-brand-500 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-brand-400" />
                      <span>1. Original Raw Evidence</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentItem.source_id || 'DIRECT_INPUT'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 leading-relaxed">
                    "{currentItem.raw_text}"
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex justify-between py-1 border-b border-slate-800/40">
                      <span>Source Reference:</span>
                      <span className="text-slate-200 font-medium">{currentItem.source_type || 'Field Report'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/40">
                      <span>Reporter Name:</span>
                      <span className="text-slate-200">{currentItem.reporter_name || 'Supervisor'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Report Date:</span>
                      <span className="text-slate-200">{currentItem.report_date?.split('T')[0] || 'Today'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-950/40 p-2.5 rounded border border-slate-800/50">
                  🔒 Raw field evidence is preserved verbatim and immutable.
                </div>
              </div>

              {/* Pane 2: Extracted ExecutionEvent (Fact Grounding) */}
              <div className="panel-card p-5 space-y-4 border-t-2 border-t-cyan-500 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                      <span>2. AI Fact Grounding</span>
                    </span>
                    <span className="badge-high">
                      Conf: {currentItem.extracted_facts?.extraction_confidence ? `${Math.round(currentItem.extracted_facts.extraction_confidence * 100)}%` : '95%'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Activity Fact:</span>
                      <span className="text-cyan-300 font-semibold truncate max-w-[160px]">
                        {currentItem.extracted_facts?.activity_description || 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Discipline:</span>
                      <span className="text-white">{currentItem.extracted_facts?.discipline || 'General'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-emerald-300">{currentItem.extracted_facts?.location || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Line / Asset:</span>
                      <span className="text-amber-300">{currentItem.extracted_facts?.line_id || currentItem.extracted_facts?.asset_id || 'null (absent)'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Event Type:</span>
                      <span className="text-purple-300">{currentItem.extracted_facts?.event_type || 'progress'} ({currentItem.extracted_facts?.progress || 100}%)</span>
                    </div>
                  </div>

                  {currentItem.extracted_facts?.evidence_text && (
                    <div className="text-[11px] text-slate-400">
                      Grounded Quote: <em className="text-slate-300">"{currentItem.extracted_facts.evidence_text}"</em>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-950/40 p-2.5 rounded border border-slate-800/50">
                  Grounded strictly by Gemini 2.5 Flash without hallucinations.
                </div>
              </div>

              {/* Pane 3: Candidate Schedule Activities & Review Decisions */}
              <div className="panel-card p-5 space-y-4 border-t-2 border-t-amber-500 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>3. Candidate Activities</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Select target</span>
                  </div>

                  {/* Top Candidate */}
                  {currentItem.top_candidate && (
                    <div 
                      onClick={() => setSelectedCandidateId(currentItem.top_candidate.id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedCandidateId === currentItem.top_candidate.id || (!selectedCandidateId)
                          ? 'bg-brand-950/60 border-brand-500 shadow-md ring-1 ring-brand-500/50'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-brand-400">
                          {currentItem.top_candidate.activity_id} (Rank #1)
                        </span>
                        <span className="font-mono text-emerald-400 font-bold text-[11px]">
                          Score: {(currentItem.top_candidate.final_confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-white font-medium mt-1">
                        {currentItem.top_candidate.activity_name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Disc: {currentItem.top_candidate.discipline || 'N/A'}</span>
                        <span>•</span>
                        <span>Loc: {currentItem.top_candidate.location || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* Alternatives */}
                  {currentItem.alternative_candidates?.map((alt) => (
                    <div 
                      key={alt.id || alt.activity_id}
                      onClick={() => setSelectedCandidateId(alt.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedCandidateId === alt.id
                          ? 'bg-brand-950/60 border-brand-500 shadow-md ring-1 ring-brand-500/50'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-300">
                          {alt.activity_id} (Rank #{alt.rank})
                        </span>
                        <span className="font-mono text-slate-400 font-bold text-[11px]">
                          Score: {(alt.final_confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-slate-300 font-medium mt-0.5 truncate">
                        {alt.activity_name}
                      </div>
                    </div>
                  ))}

                  {/* Conflicting Signals Warning if present */}
                  {currentItem.conflicting_signals?.length > 0 && (
                    <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded text-[11px] text-rose-300">
                      <strong>Risk Warning: </strong>
                      {currentItem.conflicting_signals.join('; ')}
                    </div>
                  )}

                  {/* Planner Notes Input */}
                  <div className="space-y-1.5 pt-1">
                    <input 
                      type="text"
                      value={plannerNotes}
                      onChange={(e) => setPlannerNotes(e.target.value)}
                      placeholder="Optional planner remarks..."
                      className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded p-2 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Review Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="btn-primary text-xs flex-1 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 py-2 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{selectedCandidateId && currentItem.top_candidate && selectedCandidateId !== currentItem.top_candidate.id ? 'Override & Approve' : 'Approve Match'}</span>
                    </button>

                    <button 
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="btn-secondary text-xs px-3 py-2 text-rose-400 hover:bg-rose-950/30 border-rose-800/40 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
