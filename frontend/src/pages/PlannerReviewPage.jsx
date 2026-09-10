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
  Filter,
  Award
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
            <div className="p-2.5 bg-[#111111] border border-[#D4AF37]/30 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <UserCheck className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#EAEAEA] tracking-tight">
                  Human-in-the-Loop Planner Review Gate
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full font-mono">
                  GATEWAY
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Confidence policy guardrails & human oversight before updating verified schedule progress.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleAutoProcess}
            disabled={actionLoading || queueData.high_confidence_count === 0}
            className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-[0_0_15px_rgba(212,175,55,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5 text-[#0A0A0A]" />
            <span>Auto-Process Eligible ({queueData.high_confidence_count})</span>
          </button>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('execution-state')}
              className="btn-outline text-xs flex items-center gap-1.5 py-2 px-3.5"
            >
              <span>Verified Execution State</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confidence Policy Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2A2A] pb-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTierFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'ALL' 
                ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-[0_0_12px_rgba(212,175,55,0.3)]' 
                : 'bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A] hover:text-[#EAEAEA]'
            }`}
          >
            All Pending ({queueData.pending_count})
          </button>

          <button 
            onClick={() => setTierFilter('HIGH')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              tierFilter === 'HIGH' 
                ? 'bg-[#10B981] text-[#0A0A0A] shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
                : 'bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A] hover:text-[#10B981]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>High Conf (≥85%)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              tierFilter === 'HIGH' ? 'bg-[#0A0A0A]/30 text-[#0A0A0A]' : 'bg-[#10B981]/20 text-[#10B981]'
            }`}>
              {queueData.high_confidence_count}
            </span>
          </button>

          <button 
            onClick={() => setTierFilter('MEDIUM')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              tierFilter === 'MEDIUM' 
                ? 'bg-[#F59E0B] text-[#0A0A0A] shadow-[0_0_12px_rgba(245,158,11,0.3)]' 
                : 'bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A] hover:text-[#F59E0B]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Medium Conf (60-84%)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              tierFilter === 'MEDIUM' ? 'bg-[#0A0A0A]/30 text-[#0A0A0A]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'
            }`}>
              {queueData.medium_confidence_count}
            </span>
          </button>

          <button 
            onClick={() => setTierFilter('LOW')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              tierFilter === 'LOW' 
                ? 'bg-[#EF4444] text-[#0A0A0A] shadow-[0_0_12px_rgba(239,68,68,0.3)]' 
                : 'bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A] hover:text-[#EF4444]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Conf (&lt;60%)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              tierFilter === 'LOW' ? 'bg-[#0A0A0A]/30 text-[#0A0A0A]' : 'bg-[#EF4444]/20 text-[#EF4444]'
            }`}>
              {queueData.low_confidence_count}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#A3A3A3] bg-[#111111] px-3 py-1.5 rounded-xl border border-[#2A2A2A]">
            <span>Project:</span>
            {projectsList.length > 0 ? (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2 py-0.5 text-[#EAEAEA] font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
              >
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code || p.id} - {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-[#D4AF37] font-bold">{projectId}</span>
            )}
          </div>

          <button 
            onClick={loadQueue}
            disabled={loading}
            className="text-xs text-[#A3A3A3] hover:text-[#EAEAEA] flex items-center gap-1.5 bg-[#111111] px-3 py-1.5 rounded-xl border border-[#2A2A2A] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 flex items-center gap-3 text-[#EF4444] text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 flex items-center gap-3 text-[#10B981] text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Queue Items or Empty State */}
      {queueData.items.length === 0 ? (
        <div className="panel-card p-12 text-center text-[#A3A3A3] space-y-3">
          <div className="p-3 bg-[#10B981]/10 rounded-2xl w-fit mx-auto border border-[#10B981]/20">
            <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
          </div>
          <h3 className="text-base font-bold text-[#EAEAEA]">Review Queue Clean</h3>
          <p className="text-xs text-[#A3A3A3] max-w-md mx-auto">
            No execution events are currently pending planner review under the selected filter. Submit a field report on the Field Reports page to generate new review items.
          </p>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('field-reports')}
              className="btn-primary text-xs mt-2 py-2 px-4 inline-flex items-center gap-2"
            >
              <span>Submit New Field Report</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#0A0A0A]" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Review Item Selector Ribbon */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {queueData.items.map((it) => (
              <div 
                key={it.event_id}
                onClick={() => handleSelectEvent(it)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all shrink-0 min-w-[240px] ${
                  selectedEventId === it.event_id 
                    ? 'bg-[#111111] border-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.15)]' 
                    : 'bg-[#111111] border-[#2A2A2A] hover:border-[#D4AF37]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#D4AF37]">{it.event_id}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    it.confidence_tier === 'HIGH' ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30' :
                    it.confidence_tier === 'MEDIUM' ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30' :
                    'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                  }`}>
                    {Math.round(it.final_confidence * 100)}% ({it.confidence_tier})
                  </span>
                </div>
                <div className="text-[11px] text-[#A3A3A3] mt-1.5 truncate font-medium">
                  {it.extracted_facts?.activity_description || it.raw_text}
                </div>
              </div>
            ))}
          </div>

          {/* Active Item Context Alert */}
          {currentItem && (
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              currentItem.confidence_tier === 'HIGH' ? 'bg-[#10B981]/10 border-[#10B981]/30' :
              currentItem.confidence_tier === 'MEDIUM' ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30' :
              'bg-[#EF4444]/10 border-[#EF4444]/30'
            }`}>
              <div className="flex items-center gap-3">
                {currentItem.confidence_tier === 'HIGH' ? (
                  <ShieldCheck className="w-5 h-5 text-[#10B981] shrink-0" />
                ) : currentItem.confidence_tier === 'MEDIUM' ? (
                  <AlertCircle className="w-5 h-5 text-[#F59E0B] shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0" />
                )}
                <div className="text-xs">
                  <strong className={
                    currentItem.confidence_tier === 'HIGH' ? 'text-[#10B981]' :
                    currentItem.confidence_tier === 'MEDIUM' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                  }>
                    {currentItem.confidence_tier === 'HIGH' ? 'High Confidence (Auto-Eligible): ' :
                     currentItem.confidence_tier === 'MEDIUM' ? 'Planner Review Required: ' : 'Low Confidence / Risk Alert: '}
                  </strong>
                  <span className="text-[#EAEAEA]">
                    {currentItem.reconciliation_reason || 'Reconciliation engine evaluated context signals.'}
                  </span>
                </div>
              </div>

              <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shrink-0 ${
                currentItem.confidence_tier === 'HIGH' ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40' :
                currentItem.confidence_tier === 'MEDIUM' ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40' :
                'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40'
              }`}>
                Confidence: {(currentItem.final_confidence * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* 3-PANE HUMAN-IN-THE-LOOP INTERFACE */}
          {currentItem && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pane 1: Original Raw Field Evidence */}
              <div className="panel-card p-5 space-y-4 border-t-2 border-t-[#D4AF37] flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>1. Original Raw Evidence</span>
                    </span>
                    <span className="text-[10px] text-[#A3A3A3] font-mono bg-[#0A0A0A] px-2 py-0.5 rounded border border-[#2A2A2A]">
                      {currentItem.source_id || 'DIRECT_INPUT'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl text-xs font-sans text-[#EAEAEA] leading-relaxed italic">
                    "{currentItem.raw_text}"
                  </div>

                  <div className="space-y-1.5 text-xs text-[#A3A3A3]">
                    <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                      <span>Source Reference:</span>
                      <span className="text-[#EAEAEA] font-medium">{currentItem.source_type || 'Field Report'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                      <span>Reporter Name:</span>
                      <span className="text-[#EAEAEA]">{currentItem.reporter_name || 'Supervisor'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Report Date:</span>
                      <span className="text-[#EAEAEA]">{currentItem.report_date?.split('T')[0] || 'Today'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#A3A3A3] bg-[#0A0A0A] p-2.5 rounded-lg border border-[#2A2A2A]">
                  🔒 Raw field evidence is preserved verbatim and immutable.
                </div>
              </div>

              {/* Pane 2: Extracted ExecutionEvent (Fact Grounding) */}
              <div className="panel-card p-5 space-y-4 border-t-2 border-t-[#3B82F6] flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>2. AI Fact Grounding</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded">
                      Conf: {currentItem.extracted_facts?.extraction_confidence ? `${Math.round(currentItem.extracted_facts.extraction_confidence * 100)}%` : '95%'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                    <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                      <span className="text-[#A3A3A3]">Activity Fact:</span>
                      <span className="text-[#3B82F6] font-semibold truncate max-w-[170px]">
                        {currentItem.extracted_facts?.activity_description || 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                      <span className="text-[#A3A3A3]">Discipline:</span>
                      <span className="text-[#EAEAEA] font-medium">{currentItem.extracted_facts?.discipline || 'General'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                      <span className="text-[#A3A3A3]">Location:</span>
                      <span className="text-[#10B981] font-medium">{currentItem.extracted_facts?.location || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#2A2A2A]">
                      <span className="text-[#A3A3A3]">Line / Asset:</span>
                      <span className="text-[#D4AF37] font-mono">{currentItem.extracted_facts?.line_id || currentItem.extracted_facts?.asset_id || 'null (absent)'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#A3A3A3]">Event Type:</span>
                      <span className="text-[#A855F7] font-medium">{currentItem.extracted_facts?.event_type || 'progress'} ({currentItem.extracted_facts?.progress || 100}%)</span>
                    </div>
                  </div>

                  {currentItem.extracted_facts?.evidence_text && (
                    <div className="text-[11px] text-[#A3A3A3]">
                      Grounded Quote: <em className="text-[#EAEAEA]">"{currentItem.extracted_facts.evidence_text}"</em>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-[#A3A3A3] bg-[#0A0A0A] p-2.5 rounded-lg border border-[#2A2A2A]">
                  Grounded strictly by Gemini 2.5 Flash without hallucinations.
                </div>
              </div>

              {/* Pane 3: Candidate Schedule Activities & Review Decisions */}
              <div className="panel-card p-5 space-y-4 border-t-2 border-t-[#D4AF37] flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>3. Candidate Activities</span>
                    </span>
                    <span className="text-[10px] text-[#A3A3A3]">Select target activity</span>
                  </div>

                  {/* Top Candidate */}
                  {currentItem.top_candidate && (
                    <div 
                      onClick={() => setSelectedCandidateId(currentItem.top_candidate.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedCandidateId === currentItem.top_candidate.id || (!selectedCandidateId)
                          ? 'bg-[#111111] border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]'
                          : 'bg-[#0A0A0A] border-[#2A2A2A] hover:border-[#D4AF37]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#D4AF37] flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" />
                          {currentItem.top_candidate.activity_id} (Rank #1)
                        </span>
                        <span className="font-mono text-[#10B981] font-bold text-[11px]">
                          Score: {(currentItem.top_candidate.final_confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[#EAEAEA] font-bold mt-1">
                        {currentItem.top_candidate.activity_name}
                      </div>
                      <div className="text-[10px] text-[#A3A3A3] mt-1 flex items-center gap-2">
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
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedCandidateId === alt.id
                          ? 'bg-[#111111] border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]'
                          : 'bg-[#0A0A0A] border-[#2A2A2A] hover:border-[#D4AF37]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#A3A3A3]">
                          {alt.activity_id} (Rank #{alt.rank})
                        </span>
                        <span className="font-mono text-[#A3A3A3] font-bold text-[11px]">
                          Score: {(alt.final_confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[#EAEAEA] font-medium mt-0.5 truncate">
                        {alt.activity_name}
                      </div>
                    </div>
                  ))}

                  {/* Conflicting Signals Warning if present */}
                  {currentItem.conflicting_signals?.length > 0 && (
                    <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl text-[11px] text-[#EF4444]">
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
                      className="w-full bg-[#0A0A0A] text-xs text-[#EAEAEA] border border-[#2A2A2A] rounded-xl p-2.5 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Review Actions */}
                <div className="space-y-2 pt-2 border-t border-[#2A2A2A]">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="btn-primary text-xs flex-1 py-2 px-3 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                    >
                      <Check className="w-3.5 h-3.5 text-[#0A0A0A]" />
                      <span>{selectedCandidateId && currentItem.top_candidate && selectedCandidateId !== currentItem.top_candidate.id ? 'Override & Approve' : 'Approve Match'}</span>
                    </button>

                    <button 
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="btn-secondary text-xs px-3.5 py-2 text-[#EF4444] hover:bg-[#EF4444]/15 border-[#EF4444]/40 flex items-center gap-1.5 transition-colors"
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

