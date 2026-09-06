import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  CalendarRange, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  CheckCircle2, 
  Layers, 
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FolderPlus,
  FileCode,
  Tag
} from 'lucide-react';
import { uploadSchedule, getScheduleActivities, getScheduleSummary } from '../services/api';
import { REFINERY_CSV_CONTENT, METRO_CSV_CONTENT } from '../services/sampleSchedules';

export default function SchedulePage({ onNavigate, initialProjectId = 'PRJ-REF-04', onProjectCreated }) {
  const [activities, setActivities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);

  // Filters & Pagination
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectName, setProjectName] = useState('Refinery Expansion Package 4');
  const [scheduleVersion, setScheduleVersion] = useState('v1.0');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sync initialProjectId prop if changed
  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Load activities & summary on mount or filter change
  const fetchScheduleData = async () => {
    setLoading(true);
    try {
      const actsData = await getScheduleActivities({
        project_id: projectId,
        schedule_version: scheduleVersion,
        discipline: selectedDiscipline !== 'ALL' ? selectedDiscipline : undefined,
        search: searchTerm || undefined,
        page,
        page_size: pageSize
      });

      setActivities(actsData.activities || []);
      setTotalCount(actsData.total || 0);

      const sumData = await getScheduleSummary({ project_id: projectId, schedule_version: scheduleVersion });
      if (sumData.success && sumData.data) {
        setSummary(sumData.data);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [projectId, scheduleVersion, selectedDiscipline, page]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchScheduleData();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleFileUpload = async (file, customProjId = projectId, customProjName = projectName, customVer = scheduleVersion) => {
    setUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', customProjId);
    formData.append('project_name', customProjName);
    formData.append('schedule_version', customVer);

    try {
      const res = await uploadSchedule(formData);
      if (res.success) {
        setUploadFeedback({
          type: 'success',
          message: res.message,
          summary: res.summary,
          warnings: res.warnings || []
        });
        setSummary(res.summary);
        setPage(1);
        fetchScheduleData();
        if (onProjectCreated) {
          onProjectCreated();
        }
      } else {
        setUploadFeedback({
          type: 'error',
          message: res.error || res.message,
          warnings: res.warnings || []
        });
      }
    } catch (err) {
      setUploadFeedback({
        type: 'error',
        message: err.response?.data?.detail || err.message
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleQuickLoad = (type) => {
    if (type === 'refinery') {
      const blob = new Blob([REFINERY_CSV_CONTENT], { type: 'text/csv' });
      const file = new File([blob], 'refinery_expansion_l5.csv', { type: 'text/csv' });
      setProjectId('PRJ-REF-04');
      setProjectName('Refinery Expansion Package 4');
      setScheduleVersion('v1.0');
      handleFileUpload(file, 'PRJ-REF-04', 'Refinery Expansion Package 4', 'v1.0');
    } else if (type === 'metro') {
      const blob = new Blob([METRO_CSV_CONTENT], { type: 'text/csv' });
      const file = new File([blob], 'metro_rail_viaduct_l6.csv', { type: 'text/csv' });
      setProjectId('PRJ-METRO-01');
      setProjectName('Metro Rail Viaduct Package');
      setScheduleVersion('v1.0');
      handleFileUpload(file, 'PRJ-METRO-01', 'Metro Rail Viaduct Package', 'v1.0');
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Project Schedule Management (L5/L6)</span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full font-mono">
              {summary?.active_schedule_version || scheduleVersion}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic ingestion of baseline schedules from CSV/XLSX. Zero hardcoded mappings; automatic column normalization & searchable text generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleQuickLoad('refinery')}
            disabled={uploading}
            className="btn-outline border-cyan-800/60 text-cyan-300 hover:bg-cyan-950/40 text-xs"
            title="Load 15 L5 activities (Piping, Civil, Electrical, Mech, Inst)"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test: Refinery L5 (CSV)</span>
          </button>

          <button
            onClick={() => handleQuickLoad('metro')}
            disabled={uploading}
            className="btn-outline border-purple-800/60 text-purple-300 hover:bg-purple-950/40 text-xs"
            title="Load 6 L6 activities (Civil, Trackwork, OHE, Signalling)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Test: Metro Rail L6</span>
          </button>
        </div>
      </div>

      {/* Upload Zone & Project Association Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dropzone Card */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="panel-card p-6 lg:col-span-2 border-2 border-dashed border-slate-700/80 hover:border-brand-500/80 flex flex-col items-center justify-center text-center space-y-3 relative group cursor-pointer transition-all bg-slate-900/40"
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            disabled={uploading}
          />
          
          <div className="w-12 h-12 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            {uploading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-white">
              {uploading ? "Ingesting & Normalizing Schedule..." : "Upload Project Schedule File"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Drag & drop your <strong className="text-slate-200">.csv</strong> or <strong className="text-slate-200">.xlsx</strong> file here, or click to browse.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Supports P6, MS Project, or custom Excel exports</span>
            <span>•</span>
            <span>Auto-detects fuzzy column names</span>
          </div>
        </div>

        {/* Project Context & Schedule Version Config */}
        <div className="panel-card p-5 space-y-3.5 bg-slate-900/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FolderPlus className="w-3.5 h-3.5 text-brand-400" />
            <span>Target Project & Version</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Project ID / Slug</label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. PRJ-REF-04"
                className="w-full bg-slate-950/70 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Project Display Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Refinery Expansion Unit 4"
                className="w-full bg-slate-950/70 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Schedule Baseline Version</label>
              <input
                type="text"
                value={scheduleVersion}
                onChange={(e) => setScheduleVersion(e.target.value)}
                placeholder="e.g. v1.0"
                className="w-full bg-slate-950/70 border border-slate-800 rounded px-2.5 py-1.5 text-brand-400 font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Feedback & Validation Banner */}
      {uploadFeedback && (
        <div className={`p-4 rounded-xl border text-xs space-y-2 ${
          uploadFeedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              {uploadFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{uploadFeedback.message}</span>
            </div>
            <button onClick={() => setUploadFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>

          {uploadFeedback.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-slate-300">
              <div>File: <strong className="text-white">{uploadFeedback.summary.filename}</strong></div>
              <div>Activities: <strong className="text-emerald-400">{uploadFeedback.summary.total_activities}</strong></div>
              <div>Disciplines: <strong className="text-white">{Object.keys(uploadFeedback.summary.disciplines || {}).length}</strong></div>
              <div>Status: <span className="badge-high text-[10px]">VALIDATED</span></div>
            </div>
          )}

          {uploadFeedback.warnings && uploadFeedback.warnings.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-amber-300/90 space-y-0.5">
              <div className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Warnings:
              </div>
              {uploadFeedback.warnings.map((w, i) => (
                <div key={i} className="pl-4">• {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ingested Schedule Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-brand-500/10 text-brand-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Schedule Version</div>
            <div className="text-sm font-semibold text-white font-mono">
              {summary?.active_schedule_version || scheduleVersion}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[150px]">
              {summary?.project_name || projectName}
            </div>
          </div>
        </div>

        <div className="panel-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Activities</div>
            <div className="text-sm font-semibold text-white font-mono">
              {summary?.total_activities ?? totalCount} Activities
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              Normalized & Validated
            </div>
          </div>
        </div>

        <div className="panel-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Disciplines</div>
            <div className="text-sm font-semibold text-white font-mono">
              {summary?.disciplines ? Object.keys(summary.disciplines).length : 0} Disciplines
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Piping, Civil, Elec, etc.
            </div>
          </div>
        </div>

        <div className="panel-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Searchable Text</div>
            <div className="text-sm font-semibold text-cyan-300">
              Context-Ready
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Ready for SentenceTransformers
            </div>
          </div>
        </div>
      </div>

      {/* Discipline Badges Filter Row */}
      {summary?.disciplines && Object.keys(summary.disciplines).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-medium">Discipline Breakdown:</span>
          <button
            onClick={() => setSelectedDiscipline('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedDiscipline === 'ALL'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          {Object.entries(summary.disciplines).map(([disc, count]) => (
            <button
              key={disc}
              onClick={() => setSelectedDiscipline(disc)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedDiscipline === disc
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {disc} <span className="font-mono text-[10px] opacity-80">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="panel-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Activity ID, Name, Line, Asset, or Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={fetchScheduleData}
            className="btn-outline text-xs"
            title="Refresh Schedule"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <span className="text-xs text-slate-400 font-mono">
            Showing {activities.length} of {totalCount}
          </span>
        </div>
      </div>

      {/* Dynamic Schedule Table */}
      <div className="panel-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Activity Code</th>
                <th className="py-3 px-4">Activity Name / Description</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Discipline</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Asset / Line ID</th>
                <th className="py-3 px-4">Planned Window</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Planned %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-400" />
                    <span>Loading schedule activities...</span>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500">
                    <CalendarRange className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 font-medium">No schedule activities found.</p>
                    <p className="text-xs text-slate-600 mt-1">Upload a schedule CSV/XLSX or click "Test: Refinery L5" above.</p>
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3 px-4 font-mono font-medium text-brand-400 whitespace-nowrap">
                      {act.activity_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-xs">
                      <div>{act.activity_name}</div>
                      {act.wbs_name && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          WBS: {act.wbs_name} {act.wbs_code && `(${act.wbs_code})`}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                        {act.level || 'L5'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded-full text-[11px] text-slate-200">
                        {act.discipline || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {act.location || <span className="text-slate-600 italic">--</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                      {act.line_id && (
                        <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/60 mr-1.5">
                          Line: {act.line_id}
                        </span>
                      )}
                      {act.asset_id && (
                        <span className="text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/60">
                          {act.asset_id}
                        </span>
                      )}
                      {!act.line_id && !act.asset_id && (
                        <span className="text-slate-600 italic">--</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400 font-mono whitespace-nowrap">
                      {act.planned_start ? act.planned_start.slice(0, 10) : '--'} → {act.planned_finish ? act.planned_finish.slice(0, 10) : '--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {act.planned_duration ? `${act.planned_duration}d` : '--'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                      {act.planned_progress}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page {page} of {totalPages} ({totalCount} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
