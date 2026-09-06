import React from 'react';
import { 
  Building2, 
  Layers, 
  Activity, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';

export default function Navbar({ 
  systemStatus, 
  activeProject, 
  projectsList = [],
  onSelectProject,
  onOpenConfig, 
  onLoadDemo 
}) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Project Context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-brand-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">InfraRecon <span className="text-brand-400">AI</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-brand-950 text-brand-400 border border-brand-800/60 rounded">
                SIH 2026 • PS 26122
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Planning-to-Execution Intelligence Bridge</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden md:block" />

        {/* Active Project & Version Indicator */}
        <div className="hidden lg:flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs">
          <Building2 className="w-3.5 h-3.5 text-brand-400" />
          {projectsList && projectsList.length > 0 ? (
            <select
              value={activeProject?.id}
              onChange={(e) => {
                const found = projectsList.find(p => p.id === e.target.value);
                if (found && onSelectProject) {
                  onSelectProject(found);
                }
              }}
              className="bg-transparent text-slate-200 font-semibold text-xs focus:outline-none cursor-pointer"
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.code || p.id} • {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-slate-300 font-medium">{activeProject?.name || "Refinery Expansion Package 4"}</span>
          )}
          <span className="text-slate-500">•</span>
          <span className="text-brand-400 font-mono text-[11px] bg-brand-950/60 border border-brand-800/40 px-1.5 py-0.2 rounded">
            {activeProject?.active_schedule_version || "v1.0"}
          </span>
        </div>
      </div>

      {/* Right Controls: Data Date, Health, Actions */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          <span>Data Date: <strong className="text-slate-200 font-medium">06-Sep-2026</strong></span>
        </div>

        {/* Backend Health Pill */}
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-slate-950/80 border-slate-800">
          {systemStatus?.database_connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-medium">Backend Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-400 font-medium">Connecting...</span>
            </>
          )}
        </div>

        {/* Quick Demo Loader & Config Modals */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onLoadDemo}
            className="btn-outline border-brand-700/60 hover:border-brand-500 bg-brand-950/40 text-brand-300 hover:text-white"
            title="Load realistic demo test scenarios"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden md:inline">Demo Scenarios</span>
          </button>

          <button 
            onClick={onOpenConfig}
            className="btn-secondary text-xs py-1.5 px-3"
            title="Configure Reconciliation Weights & Confidence Thresholds"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden md:inline">Weights & Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
}
