import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  ShieldCheck,
  Layers,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  GitBranch,
  FileText,
  Info,
  Shield,
  Tag,
  Sparkles
} from 'lucide-react';

const TimelineAuditDrawer = ({
  isOpen,
  onClose,
  activity,
  dependencyDetail,
  loading = false,
  error = null,
  onRetry
}) => {
  const [activeTab, setActiveTab] = useState('OBSERVATIONS'); // 'OBSERVATIONS' | 'DEPENDENCIES' | 'AUDIT'

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key press to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset to first tab whenever a new activity is loaded
  useEffect(() => {
    if (activity?.activity_id) {
      setActiveTab('OBSERVATIONS');
    }
  }, [activity?.activity_id]);

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      if (dateStr.includes('T')) {
        const [date, time] = dateStr.split('T');
        return `${date} ${time.slice(0, 5)}`;
      }
      return dateStr.slice(0, 16);
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            <Clock className="w-3.5 h-3.5" /> In Progress
          </span>
        );
      case 'Behind Schedule':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Behind Schedule
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A]">
            ⚪ {status || 'Not Started'}
          </span>
        );
    }
  };

  const getRiskSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/40">
            MEDIUM
          </span>
        );
      case 'BUFFERED':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
            BUFFERED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A] font-mono">
            {severity || 'NONE'}
          </span>
        );
    }
  };

  const getProgressModeBadge = (mode) => {
    switch (mode) {
      case 'CUMULATIVE_ACTIVITY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
            Cumulative Activity
          </span>
        );
      case 'SUB_WORK':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            Sub-Work / Component
          </span>
        );
      case 'EXPLICIT_COMPLETION':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            Explicit Completion
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#111111] text-[#A3A3A3] border border-[#2A2A2A]">
            {mode || 'Standard'}
          </span>
        );
    }
  };

  const observationsList = activity?.observations_history || [];
  const auditLogsList = activity?.audit_logs || [];
  
  // Extract predecessors & successors supporting both schema variations
  const predecessorsList = dependencyDetail?.predecessors || dependencyDetail?.upstream_predecessors || [];
  const successorsList = dependencyDetail?.immediate_successors || dependencyDetail?.downstream_successors || [];
  const totalDependencies = predecessorsList.length + successorsList.length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dark Overlay Backdrop - Solid Click to Close */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300 ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Fixed Right-Side Solid Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-[720px] bg-[#111111] border-l border-[#2A2A2A] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col h-full z-50 text-[#EAEAEA] transform transition-transform duration-300 ease-out">
          
          {/* 1. DRAWER HEADER */}
          <div className="px-6 py-4 border-b border-[#2A2A2A] bg-[#111111] shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-black px-2.5 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 tracking-wide">
                    {activity?.activity_id || 'ACT-????'}
                  </span>
                  {activity && getStatusBadge(activity.status)}
                  {activity?.discipline && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#0A0A0A] text-[#A3A3A3] border border-[#2A2A2A]">
                      {activity.discipline}
                    </span>
                  )}
                  {activity?.location && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#0A0A0A] text-[#A3A3A3] border border-[#2A2A2A]">
                      📍 {activity.location}
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#EAEAEA] leading-snug tracking-tight truncate">
                  {activity?.activity_name || 'Loading Activity Details...'}
                </h2>
                {activity?.wbs_name && (
                  <p className="text-xs text-[#A3A3A3]">
                    WBS: <span className="text-[#D4AF37] font-mono font-medium">{activity.wbs_code || ''}</span> {activity.wbs_name}
                  </p>
                )}
              </div>

              {/* Close X Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[#A3A3A3] hover:text-[#EAEAEA] hover:bg-[#1A1A1A] border border-transparent hover:border-[#2A2A2A] transition-all shrink-0"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. DRAWER BODY (Independently scrollable) */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6 bg-[#111111]">
            
            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 text-[#A3A3A3] space-y-3">
                <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">Loading verified history and dependencies...</p>
              </div>
            )}

            {/* Error State with Retry Button */}
            {!loading && error && (
              <div className="p-5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl space-y-3 text-[#EF4444]">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0" />
                  <span>Unable to load activity history</span>
                </div>
                <p className="text-xs text-[#EF4444]/90 leading-relaxed">{error}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EF4444] text-[#0A0A0A] rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Loading
                  </button>
                )}
              </div>
            )}

            {/* Loaded Activity Content */}
            {!loading && !error && activity && (
              <>
                {/* 3. EXECUTIVE 3-COLUMN SUMMARY CARD */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl shadow-inner">
                  {/* Verified Progress */}
                  <div className="flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                      Verified Progress
                    </span>
                    <div className="my-1 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-[#D4AF37] font-mono">
                        {activity.actual_progress !== undefined ? `${activity.actual_progress}%` : '0%'}
                      </span>
                    </div>
                    {/* Mini Progress Bar */}
                    <div className="w-full bg-[#111111] h-1.5 rounded-full overflow-hidden border border-[#2A2A2A]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          activity.actual_progress >= 100
                            ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                            : activity.is_delayed
                            ? 'bg-gradient-to-r from-[#EF4444] to-[#F87171]'
                            : 'bg-gradient-to-r from-[#D4AF37] to-[#F4D06F]'
                        }`}
                        style={{ width: `${Math.min(100, activity.actual_progress || 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Actual Start */}
                  <div className="flex flex-col justify-between border-l border-[#2A2A2A] pl-3">
                    <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                      Actual Start
                    </span>
                    <div className="my-1 font-mono text-sm font-bold text-[#EAEAEA]">
                      {activity.actual_start ? activity.actual_start.slice(0, 10) : 'Not Started'}
                    </div>
                    <div className="text-[10px] text-[#A3A3A3] truncate">
                      Plan: {activity.planned_start ? activity.planned_start.slice(0, 10) : '—'}
                    </div>
                  </div>

                  {/* Actual Finish */}
                  <div className="flex flex-col justify-between border-l border-[#2A2A2A] pl-3">
                    <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                      Actual Finish
                    </span>
                    <div className="my-1 font-mono text-sm font-bold text-[#EAEAEA]">
                      {activity.actual_finish
                        ? activity.actual_finish.slice(0, 10)
                        : activity.actual_progress > 0
                        ? 'Active'
                        : '—'}
                    </div>
                    <div className="text-[10px] text-[#A3A3A3] truncate">
                      Plan: {activity.planned_finish ? activity.planned_finish.slice(0, 10) : '—'}
                    </div>
                  </div>
                </div>

                {/* 4. THREE CLEARLY SEPARATED HORIZONTAL TABS */}
                <div className="flex items-center gap-1.5 p-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('OBSERVATIONS')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'OBSERVATIONS'
                        ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                        : 'text-[#A3A3A3] hover:text-[#EAEAEA] hover:bg-[#111111]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>OBSERVATIONS</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        activeTab === 'OBSERVATIONS'
                          ? 'bg-[#0A0A0A]/30 text-[#0A0A0A]'
                          : 'bg-[#111111] text-[#A3A3A3]'
                      }`}
                    >
                      {observationsList.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('DEPENDENCIES')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'DEPENDENCIES'
                        ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                        : 'text-[#A3A3A3] hover:text-[#EAEAEA] hover:bg-[#111111]'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5 shrink-0" />
                    <span>DEPENDENCY CPM</span>
                    {totalDependencies > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                          activeTab === 'DEPENDENCIES'
                            ? 'bg-[#0A0A0A]/30 text-[#0A0A0A]'
                            : 'bg-[#111111] text-[#A3A3A3]'
                        }`}
                      >
                        {totalDependencies}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('AUDIT')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'AUDIT'
                        ? 'bg-[#D4AF37] text-[#0A0A0A] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                        : 'text-[#A3A3A3] hover:text-[#EAEAEA] hover:bg-[#111111]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>AUDIT</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        activeTab === 'AUDIT'
                          ? 'bg-[#0A0A0A]/30 text-[#0A0A0A]'
                          : 'bg-[#111111] text-[#A3A3A3]'
                      }`}
                    >
                      {auditLogsList.length}
                    </span>
                  </button>
                </div>

                {/* 5. TAB 1: FIELD OBSERVATIONS TIMELINE */}
                {activeTab === 'OBSERVATIONS' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-[#2A2A2A]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D4AF37]" />
                        Field Observations History
                      </h3>
                      <span className="text-xs text-[#A3A3A3] font-mono">
                        {observationsList.length} {observationsList.length === 1 ? 'observation' : 'observations'}
                      </span>
                    </div>

                    {observationsList.length === 0 ? (
                      <div className="p-8 text-center bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] space-y-2">
                        <Info className="w-8 h-8 text-[#555555] mx-auto" />
                        <p className="text-xs text-[#A3A3A3] italic">
                          No field observations recorded for this activity.
                        </p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-[#2A2A2A] ml-3.5 pl-6 space-y-5">
                        {observationsList.map((obs, idx) => (
                          <div key={obs.event_id || idx} className="relative group">
                            {/* Timeline Node Icon */}
                            <div className="absolute -left-[31px] top-3.5 w-3.5 h-3.5 rounded-full bg-[#D4AF37] border-2 border-[#111111] shadow-[0_0_10px_rgba(212,175,55,0.4)]" />

                            {/* Observation Card */}
                            <div className="p-4 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl shadow-sm hover:border-[#D4AF37]/50 transition-all space-y-3">
                              {/* Observation Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[#2A2A2A] pb-2">
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="font-bold text-[#EAEAEA]">
                                    Observation #{idx + 1}
                                  </span>
                                  <span className="text-[#555555]">•</span>
                                  <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-bold text-[11px]">
                                    {obs.source_id || obs.event_id || 'DPR'}
                                  </span>
                                </div>
                                <div className="text-[#A3A3A3] text-[11px] font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#D4AF37]" />
                                  {formatDate(obs.approval_timestamp || obs.report_date)}
                                </div>
                              </div>

                              {/* Progress Badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="px-2.5 py-1 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold flex items-center gap-1.5">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                  <span>Cumulative Activity Progress:</span>
                                  <strong className="text-[#F4D06F] font-mono text-sm">
                                    {obs.resulting_activity_progress}%
                                  </strong>
                                </div>
                                {getProgressModeBadge(obs.progress_mode)}
                                {obs.event_progress !== null && obs.event_progress !== undefined && (
                                  <span className="px-2 py-0.5 rounded bg-[#111111] text-[#EAEAEA] border border-[#2A2A2A] text-xs font-mono">
                                    Event Progress: {obs.event_progress}%
                                  </span>
                                )}
                              </div>

                              {/* RAW FIELD EVIDENCE Box */}
                              <div className="p-3 bg-[#111111] border border-[#2A2A2A] rounded-lg space-y-1">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-1.5">
                                  <Tag className="w-3 h-3 text-[#D4AF37]" />
                                  RAW FIELD EVIDENCE
                                </div>
                                <p className="text-xs text-[#EAEAEA] font-sans italic leading-relaxed">
                                  "{obs.raw_text}"
                                </p>
                              </div>

                              {/* GROUNDED EXTRACT QUOTE Box (if available) */}
                              {obs.evidence_text && (
                                <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg space-y-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                                    GROUNDED EXTRACT QUOTE
                                  </div>
                                  <p className="text-xs text-[#F4D06F] font-mono italic leading-relaxed">
                                    "{obs.evidence_text}"
                                  </p>
                                </div>
                              )}

                              {/* Footer / Reviewer Meta */}
                              <div className="pt-2 border-t border-[#2A2A2A] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A3A3A3]">
                                <div className="flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-[#10B981]" />
                                  <span>
                                    Verified by:{' '}
                                    <strong className="text-[#EAEAEA] font-mono font-semibold">
                                      {obs.reviewer_id || 'System'}
                                    </strong>
                                  </span>
                                </div>
                                {obs.notes && (
                                  <div className="text-[#A3A3A3] italic text-[11px]">
                                    Note: {obs.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. TAB 2: DEPENDENCY INTELLIGENCE */}
                {activeTab === 'DEPENDENCIES' && (
                  <div className="space-y-5">
                    {/* Deterministic CPM Schedule Notice */}
                    <div className="p-3.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl flex items-start gap-3">
                      <Info className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                      <div className="text-xs text-[#EAEAEA] leading-relaxed">
                        <strong className="text-[#F59E0B] font-semibold block mb-0.5">
                          Rule-Based Schedule Impact Notice:
                        </strong>
                        Deterministic rule-based schedule dependency impact derived strictly from CPM predecessor-successor links. No predictive forecasting claimed.
                      </div>
                    </div>

                    {/* Current Activity Delay Status */}
                    <div className="p-4 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                          Current Activity Delay Status
                        </div>
                        <div className="text-sm font-bold mt-1">
                          {dependencyDetail?.delay_days > 0 || dependencyDetail?.effective_delay_days > 0 ? (
                            <span className="text-[#EF4444] flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" />
                              Lagging by +{dependencyDetail.delay_days || dependencyDetail.effective_delay_days} days
                            </span>
                          ) : (
                            <span className="text-[#10B981] flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              On Track (0 days delay)
                            </span>
                          )}
                        </div>
                        {dependencyDetail?.delay_reason && (
                          <div className="text-xs text-[#A3A3A3] mt-1">
                            {dependencyDetail.delay_reason}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="text-[#A3A3A3]">Discipline: </span>
                        <span className="text-[#D4AF37] font-bold">
                          {dependencyDetail?.discipline || activity?.discipline || 'General'}
                        </span>
                      </div>
                    </div>

                    {/* Predecessors Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-[#2A2A2A]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-2">
                          <span>⬅️ Upstream Predecessors</span>
                          <span className="text-[#A3A3A3] font-mono font-normal">
                            ({predecessorsList.length})
                          </span>
                        </h4>
                        <span className="text-[10px] text-[#A3A3A3]">
                          Must finish before this activity
                        </span>
                      </div>

                      {predecessorsList.length === 0 ? (
                        <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-xs text-[#A3A3A3] italic text-center">
                          No upstream predecessors defined in CPM schedule.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {predecessorsList.map((p, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#D4AF37]/50 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#D4AF37]">
                                    {p.activity_id || p.predecessor_code}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#111111] rounded font-mono text-[#A3A3A3] border border-[#2A2A2A]">
                                    {p.dependency_type || 'FS'}
                                  </span>
                                  {p.is_delayed || p.is_predecessor_delayed ? (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-[#EF4444]/20 text-[#EF4444] rounded border border-[#EF4444]/30 font-bold">
                                      Delayed +{p.delay_days || p.predecessor_delay_days}d
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-[#10B981]/20 text-[#10B981] rounded border border-[#10B981]/30">
                                      On Schedule
                                    </span>
                                  )}
                                </div>
                                <div className="text-[#EAEAEA] font-medium">
                                  {p.activity_name || p.predecessor_name}
                                </div>
                                <div className="text-[11px] text-[#A3A3A3] font-mono">
                                  Finish: {p.actual_finish || p.planned_finish || p.predecessor_planned_finish || '—'} • Status: {p.status || p.predecessor_status || 'Unknown'}
                                </div>
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <div className="text-[10px] text-[#A3A3A3] uppercase">Float Buffer</div>
                                <div className="text-xs font-bold text-[#EAEAEA]">
                                  {p.buffer_days !== undefined ? p.buffer_days : p.buffer_days_to_this || 0} days
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Successors Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-[#2A2A2A]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-2">
                          <span>➡️ Downstream Successors Impact</span>
                          <span className="text-[#A3A3A3] font-mono font-normal">
                            ({successorsList.length})
                          </span>
                        </h4>
                        <span className="text-[10px] text-[#A3A3A3]">
                          Activities waiting on this task
                        </span>
                      </div>

                      {successorsList.length === 0 ? (
                        <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-xs text-[#A3A3A3] italic text-center">
                          No downstream successor dependencies mapped to this activity.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {successorsList.map((s, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#D4AF37]/50 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#D4AF37]">
                                    {s.successor_activity_id || s.successor_code}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#111111] rounded font-mono text-[#A3A3A3] border border-[#2A2A2A]">
                                    {s.dependency_type || 'FS'}
                                  </span>
                                  {getRiskSeverityBadge(s.risk_severity)}
                                </div>
                                <div className="text-[#EAEAEA] font-medium">
                                  {s.successor_activity_name || s.successor_name}
                                </div>
                                <div className="text-[11px] text-[#A3A3A3] font-mono">
                                  Planned Start: {s.planned_start || s.successor_planned_start || '—'} • Discipline: {s.discipline || s.successor_discipline || 'General'}
                                </div>
                                {s.impact_explanation && (
                                  <div className="text-[11px] text-[#A3A3A3] italic">
                                    {s.impact_explanation}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <div className="text-[10px] text-[#A3A3A3] uppercase">Buffer: {s.buffer_days || 0}d</div>
                                <div className="text-xs font-bold mt-0.5">
                                  {(s.potential_delay_impact_days || s.potential_delay_slippage_days || 0) > 0 ? (
                                    <span className="text-[#EF4444]">
                                      +{s.potential_delay_impact_days || s.potential_delay_slippage_days}d Slippage
                                    </span>
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

                    {/* Overall Empty State if No Predecessors AND No Successors */}
                    {predecessorsList.length === 0 && successorsList.length === 0 && (
                      <div className="p-6 bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] text-center space-y-2">
                        <GitBranch className="w-8 h-8 text-[#555555] mx-auto" />
                        <p className="text-xs text-[#A3A3A3] italic">
                          No dependency relationships recorded for this activity.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. TAB 3: IMMUTABLE AUDIT TRAIL LINEAGE */}
                {activeTab === 'AUDIT' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-[#2A2A2A]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                        Persisted Audit Records
                      </h3>
                      <span className="text-xs text-[#A3A3A3] font-mono">
                        {auditLogsList.length} {auditLogsList.length === 1 ? 'record' : 'records'}
                      </span>
                    </div>

                    {auditLogsList.length === 0 ? (
                      <div className="p-8 text-center bg-[#0A0A0A] rounded-xl border border-[#2A2A2A] space-y-2">
                        <Shield className="w-8 h-8 text-[#555555] mx-auto" />
                        <p className="text-xs text-[#A3A3A3] italic">
                          No audit records recorded for this activity.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {auditLogsList.map((aud, idx) => {
                          const prev = aud.previous_state || {};
                          const next = aud.new_state || {};
                          return (
                            <div
                              key={aud.id || idx}
                              className="p-4 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl shadow-sm space-y-3 hover:border-[#D4AF37]/50 transition-colors"
                            >
                              {/* Audit Entry Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2A] pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-[#EAEAEA] px-2 py-0.5 rounded bg-[#111111] border border-[#2A2A2A]">
                                    {aud.id}
                                  </span>
                                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                                    {aud.action_type || 'VERIFIED_UPDATE'}
                                  </span>
                                </div>
                                <div className="text-[#A3A3A3] text-[11px] font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#D4AF37]" />
                                  {formatDate(aud.timestamp)}
                                </div>
                              </div>

                              {/* Reviewer & Meta Info */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-[#111111] p-2.5 rounded-xl border border-[#2A2A2A]">
                                <div>
                                  <span className="text-[10px] text-[#A3A3A3] block uppercase font-bold">Activity ID</span>
                                  <span className="font-mono font-bold text-[#D4AF37]">{activity.activity_id}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-[#A3A3A3] block uppercase font-bold">Verified By</span>
                                  <span className="font-mono font-semibold text-[#EAEAEA] flex items-center gap-1">
                                    <UserCheck className="w-3 h-3 text-[#10B981]" />
                                    {aud.performed_by || 'LEAD_DISAMBIGUATOR'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-[#A3A3A3] block uppercase font-bold">Confidence</span>
                                  <span className="font-mono font-bold text-[#10B981]">
                                    {aud.confidence !== undefined && aud.confidence !== null
                                      ? typeof aud.confidence === 'number' && aud.confidence <= 1
                                        ? `${Math.round(aud.confidence * 100)}%`
                                        : `${aud.confidence}%`
                                      : '100%'}
                                  </span>
                                </div>
                              </div>

                              {/* READABLE STATE TRANSITION VISUALIZATION */}
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
                                  State Transition Lineage
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
                                  {/* Previous State */}
                                  <div className="p-3 bg-[#111111] border border-[#2A2A2A] rounded-xl space-y-1 text-xs">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] flex items-center justify-between">
                                      <span>PREVIOUS STATE</span>
                                      <span className="text-[#555555] font-mono text-[9px]">BEFORE</span>
                                    </div>
                                    <div className="pt-1 space-y-1 font-mono">
                                      <div className="flex justify-between">
                                        <span className="text-[#A3A3A3]">Progress:</span>
                                        <span className="font-bold text-[#EAEAEA]">{prev.actual_progress !== undefined ? `${prev.actual_progress}%` : '0%'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#A3A3A3]">Status:</span>
                                        <span className="text-[#EAEAEA]">{prev.status || 'Not Started'}</span>
                                      </div>
                                      {prev.verified_observations_count !== undefined && (
                                        <div className="flex justify-between text-[11px]">
                                          <span className="text-[#A3A3A3]">Observations:</span>
                                          <span className="text-[#A3A3A3]">{prev.verified_observations_count}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Verified Update / New State */}
                                  <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl space-y-1 text-xs">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                                        VERIFIED UPDATE
                                      </span>
                                      <span className="text-[#D4AF37] font-mono text-[9px]">COMMITTED</span>
                                    </div>
                                    <div className="pt-1 space-y-1 font-mono">
                                      <div className="flex justify-between">
                                        <span className="text-[#A3A3A3]">Progress:</span>
                                        <span className="font-bold text-[#D4AF37]">{next.actual_progress !== undefined ? `${next.actual_progress}%` : `${activity.actual_progress}%`}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#A3A3A3]">Status:</span>
                                        <span className="text-[#10B981] font-semibold">{next.status || activity.status}</span>
                                      </div>
                                      {next.verified_observations_count !== undefined && (
                                        <div className="flex justify-between text-[11px]">
                                          <span className="text-[#A3A3A3]">Observations:</span>
                                          <span className="text-[#D4AF37]">{next.verified_observations_count}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Decision Rationale */}
                              {aud.decision_reason && (
                                <div className="p-3 bg-[#111111] border border-[#2A2A2A] rounded-xl space-y-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
                                    RATIONALE & VERIFICATION NOTES
                                  </div>
                                  <p className="text-xs text-[#EAEAEA] font-mono italic leading-relaxed">
                                    "{aud.decision_reason}"
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 8. DRAWER FOOTER (Solid & Fixed at Bottom) */}
          <div className="px-6 py-4 border-t border-[#2A2A2A] bg-[#111111] shrink-0 flex items-center justify-between">
            <div className="text-xs text-[#A3A3A3] font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>Execution State Verified Detail</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#EAEAEA] border border-[#2A2A2A] font-bold text-xs transition-colors shadow-sm focus:outline-none"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TimelineAuditDrawer;

