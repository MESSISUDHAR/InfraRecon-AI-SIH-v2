import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Send, 
  Sparkles, 
  Upload, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Cpu,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  Calendar,
  User,
  Tag,
  FileCode,
  ShieldCheck,
  X,
  PlusCircle,
  FileSpreadsheet,
  ArrowRight,
  Zap,
  Check,
  CheckCheck
} from 'lucide-react';
import { 
  submitExecutionEvent, 
  uploadExecutionFile, 
  getExecutionEvents, 
  deleteExecutionEvent,
  extractExecutionEvent,
  extractEventById
} from '../services/api';

export const SAMPLE_DPRS = [
  {
    id: 1,
    title: "Scenario 1: High Confidence Exact Spool Match",
    sourceId: "DPR-2026-09-06-01",
    sourceType: "DPR_TEXT",
    reporter: "Supervisor Sharma (Piping)",
    text: "Yesterday evening the 24-inch spool erection at PR-04 was completed. Line 24-XX was inspected."
  },
  {
    id: 2,
    title: "Scenario 2: Wording Variation & Site Jargon",
    sourceId: "DPR-2026-09-06-02",
    sourceType: "SITE_DIARY",
    reporter: "Civil Foreman Kumar",
    text: "Laying of 500mm underground drainage conduit in Zone 3 completed today by civil team."
  },
  {
    id: 3,
    title: "Scenario 3: Missing Asset ID (Strong Location Match)",
    sourceId: "DPR-2026-09-06-03",
    sourceType: "SUPERVISOR_LOG",
    reporter: "Site Engineer Alex",
    text: "Finished foundation concrete pouring at Compressor Bay 2. 45 cubic meters placed."
  },
  {
    id: 4,
    title: "Scenario 4: Ambiguous Candidates (Triggers Planner Review)",
    sourceId: "DPR-2026-09-06-04",
    sourceType: "INSPECTION_NOTE",
    reporter: "Electrical QA Inspector Anita",
    text: "Cable tray installation started on Level 2 today."
  },
  {
    id: 5,
    title: "Scenario 5: Multi-Day Progress Observation",
    sourceId: "DPR-2026-09-06-05",
    sourceType: "DPR_TEXT",
    reporter: "Piping Lead Raman",
    text: "Spool installation at PR-04 progressed to 75% today. Final bolt-up underway."
  }
];

export default function FieldReportsPage({ onNavigate, initialProjectId = 'PRJ-REF-04' }) {
  // Active Project State
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectsList, setProjectsList] = useState([]);
  
  // Form State
  const [inputText, setInputText] = useState(SAMPLE_DPRS[0].text);
  const [sourceId, setSourceId] = useState(SAMPLE_DPRS[0].sourceId);
  const [sourceType, setSourceType] = useState(SAMPLE_DPRS[0].sourceType);
  const [reporterName, setReporterName] = useState(SAMPLE_DPRS[0].reporter);
  const [sourceReference, setSourceReference] = useState('Daily Site Log Book #12');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedPreset, setSelectedPreset] = useState(1);

  // Extraction State
  const [extractedResult, setExtractedResult] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Load project list once
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const prjs = await getProjects();
        if (Array.isArray(prjs)) {
          setProjectsList(prjs);
        }
      } catch (err) {
        console.warn('Failed to load projects list in field reports page:', err);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Submitted Reports State
  const [reports, setReports] = useState([]);
  const [totalReports, setTotalReports] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSourceType, setFilterSourceType] = useState('ALL');
  const [viewingReport, setViewingReport] = useState(null);
  const [rowExtractingId, setRowExtractingId] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch Submitted Reports
  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const params = {
        project_id: projectId,
        page: 1,
        page_size: 50
      };
      if (filterSourceType !== 'ALL') {
        params.source_type = filterSourceType;
      }
      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await getExecutionEvents(params);
      setReports(res.events || []);
      setTotalReports(res.total || 0);
    } catch (err) {
      console.error('Failed to load field reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [projectId, filterSourceType, filterStatus, searchTerm]);

  // Handle Preset Quick Selection
  const handleSelectPreset = (sample) => {
    setSelectedPreset(sample.id);
    setInputText(sample.text);
    setSourceId(sample.sourceId);
    setSourceType(sample.sourceType);
    setReporterName(sample.reporter);
    setExtractedResult(null);
  };

  // Run Gemini 2.5 Flash Extraction
  const handleRunGeminiExtraction = async (saveToDb = true) => {
    if (!inputText.trim()) {
      setFeedback({ type: 'error', message: 'Please enter field report text to extract.' });
      return;
    }

    setExtracting(true);
    setFeedback(null);
    try {
      const payload = {
        raw_text: inputText.trim(),
        project_id: projectId,
        source_id: sourceId.trim() || undefined,
        source_type: sourceType,
        reporter_name: reporterName.trim() || undefined,
        report_date: reportDate ? new Date(reportDate).toISOString() : new Date().toISOString(),
        save_to_db: saveToDb
      };

      const res = await extractExecutionEvent(payload);
      if (res.success) {
        setExtractedResult(res);
        setFeedback({
          type: 'success',
          message: `Gemini 2.5 Flash extracted facts in ${res.execution_time_ms}ms with ${(res.extracted_data.extraction_confidence * 100).toFixed(0)}% confidence.`
        });
        if (saveToDb) {
          fetchReports();
        }
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Gemini extraction failed.'
      });
    } finally {
      setExtracting(false);
    }
  };

  // Submit Text Field Report (Ingest Only)
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) {
      setFeedback({ type: 'error', message: 'Field report text cannot be empty.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        project_id: projectId,
        raw_text: inputText.trim(),
        source_id: sourceId.trim() || undefined,
        source_type: sourceType,
        source_reference: sourceReference.trim() || undefined,
        reporter_name: reporterName.trim() || undefined,
        report_date: reportDate ? new Date(reportDate).toISOString() : new Date().toISOString()
      };

      const res = await submitExecutionEvent(payload);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Evidence successfully ingested with ID: ${res.event.source_id}. Status: INGESTED.`
        });
        const nextId = `DPR-${new Date().toISOString().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`;
        setSourceId(nextId);
        fetchReports();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to submit field report.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Extract a specific ingested event by row
  const handleExtractRow = async (eventId) => {
    setRowExtractingId(eventId);
    try {
      const res = await extractEventById(eventId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Event extracted successfully! Discipline: ${res.extracted_data.discipline}, Location: ${res.extracted_data.location || 'N/A'}.`
        });
        fetchReports();
      }
    } catch (err) {
      alert('Extraction failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRowExtractingId(null);
    }
  };

  // Upload DPR File (.txt, .log, .csv, .dpr, .md)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', projectId);
      formData.append('source_type', file.name.endsWith('.csv') ? 'CSV_BATCH' : 'FILE_UPLOAD');
      formData.append('reporter_name', reporterName || 'File Upload');
      if (reportDate) {
        formData.append('report_date', new Date(reportDate).toISOString());
      }

      const res = await uploadExecutionFile(formData);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `File "${file.name}" ingested successfully! ${res.count} raw evidence observation(s) saved.`
        });
        fetchReports();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'File upload failed.'
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete an ingested report
  const handleDeleteReport = async (eventId) => {
    if (!window.confirm('Delete this ingested evidence report?')) return;
    try {
      await deleteExecutionEvent(eventId);
      fetchReports();
    } catch (err) {
      alert('Failed to delete report: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Field Evidence & Structured Extraction</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-brand-400" />
              <span>Milestone 4: Gemini 2.5 Flash Layer</span>
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Grounded LLM entity extraction transforming messy DPRs and supervisor notes into validated Pydantic <code className="text-cyan-300 font-mono">ExecutionEvent</code> objects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg">
            <span>Project:</span>
            {projectsList.length > 0 ? (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
              >
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.code || p.id} - {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-white font-bold">{projectId}</span>
            )}
          </div>

          <label className="btn-secondary cursor-pointer text-xs flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-brand-400" />
            <span>{uploading ? 'Ingesting File...' : 'Upload DPR / Log File'}</span>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".txt,.csv,.log,.dpr,.md" 
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden" 
            />
          </label>
          <button 
            onClick={fetchReports} 
            className="btn-outline"
            title="Refresh reports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Total Field Evidence</div>
            <div className="text-xl font-bold text-white">{totalReports}</div>
          </div>
        </div>

        <div className="panel-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Extraction Model</div>
            <div className="text-xs font-semibold text-cyan-300 font-mono">Gemini 2.5 Flash</div>
          </div>
        </div>

        <div className="panel-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Hallucination Policy</div>
            <div className="text-xs font-semibold text-emerald-400">Zero Inventions / Grounded</div>
          </div>
        </div>

        <div className="panel-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Database Protection</div>
            <div className="text-xs font-semibold text-purple-300">ExecutionState Isolated</div>
          </div>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Select Test Field Report Scenario (Loads Realistic Observation):</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
          {SAMPLE_DPRS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectPreset(sample)}
              className={`text-left p-3 rounded-lg border text-xs transition-all ${
                selectedPreset === sample.id
                  ? 'bg-brand-950/60 border-brand-500 text-white shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold truncate">{sample.title}</div>
              <div className="text-[11px] text-brand-400 font-mono mt-0.5">{sample.sourceId}</div>
              <div className="text-[11px] text-slate-500 truncate mt-1">{sample.text}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-lg text-xs border flex items-center justify-between gap-3 ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Extraction Workspace (Raw Input -> Gemini Extraction -> Structured Schema) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Raw Field Report Entry */}
        <div className="panel-card p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <span>1. Raw Field Report / DPR Entry</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">Stage: Raw Observation</span>
            </div>

            {/* Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">Source ID</label>
                <input
                  type="text"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  placeholder="e.g. DPR-2026-09-06-01"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                >
                  <option value="DPR_TEXT">DPR_TEXT (Daily Progress)</option>
                  <option value="SITE_DIARY">SITE_DIARY (Site Diary)</option>
                  <option value="SUPERVISOR_LOG">SUPERVISOR_LOG (Supervisor)</option>
                  <option value="INSPECTION_NOTE">INSPECTION_NOTE (QA/QC)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">Reporter</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="e.g. Supervisor Sharma"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">Observation Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                <span>Raw Text Content:</span>
                <span className="text-[10px] text-slate-500">Grounded facts only</span>
              </label>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste raw unstructured field execution report text here..."
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={submitting || !inputText.trim()}
              className="btn-secondary text-xs w-full sm:w-auto"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{submitting ? 'Ingesting...' : 'Ingest as Raw Evidence'}</span>
            </button>

            <button 
              type="button"
              onClick={() => handleRunGeminiExtraction(true)}
              disabled={extracting || !inputText.trim()}
              className="btn-primary text-xs w-full sm:w-auto"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${extracting ? 'animate-spin' : ''}`} />
              <span>{extracting ? 'Extracting via Gemini...' : 'Run Gemini 2.5 Flash Extraction'}</span>
            </button>
          </div>
        </div>

        {/* Right Card: Extracted Structured ExecutionEvent Visualizer */}
        <div className="panel-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>2. Extracted ExecutionEvent (Pydantic Schema)</span>
            </h2>
            {extractedResult ? (
              <span className="badge-high flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Confidence: {(extractedResult.extracted_data.extraction_confidence * 100).toFixed(0)}%</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-mono">Awaiting Extraction</span>
            )}
          </div>

          {extractedResult ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Top extraction KPI strip */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Discipline</div>
                  <div className="font-semibold text-brand-300">{extractedResult.extracted_data.discipline || 'General'}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Location</div>
                  <div className="font-semibold text-emerald-300 truncate">{extractedResult.extracted_data.location || '—'}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Event Progress</div>
                  <div className="font-semibold text-amber-300 font-mono">
                    {extractedResult.extracted_data.progress !== null ? `${extractedResult.extracted_data.progress}%` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Structured Schema Breakdown */}
              <div className="bg-slate-950/90 rounded-lg border border-slate-800 p-3.5 space-y-2 text-xs font-mono">
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">activity_description:</span>
                  <span className="col-span-2 text-cyan-300 font-semibold">{extractedResult.extracted_data.activity_description}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">line_id:</span>
                  <span className="col-span-2 text-amber-300 font-semibold">
                    {extractedResult.extracted_data.line_id || <span className="text-slate-600 font-normal italic">null (Grounded Null)</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">asset_id:</span>
                  <span className="col-span-2 text-amber-300 font-semibold">
                    {extractedResult.extracted_data.asset_id || <span className="text-slate-600 font-normal italic">null (Grounded Null)</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">event_type:</span>
                  <span className="col-span-2 text-slate-200 uppercase">{extractedResult.extracted_data.event_type}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">evidence_text:</span>
                  <span className="col-span-2 text-slate-300 italic">"{extractedResult.extracted_data.evidence_text}"</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-slate-400">model_version:</span>
                  <span className="col-span-2 text-slate-400">{extractedResult.model_version} ({extractedResult.execution_time_ms} ms)</span>
                </div>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>*Output validated against Pydantic schema before persistence.</span>
                <span className="text-emerald-400 font-mono">Status: EXTRACTED</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
              <Cpu className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs text-slate-400 font-medium">No Extraction Generated Yet</div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Click <strong className="text-brand-400">"Run Gemini 2.5 Flash Extraction"</strong> to extract grounded entities from the field text.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submitted Field Reports Table */}
      <div className="panel-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <span>Field Evidence Database Log</span>
              <span className="text-xs text-slate-400 font-normal">({totalReports} records)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Raw and structured field evidence recorded for project <code className="text-brand-300 font-mono">{projectId}</code>.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search raw text / ID..."
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-44"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="INGESTED">INGESTED (Raw Only)</option>
              <option value="EXTRACTED">EXTRACTED (Structured)</option>
            </select>

            <select
              value={filterSourceType}
              onChange={(e) => setFilterSourceType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Source Types</option>
              <option value="DPR_TEXT">DPR_TEXT</option>
              <option value="SITE_DIARY">SITE_DIARY</option>
              <option value="SUPERVISOR_LOG">SUPERVISOR_LOG</option>
              <option value="INSPECTION_NOTE">INSPECTION_NOTE</option>
              <option value="FILE_UPLOAD">FILE_UPLOAD</option>
              <option value="CSV_BATCH">CSV_BATCH</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loadingReports ? (
          <div className="text-center py-12 text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
            <span>Loading field evidence records...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400 font-medium">No field reports found.</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Select one of the test scenarios above and click "Run Gemini 2.5 Flash Extraction".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Source ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Discipline</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Line / Asset</th>
                  <th className="py-2.5 px-3">Raw Evidence Text</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-cyan-300 whitespace-nowrap">
                      {report.source_id || report.id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {report.report_date ? new Date(report.report_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {report.discipline ? (
                        <span className="px-2 py-0.5 rounded bg-brand-950/60 border border-brand-700/60 text-[10px] text-brand-300 font-semibold">
                          {report.discipline}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-emerald-300 text-[11px] font-medium">
                      {report.location || '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-amber-300 text-[11px] font-mono">
                      {report.line_id || report.asset_id || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate font-sans" title={report.raw_text}>
                      {report.raw_text}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        report.status === 'EXTRACTED'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {report.status === 'INGESTED' && (
                          <button
                            onClick={() => handleExtractRow(report.id)}
                            disabled={rowExtractingId === report.id}
                            className="px-2 py-0.5 rounded bg-brand-600/20 hover:bg-brand-600/40 text-brand-300 border border-brand-500/30 text-[10px] font-medium flex items-center gap-1"
                            title="Extract structured facts via Gemini"
                          >
                            <Sparkles className={`w-3 h-3 ${rowExtractingId === report.id ? 'animate-spin' : ''}`} />
                            <span>{rowExtractingId === report.id ? 'Extracting...' : 'Extract'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => setViewingReport(report)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-brand-300 transition-colors"
                          title="View Full Evidence"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Evidence Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raw Evidence Detail Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Execution Evidence Details: {viewingReport.source_id}
                </h3>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Status</span>
                <span className="text-cyan-300 font-semibold">{viewingReport.status}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Discipline</span>
                <span className="text-brand-300 font-semibold">{viewingReport.discipline || 'N/A'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Location</span>
                <span className="text-emerald-300 font-semibold">{viewingReport.location || 'N/A'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">Line / Asset</span>
                <span className="text-amber-300 font-mono font-semibold">{viewingReport.line_id || viewingReport.asset_id || 'null'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400 block">Raw Observation Text:</span>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {viewingReport.raw_text}
              </div>
            </div>

            {viewingReport.activity_description && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-400 block">Extracted Activity Description:</span>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-cyan-200 font-mono">
                  {viewingReport.activity_description}
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-500 bg-slate-950/50 p-2.5 rounded border border-slate-800/80">
              *Lineage Note: Facts extracted via Gemini 2.5 Flash Layer. Matching candidates and multi-signal reconciliation will run in Milestone 6 without modifying verified execution states.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingReport(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
