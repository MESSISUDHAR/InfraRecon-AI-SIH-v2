import React from 'react';
import { 
  Building2, 
  Layers, 
  Activity, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sun,
  Moon,
  Shield
} from 'lucide-react';

export default function Navbar({ 
  theme = 'dark',
  onToggleTheme,
  systemStatus, 
  activeProject, 
  projectsList = [],
  onSelectProject,
  onOpenConfig, 
  onLoadDemo 
}) {
  return (
    <header className="h-16 border-b border-[#2A2A2A] bg-[#111111] backdrop-blur-md px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Project Context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D4AF37] to-[#F4D06F] p-0.5 flex items-center justify-center shadow-lg shadow-[#D4AF37]/15">
            <div className="w-full h-full bg-[#0A0A0A] rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-[#D4AF37]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#EAEAEA]">InfraRecon <span className="text-[#D4AF37]">AI</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded">
                SIH 2026 • PS 26122
              </span>
            </div>
            <p className="text-[11px] text-[#A3A3A3] font-medium">Planning-to-Execution Intelligence</p>
          </div>
        </div>

        <div className="h-6 w-px bg-[#2A2A2A] hidden md:block" />

        {/* Active Project & Version Indicator */}
        <div className="hidden lg:flex items-center gap-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs">
          <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" />
          {projectsList && projectsList.length > 0 ? (
            <select
              value={activeProject?.id}
              onChange={(e) => {
                const found = projectsList.find(p => p.id === e.target.value);
                if (found && onSelectProject) {
                  onSelectProject(found);
                }
              }}
              className="bg-transparent text-[#EAEAEA] font-semibold text-xs focus:outline-none cursor-pointer"
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#111111] text-[#EAEAEA]">
                  {p.code || p.id} • {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[#EAEAEA] font-medium">{activeProject?.name || "Refinery Expansion Package 4"}</span>
          )}
          <span className="text-[#A3A3A3]">•</span>
          <span className="text-[#D4AF37] font-mono text-[11px] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-1.5 py-0.5 rounded font-semibold">
            {activeProject?.active_schedule_version || "v1.0"}
          </span>
        </div>
      </div>

      {/* Right Controls: Data Date, Health, Actions */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#A3A3A3] bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1.5 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Data Date: <strong className="text-[#EAEAEA] font-medium">06-Sep-2026</strong></span>
        </div>

        {/* Backend Health Pill */}
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-[#0A0A0A] border-[#2A2A2A]">
          {systemStatus?.database_connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[#10B981] font-semibold">Backend Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
              <span className="text-[#F59E0B] font-semibold">Connecting...</span>
            </>
          )}
        </div>

        {/* Quick Demo Loader & Config Modals */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#222222] hover:border-[#D4AF37]/50 text-[#EAEAEA] shadow-sm"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="theme-toggle-button"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#F4D06F]" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button 
            onClick={onLoadDemo}
            className="btn-outline border-[#D4AF37]/40 hover:border-[#D4AF37] bg-[#D4AF37]/5 text-[#F4D06F] hover:text-[#FFD700]"
            title="Load realistic demo test scenarios"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden md:inline">Demo Scenarios</span>
          </button>

          <button 
            onClick={onOpenConfig}
            className="btn-secondary text-xs py-1.5 px-3"
            title="Configure Reconciliation Weights & Confidence Thresholds"
          >
            <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden md:inline">Weights & Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
}
