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
  SlidersHorizontal,
  Award,
  Cpu
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
            <div className="p-2.5 bg-[#111111] border border-[#D4AF37]/30 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <Sparkles className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#EAEAEA] tracking-tight">
                  Context-Aware Reconciliation Engine
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full font-mono">
                  L5 / L6 MATCH
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Dense vector semantic embedding coupled with 6 deterministic contextual dimensions & explainability metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-[#111111] border border-[#2A2A2A] px-3.5 py-2 rounded-xl text-[#A3A3A3]">
            <Layers className="w-4 h-4 text-[#D4AF37]" />
            <span>Project: <strong className="text-[#EAEAEA] font-mono">{projectId}</strong></span>
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('planner-review')}
              className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-[0_0_15px_rgba(212,175,55,0.25)]"
            >
              <span>Planner Review Gate</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#0A0A0A]" />
            </button>
          )}
        </div>
      </div>

      {/* Safety & Compliance Notice */}
      <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-xl p-4 flex items-start gap-3.5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
        <div className="p-1.5 bg-[#D4AF37]/10 rounded-lg shrink-0 mt-0.5 border border-[#D4AF37]/20">
          <Info className="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div className="text-xs text-[#A3A3A3] leading-relaxed">
          <strong className="text-[#D4AF37] font-semibold">Deterministic Multi-Signal Engine: </strong>
          The reconciliation engine computes explainable component scores and ranks candidate activities. In compliance with <code className="text-[#EAEAEA] bg-[#0A0A0A] px-1.5 py-0.5 rounded border border-[#2A2A2A] font-mono text-[11px]">PROJECT_RULES.md</code>, no candidate is auto-approved or written to verified execution state at this milestone.
        </div>
      </div>

      {/* Main Input & Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Report Text Input, Filters & Configurable Weights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="panel-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D4AF37]" />
                <span>Field Evidence / Daily Progress Report</span>
              </label>

              {ingestedEvents.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#A3A3A3]">Or pick ingested event:</span>
                  <select 
                    value={selectedEventId} 
                    onChange={selectIngestedEvent}
                    className="bg-[#0A0A0A] text-xs text-[#EAEAEA] border border-[#2A2A2A] rounded-lg px-2.5 py-1 max-w-[200px] truncate focus:border-[#D4AF37] focus:outline-none"
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
              className="w-full bg-[#0A0A0A] text-sm text-[#EAEAEA] border border-[#2A2A2A] rounded-xl p-3.5 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 font-sans transition-all placeholder-[#555555]"
            />

            {/* Filter and Execution Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#2A2A2A]">
              <div>
                <label className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider block mb-1">
                  Discipline Scope
                </label>
                <select 
                  value={disciplineFilter}
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="w-full bg-[#0A0A0A] text-xs text-[#EAEAEA] border border-[#2A2A2A] rounded-lg px-3 py-2 focus:border-[#D4AF37] focus:outline-none"
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
                <label className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider block mb-1">
                  Top-K Candidates
                </label>
                <select 
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full bg-[#0A0A0A] text-xs text-[#EAEAEA] border border-[#2A2A2A] rounded-lg px-3 py-2 focus:border-[#D4AF37] focus:outline-none"
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
                  className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-2 h-[38px] shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0A0A0A]" />
                      <span>Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-3.5 h-3.5 text-[#0A0A0A]" />
                      <span>Run Reconciliation</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Toggle Configurable Weights */}
            <div className="pt-2 border-t border-[#2A2A2A]">
              <button 
                onClick={() => setShowWeightsConfig(!showWeightsConfig)}
                className="text-xs text-[#A3A3A3] hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Configure Signal Weights ({Math.round(totalWeightsSum * 100)}% Total)</span>
                {showWeightsConfig ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {showWeightsConfig && (
                <div className="mt-3 p-4 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#EAEAEA] flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Reconciliation Signal Weights Configuration
                    </span>
                    <button 
                      onClick={resetWeights}
                      className="text-[11px] text-[#A3A3A3] hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Defaults</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-1">
                    <div className="bg-[#111111] p-2.5 rounded-lg border border-[#2A2A2A]">
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
                        <span className="font-medium text-[#EAEAEA]">Semantic Cosine</span>
                        <span className="font-mono text-[#D4AF37] font-bold">{Math.round(weights.semantic_weight * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.semantic_weight}
                        onChange={(e) => updateWeight('semantic_weight', e.target.value)}
                        className="w-full accent-[#D4AF37] cursor-pointer"
                      />
                    </div>

                    <div className="bg-[#111111] p-2.5 rounded-lg border border-[#2A2A2A]">
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
                        <span className="font-medium text-[#EAEAEA]">Line/Asset ID</span>
                        <span className="font-mono text-[#10B981] font-bold">{Math.round(weights.identifier_weight * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.identifier_weight}
                        onChange={(e) => updateWeight('identifier_weight', e.target.value)}
                        className="w-full accent-[#10B981] cursor-pointer"
                      />
                    </div>

                    <div className="bg-[#111111] p-2.5 rounded-lg border border-[#2A2A2A]">
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
                        <span className="font-medium text-[#EAEAEA]">Discipline</span>
                        <span className="font-mono text-[#3B82F6] font-bold">{Math.round(weights.discipline_weight * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.discipline_weight}
                        onChange={(e) => updateWeight('discipline_weight', e.target.value)}
                        className="w-full accent-[#3B82F6] cursor-pointer"
                      />
                    </div>

                    <div className="bg-[#111111] p-2.5 rounded-lg border border-[#2A2A2A]">
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
                        <span className="font-medium text-[#EAEAEA]">Location</span>
                        <span className="font-mono text-[#F59E0B] font-bold">{Math.round(weights.location_weight * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.location_weight}
                        onChange={(e) => updateWeight('location_weight', e.target.value)}
                        className="w-full accent-[#F59E0B] cursor-pointer"
                      />
                    </div>

                    <div className="bg-[#111111] p-2.5 rounded-lg border border-[#2A2A2A]">
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
                        <span className="font-medium text-[#EAEAEA]">WBS Context</span>
                        <span className="font-mono text-[#A855F7] font-bold">{Math.round(weights.wbs_weight * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.wbs_weight}
                        onChange={(e) => updateWeight('wbs_weight', e.target.value)}
                        className="w-full accent-[#A855F7] cursor-pointer"
                      />
                    </div>

                    <div className="bg-[#111111] p-2.5 rounded-lg border border-[#2A2A2A]">
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
                        <span className="font-medium text-[#EAEAEA]">Temporal Window</span>
                        <span className="font-mono text-[#EC4899] font-bold">{Math.round(weights.temporal_weight * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={weights.temporal_weight}
                        onChange={(e) => updateWeight('temporal_weight', e.target.value)}
                        className="w-full accent-[#EC4899] cursor-pointer"
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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D4AF37]" />
                <span>Test Benchmark Scenarios</span>
              </h3>
              <span className="text-[10px] text-[#A3A3A3]">5 Scenarios</span>
            </div>
            <p className="text-[11px] text-[#A3A3A3]">
              Click any scenario below to evaluate multi-signal scoring against active schedule:
            </p>

            <div className="space-y-2 pt-1">
              {SAMPLE_SCENARIOS.map((sc, idx) => (
                <div 
                  key={idx}
                  onClick={() => selectScenario(sc)}
                  className="p-3 bg-[#0A0A0A] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37]/50 rounded-xl cursor-pointer transition-all text-left group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#EAEAEA] group-hover:text-[#F4D06F] transition-colors">
                      {sc.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-[#111111] text-[#D4AF37] border border-[#D4AF37]/20 rounded-md font-mono">
                      {sc.discipline}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A3A3A3] mt-1 line-clamp-1">
                    {sc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 flex items-center gap-3 text-[#EF4444] text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reconciliation Results Display */}
      {reconciliationResult && (
        <div className="space-y-6">
          {/* Grounded Fact Extraction Summary Bar */}
          {reconciliationResult.extracted_facts && Object.keys(reconciliationResult.extracted_facts).length > 0 && (
            <div className="panel-card p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Extracted Fact Grounding</span>
                </span>
                <span className="text-[11px] text-[#A3A3A3]">
                  Evaluated <strong className="text-[#EAEAEA] font-mono">{reconciliationResult.total_activities_evaluated}</strong> activities in <strong className="text-[#D4AF37] font-mono">{reconciliationResult.execution_time_ms}ms</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Activity Fact</div>
                  <div className="font-medium text-[#EAEAEA] mt-1 truncate" title={reconciliationResult.extracted_facts.activity_description || 'N/A'}>
                    {reconciliationResult.extracted_facts.activity_description || 'Not specified'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Discipline</div>
                  <div className="font-medium text-[#EAEAEA] mt-1">
                    {reconciliationResult.extracted_facts.discipline || 'Unspecified'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Location</div>
                  <div className="font-medium text-[#EAEAEA] mt-1">
                    {reconciliationResult.extracted_facts.location || 'Unspecified'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Line ID</div>
                  <div className="font-mono font-medium text-[#D4AF37] mt-1">
                    {reconciliationResult.extracted_facts.line_id || 'None'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Asset ID</div>
                  <div className="font-mono font-medium text-[#3B82F6] mt-1">
                    {reconciliationResult.extracted_facts.asset_id || 'None'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Extraction Conf</div>
                  <div className="font-mono font-bold text-[#10B981] mt-1">
                    {reconciliationResult.extracted_facts.extraction_confidence ? `${Math.round(reconciliationResult.extracted_facts.extraction_confidence * 100)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Reconciliation Match Card (Rank #1) */}
          {reconciliationResult.top_candidate ? (
            <div className="panel-card p-6 border-l-4 border-l-[#D4AF37] space-y-5 bg-gradient-to-r from-[#111111] via-[#111111] to-[#1A1A1A] shadow-[0_0_25px_rgba(212,175,55,0.08)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#2A2A2A] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 rounded-lg flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      Rank #1 Top Reconciled Match
                    </span>
                    <span className="text-xs text-[#A3A3A3] font-mono">
                      Schedule: {reconciliationResult.schedule_version}
                    </span>
                  </div>
                  <div className="text-xl font-black text-[#EAEAEA] mt-2 flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
                      {reconciliationResult.top_candidate.activity_id}
                    </span>
                    <span className="text-[#555555]">—</span>
                    <span>{reconciliationResult.top_candidate.activity_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">Multi-Signal Score</div>
                    <div className={`text-3xl font-black font-mono tracking-tight ${
                      reconciliationResult.top_candidate.confidence_tier === 'HIGH' ? 'text-[#10B981]' :
                      reconciliationResult.top_candidate.confidence_tier === 'MEDIUM' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                    }`}>
                      {(reconciliationResult.top_candidate.final_confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className={`px-3.5 py-2 rounded-xl border text-center font-bold text-xs tracking-wider ${
                    reconciliationResult.top_candidate.confidence_tier === 'HIGH' ? 'bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]' :
                    reconciliationResult.top_candidate.confidence_tier === 'MEDIUM' ? 'bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]' :
                    'bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]'
                  }`}>
                    {reconciliationResult.top_candidate.confidence_tier} CONFIDENCE
                  </div>
                </div>
              </div>

              {/* 6-Signal Scoring Matrix Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">
                    1. Semantic ({Math.round((reconciliationResult.weights_used?.semantic_weight || 0.40) * 100)}%)
                  </div>
                  <div className="text-lg font-black font-mono text-[#D4AF37] mt-1">
                    {(reconciliationResult.top_candidate.semantic_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] mt-0.5">Dense Vector Cosine</div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">
                    2. Line/Asset ({Math.round((reconciliationResult.weights_used?.identifier_weight || 0.20) * 100)}%)
                  </div>
                  <div className="text-lg font-black font-mono text-[#10B981] mt-1">
                    {(reconciliationResult.top_candidate.identifier_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] mt-0.5 truncate">
                    {reconciliationResult.top_candidate.context_signals?.identifier_match || 'Aligned'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">
                    3. Discipline ({Math.round((reconciliationResult.weights_used?.discipline_weight || 0.15) * 100)}%)
                  </div>
                  <div className="text-lg font-black font-mono text-[#3B82F6] mt-1">
                    {(reconciliationResult.top_candidate.discipline_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] mt-0.5 truncate">
                    {reconciliationResult.top_candidate.discipline || 'Standard'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">
                    4. Location ({Math.round((reconciliationResult.weights_used?.location_weight || 0.10) * 100)}%)
                  </div>
                  <div className="text-lg font-black font-mono text-[#F59E0B] mt-1">
                    {(reconciliationResult.top_candidate.location_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] mt-0.5 truncate">
                    {reconciliationResult.top_candidate.location || 'Global'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">
                    5. WBS Context ({Math.round((reconciliationResult.weights_used?.wbs_weight || 0.10) * 100)}%)
                  </div>
                  <div className="text-lg font-black font-mono text-[#A855F7] mt-1">
                    {(reconciliationResult.top_candidate.wbs_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] mt-0.5 truncate">
                    {reconciliationResult.top_candidate.wbs_code || 'L5'}
                  </div>
                </div>

                <div className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                  <div className="text-[10px] text-[#A3A3A3] uppercase font-bold tracking-wider">
                    6. Temporal ({Math.round((reconciliationResult.weights_used?.temporal_weight || 0.05) * 100)}%)
                  </div>
                  <div className="text-lg font-black font-mono text-[#EC4899] mt-1">
                    {(reconciliationResult.top_candidate.temporal_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] mt-0.5 truncate">
                    {reconciliationResult.top_candidate.context_signals?.temporal_alignment || 'Aligned'}
                  </div>
                </div>
              </div>

              {/* Explainability Reasoning & Risk Diagnostics */}
              <div className="space-y-2.5">
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3.5 text-xs text-[#EAEAEA] flex items-start gap-3">
                  <div className="p-1 bg-[#D4AF37]/10 rounded border border-[#D4AF37]/20 shrink-0 mt-0.5">
                    <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </div>
                  <div>
                    <strong className="text-[#D4AF37] font-semibold">Explainable Reconciliation Reason: </strong>
                    <span className="text-[#A3A3A3]">{reconciliationResult.top_candidate.reasoning}</span>
                  </div>
                </div>

                {reconciliationResult.top_candidate.conflicting_signals?.length > 0 && (
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3.5 text-xs text-[#EF4444] flex items-start gap-3">
                    <div className="p-1 bg-[#EF4444]/20 rounded shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                    </div>
                    <div>
                      <strong className="text-[#EF4444] font-semibold">Conflicting Signals Detected: </strong>
                      <span>{reconciliationResult.top_candidate.conflicting_signals.join("; ")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-card p-10 text-center text-[#A3A3A3] space-y-2">
              <AlertCircle className="w-8 h-8 text-[#F59E0B] mx-auto" />
              <div className="text-sm font-bold text-[#EAEAEA]">No Matching Activities Found</div>
              <p className="text-xs text-[#A3A3A3]">
                Ensure a project schedule has been ingested for <span className="font-mono text-[#D4AF37]">{projectId}</span>.
              </p>
            </div>
          )}

          {/* Alternative Candidates Table (Ranks #2 - #K) */}
          {reconciliationResult.alternative_candidates && reconciliationResult.alternative_candidates.length > 0 && (
            <div className="panel-card overflow-hidden">
              <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA]">
                    Alternative Ranked Candidates (Ranks #2 – #{reconciliationResult.total_candidates})
                  </h3>
                  <p className="text-[11px] text-[#A3A3A3] mt-0.5">
                    Ranked by multi-signal weighted confidence score
                  </p>
                </div>
                <span className="text-xs text-[#D4AF37] font-mono font-bold bg-[#D4AF37]/10 px-2.5 py-1 rounded border border-[#D4AF37]/20">
                  {reconciliationResult.alternative_candidates.length} Alternatives
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A0A0A] text-[#A3A3A3] uppercase text-[10px] tracking-wider border-b border-[#2A2A2A]">
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
                  <tbody className="divide-y divide-[#2A2A2A] text-[#EAEAEA]">
                    {reconciliationResult.alternative_candidates.map((cand) => (
                      <tr key={cand.id || cand.activity_id} className="hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4 font-bold text-[#A3A3A3] font-mono">
                          #{cand.rank}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#D4AF37]">
                          {cand.activity_id}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#EAEAEA] max-w-xs truncate" title={cand.activity_name}>
                          {cand.activity_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[#0A0A0A] text-[#A3A3A3] border border-[#2A2A2A] rounded text-[10px] font-medium">
                            {cand.discipline || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#A3A3A3]">
                          {cand.location || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#D4AF37]">
                          {(cand.semantic_score * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 font-mono text-[#10B981]">
                          {(cand.identifier_score * 100).toFixed(0)}%
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${
                          cand.confidence_tier === 'HIGH' ? 'text-[#10B981]' :
                          cand.confidence_tier === 'MEDIUM' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                        }`}>
                          {(cand.final_confidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cand.confidence_tier === 'HIGH' ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30' :
                            cand.confidence_tier === 'MEDIUM' ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30' :
                            'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
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

