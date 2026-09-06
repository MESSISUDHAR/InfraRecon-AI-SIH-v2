import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Info, 
  Sliders, 
  Layers, 
  Tag, 
  MapPin, 
  Calendar, 
  FileText, 
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Zap,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { 
  reconcileEvent,
  getExecutionEvents, 
  getMatchesStatus,
  getReconciliationWeights 
} from '../services/api';

const DEFAULT_WEIGHTS = {
  semantic_weight: 0.40,
  identifier_weight: 0.20,
  discipline_weight: 0.15,
  location_weight: 0.10,
  wbs_weight: 0.10,
  temporal_weight: 0.05
};

const SAMPLE_SCENARIOS = [
  {
    title: "1. Strong Exact Contextual Match",
    text: "Erected and bolted 24-inch spool piece on line 24-XX at Area PR-04. 100% completed today.",
    discipline: "Piping",
    description: "Exact line ID '24-XX', Area 'PR-04', and Discipline 'Piping'"
  },
  {
    title: "2. Wording Variation",
    text: "Poured and vibrated wet foundation concrete batch for the second compressor unit pad.",
    discipline: "Civil",
    description: "Phrased differently from schedule name ('Pour Foundation Slab for Compressor Unit B2')"
  },
  {
    title: "3. Missing Identifier (Neutral Alignment)",
    text: "Completed backfilling and soil compaction across the sector foundation trench. Subgrade prepared.",
    discipline: "Civil",
    description: "Has discipline & activity facts, but lacks line/asset ID (evaluated neutrally)"
  },
  {
    title: "4. Ambiguous Candidates (Disambiguation)",
    text: "Pulled 33kV high voltage power cables through duct bank near Substation B. 350 meters laid.",
    discipline: "Electrical",
    description: "Differentiates between multiple similar electrical cabling tasks using location & WBS"
  },
  {
    title: "5. Conflicting Context (Risk Alert)",
    text: "Electrical crew pulled instrumentation cables inside piping rack area PR-04 for line 24-XX.",
    discipline: "Electrical",
    description: "Reports 'Electrical' discipline against 'Piping' spool line, flagging cross-discipline conflict"
  }
];

export default function ReconciliationPage({ onNavigate }) {
  const [projectId, setProjectId] = useState('PRJ-REF-04');
  const [rawText, setRawText] = useState(SAMPLE_SCENARIOS[0].text);
  const [topK, setTopK] = useState(5);
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');
  
  // Configurable Weights
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [showWeightsConfig, setShowWeightsConfig] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  
  // Existing ingested events
  const [ingestedEvents, setIngestedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  useEffect(() => {
    loadServiceStatus();
    loadRecentEvents();
  }, [projectId]);

  const loadServiceStatus = async () => {
    try {
      const res = await getMatchesStatus();
      if (res && res.data) {
        setStatusInfo(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch matches status:', err);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const res = await getExecutionEvents({ project_id: projectId });
      if (res && res.data && res.data.events) {
        setIngestedEvents(res.data.events);
      }
    } catch (err) {
      console.warn('Could not load execution events:', err);
    }
  };

  const handleReconcile = async (customText = null, customEventId = null, customWeights = null) => {
    const textToSearch = customText !== null ? customText : rawText;
    const eventIdToSearch = customEventId !== null ? customEventId : (selectedEventId || null);
    const weightsToUse = customWeights || weights;

    if (!textToSearch && !eventIdToSearch) {
      setError('Please provide field report text or select an ingested ExecutionEvent.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        project_id: projectId,
        raw_text: textToSearch || undefined,
        event_id: eventIdToSearch || undefined,
        top_k: topK,
        weights: weightsToUse,
        discipline_filter: disciplineFilter === 'ALL' ? undefined : disciplineFilter
      };

      const result = await reconcileEvent(payload);
      setReconciliationResult(result);
    } catch (err) {
      console.error('Reconciliation failed:', err);
      setError(err.response?.data?.detail || err.message || 'Reconciliation failed.');
    } finally {
      setLoading(false);
    }
  };

  const selectScenario = (sc) => {
    setSelectedEventId('');
    setRawText(sc.text);
    setDisciplineFilter('ALL');
    handleReconcile(sc.text, '', weights);
  };

  const selectIngestedEvent = (e) => {
    const evtId = e.target.value;
    setSelectedEventId(evtId);
    const found = ingestedEvents.find(ev => ev.id === evtId);
    if (found) {
      setRawText(found.raw_text || '');
      handleReconcile(found.raw_text, evtId, weights);
    }
  };

  const updateWeight = (key, value) => {
    setWeights(prev => ({
      ...prev,
      [key]: parseFloat(value)
    }));
  };

  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  const totalWeightsSum = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-brand-400" />
              <span>Context-Aware L5/L6 Reconciliation Engine</span>
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full font-mono">
              Milestone 7
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Combines dense vector semantic similarity with 6 deterministic contextual dimensions, configurable weights, and missing-data neutrality.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Project: <strong className="text-white font-mono">{projectId}</strong></span>
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('planner-review')}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>Planner Review Gate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Safety & Compliance Notice */}
      <div className="bg-slate-900/80 border border-brand-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-brand-300">Deterministic Multi-Signal Engine: </strong>
          The reconciliation engine computes explainable component scores and ranks candidate activities. In compliance with <code className="text-slate-200 bg-slate-950 px-1 py-0.5 rounded font-mono">PROJECT_RULES.md</code>, no candidate is auto-approved or written to verified execution state at this milestone.
        </div>
      </div>

      {/* Main Input & Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Report Text Input, Filters & Configurable Weights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="panel-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <span>Field Evidence / Daily Progress Report</span>
              </label>

              {ingestedEvents.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Or pick ingested event:</span>
                  <select 
                    value={selectedEventId} 
                    onChange={selectIngestedEvent}
                    className="bg-slate-950 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1 max-w-[180px] truncate"
                  >
                    <option value="">-- Choose Event --</option>
                    {ingestedEvents.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.id} ({ev.source_id || 'Direct'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <textarea 
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={3}
              placeholder="Enter site daily progress report text..."
              className="w-full bg-slate-950 text-sm text-slate-100 border border-slate-800 rounded-lg p-3 focus:outline-none focus:border-brand-500 font-sans"
            />

            {/* Filter and Execution Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Discipline Scope
                </label>
                <select 
                  value={disciplineFilter}
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded px-2.5 py-1.5 focus:border-brand-500"
                >
                  <option value="ALL">All Disciplines (Full Schedule)</option>
                  <option value="Piping">Piping</option>
                  <option value="Civil">Civil</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Instrumentation">Instrumentation</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Top-K Candidates
                </label>
                <select 
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded px-2.5 py-1.5 focus:border-brand-500"
                >
                  <option value={3}>Top 3 Candidates</option>
                  <option value={5}>Top 5 Candidates (Standard)</option>
                  <option value={10}>Top 10 Candidates</option>
                </select>
              </div>

              <div className="flex items-end">
                <button 
                  onClick={() => handleReconcile()}
                  disabled={loading}
                  className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Run Reconciliation</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Toggle Configurable Weights */}
            <div className="pt-2 border-t border-slate-800/60">
              <button 
                onClick={() => setShowWeightsConfig(!showWeightsConfig)}
                className="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Configure Signal Weights ({Math.round(totalWeightsSum * 100)}% Total)</span>
                {showWeightsConfig ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {showWeightsConfig && (
                <div className="mt-3 p-4 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Reconciliation Signal Weights Configuration</span>
                    <button 
                      onClick={resetWeights}
                      className="text-[11px] text-slate-400 hover:text-brand-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Defaults</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Semantic ({Math.round(weights.semantic_weight * 100)}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.semantic_weight}
                        onChange={(e) => updateWeight('semantic_weight', e.target.value)}
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Line/Asset ID ({Math.round(weights.identifier_weight * 100)}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.identifier_weight}
                        onChange={(e) => updateWeight('identifier_weight', e.target.value)}
                        className="w-full accent-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Discipline ({Math.round(weights.discipline_weight * 100)}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.discipline_weight}
                        onChange={(e) => updateWeight('discipline_weight', e.target.value)}
                        className="w-full accent-cyan-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Location ({Math.round(weights.location_weight * 100)}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.location_weight}
                        onChange={(e) => updateWeight('location_weight', e.target.value)}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>WBS Context ({Math.round(weights.wbs_weight * 100)}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.wbs_weight}
                        onChange={(e) => updateWeight('wbs_weight', e.target.value)}
                        className="w-full accent-purple-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Temporal ({Math.round(weights.temporal_weight * 100)}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.temporal_weight}
                        onChange={(e) => updateWeight('temporal_weight', e.target.value)}
                        className="w-full accent-rose-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Test Scenarios */}
        <div className="space-y-3">
          <div className="panel-card p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Milestone 7 Test Scenarios</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any scenario to evaluate multi-signal scoring:
            </p>

            <div className="space-y-2 pt-1">
              {SAMPLE_SCENARIOS.map((sc, idx) => (
                <div 
                  key={idx}
                  onClick={() => selectScenario(sc)}
                  className="p-2.5 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 rounded-lg cursor-pointer transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200 group-hover:text-brand-300">
                      {sc.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                      {sc.discipline}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                    {sc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reconciliation Results Display */}
      {reconciliationResult && (
        <div className="space-y-6">
          {/* Grounded Fact Extraction Summary Bar */}
          {reconciliationResult.extracted_facts && Object.keys(reconciliationResult.extracted_facts).length > 0 && (
            <div className="panel-card p-4 bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span>Extracted Fact Grounding</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Evaluated <strong className="text-white font-mono">{reconciliationResult.total_activities_evaluated}</strong> schedule activities in <strong className="text-brand-400 font-mono">{reconciliationResult.execution_time_ms}ms</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Activity Fact</div>
                  <div className="font-medium text-slate-200 mt-0.5 truncate" title={reconciliationResult.extracted_facts.activity_description || 'N/A'}>
                    {reconciliationResult.extracted_facts.activity_description || 'Not specified'}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Discipline</div>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {reconciliationResult.extracted_facts.discipline || 'Unspecified'}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Location</div>
                  <div className="font-medium text-slate-200 mt-0.5">
                    {reconciliationResult.extracted_facts.location || 'Unspecified'}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Line ID</div>
                  <div className="font-mono font-medium text-amber-400 mt-0.5">
                    {reconciliationResult.extracted_facts.line_id || 'None'}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Asset ID</div>
                  <div className="font-mono font-medium text-cyan-400 mt-0.5">
                    {reconciliationResult.extracted_facts.asset_id || 'None'}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Extraction Conf</div>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                    {reconciliationResult.extracted_facts.extraction_confidence ? `${Math.round(reconciliationResult.extracted_facts.extraction_confidence * 100)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Reconciliation Match Card (Rank #1) */}
          {reconciliationResult.top_candidate ? (
            <div className="panel-card p-6 border-l-4 border-l-emerald-500 space-y-5 bg-gradient-to-r from-slate-900/90 to-slate-900/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                      Rank #1 Top Reconciled Match
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Schedule: {reconciliationResult.schedule_version}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-brand-400">{reconciliationResult.top_candidate.activity_id}</span>
                    <span className="text-slate-500">—</span>
                    <span>{reconciliationResult.top_candidate.activity_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Final Multi-Signal Conf</div>
                    <div className={`text-2xl font-bold font-mono ${
                      reconciliationResult.top_candidate.confidence_tier === 'HIGH' ? 'text-emerald-400' :
                      reconciliationResult.top_candidate.confidence_tier === 'MEDIUM' ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {(reconciliationResult.top_candidate.final_confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg border text-center font-bold text-xs ${
                    reconciliationResult.top_candidate.confidence_tier === 'HIGH' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' :
                    reconciliationResult.top_candidate.confidence_tier === 'MEDIUM' ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' :
                    'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}>
                    {reconciliationResult.top_candidate.confidence_tier} CONFIDENCE
                  </div>
                </div>
              </div>

              {/* 6-Signal Scoring Matrix Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">1. Semantic ({Math.round((reconciliationResult.weights_used.semantic_weight || 0.40) * 100)}%)</div>
                  <div className="text-base font-bold font-mono text-cyan-400 mt-1">
                    {(reconciliationResult.top_candidate.semantic_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Dense Cosine</div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">2. Line/Asset ID ({Math.round((reconciliationResult.weights_used.identifier_weight || 0.20) * 100)}%)</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                    {(reconciliationResult.top_candidate.identifier_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {reconciliationResult.top_candidate.context_signals?.identifier_match || 'Aligned'}
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">3. Discipline ({Math.round((reconciliationResult.weights_used.discipline_weight || 0.15) * 100)}%)</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                    {(reconciliationResult.top_candidate.discipline_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {reconciliationResult.top_candidate.discipline || 'Standard'}
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">4. Location ({Math.round((reconciliationResult.weights_used.location_weight || 0.10) * 100)}%)</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                    {(reconciliationResult.top_candidate.location_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {reconciliationResult.top_candidate.location || 'Global'}
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">5. WBS Context ({Math.round((reconciliationResult.weights_used.wbs_weight || 0.10) * 100)}%)</div>
                  <div className="text-base font-bold font-mono text-purple-400 mt-1">
                    {(reconciliationResult.top_candidate.wbs_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {reconciliationResult.top_candidate.wbs_code || 'L5'}
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">6. Temporal ({Math.round((reconciliationResult.weights_used.temporal_weight || 0.05) * 100)}%)</div>
                  <div className="text-base font-bold font-mono text-rose-400 mt-1">
                    {(reconciliationResult.top_candidate.temporal_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {reconciliationResult.top_candidate.context_signals?.temporal_alignment || 'Aligned'}
                  </div>
                </div>
              </div>

              {/* Explainability Reasoning & Risk Diagnostics */}
              <div className="space-y-2">
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-medium">Explainable Reconciliation Reason: </strong>
                    <span>{reconciliationResult.top_candidate.reasoning}</span>
                  </div>
                </div>

                {reconciliationResult.top_candidate.conflicting_signals?.length > 0 && (
                  <div className="bg-rose-950/30 border border-rose-500/40 rounded-lg p-3 text-xs text-rose-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-rose-200 font-medium">Conflicting Signals Detected: </strong>
                      <span>{reconciliationResult.top_candidate.conflicting_signals.join("; ")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-card p-8 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="text-sm font-medium text-white">No Matching Activities Found</div>
              <p className="text-xs text-slate-400">
                Ensure a project schedule has been ingested for <span className="font-mono">{projectId}</span>.
              </p>
            </div>
          )}

          {/* Alternative Candidates Table (Ranks #2 - #K) */}
          {reconciliationResult.alternative_candidates && reconciliationResult.alternative_candidates.length > 0 && (
            <div className="panel-card overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Alternative Ranked Candidates (Ranks #2 – #{reconciliationResult.total_candidates})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ranked by multi-signal weighted confidence score
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {reconciliationResult.alternative_candidates.length} Alternatives
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Activity Code</th>
                      <th className="py-3 px-4">Activity Name</th>
                      <th className="py-3 px-4">Discipline</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Semantic</th>
                      <th className="py-3 px-4">ID / Context</th>
                      <th className="py-3 px-4 text-right">Final Conf</th>
                      <th className="py-3 px-4 text-center">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {reconciliationResult.alternative_candidates.map((cand) => (
                      <tr key={cand.id || cand.activity_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-400 font-mono">
                          #{cand.rank}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-brand-300">
                          {cand.activity_id}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-200 max-w-xs truncate" title={cand.activity_name}>
                          {cand.activity_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                            {cand.discipline || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {cand.location || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-400">
                          {(cand.semantic_score * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400">
                          {(cand.identifier_score * 100).toFixed(0)}%
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${
                          cand.confidence_tier === 'HIGH' ? 'text-emerald-400' :
                          cand.confidence_tier === 'MEDIUM' ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {(cand.final_confidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cand.confidence_tier === 'HIGH' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                            cand.confidence_tier === 'MEDIUM' ? 'bg-amber-950 text-amber-400 border border-amber-500/30' :
                            'bg-rose-950 text-rose-400 border border-rose-500/30'
                          }`}>
                            {cand.confidence_tier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
