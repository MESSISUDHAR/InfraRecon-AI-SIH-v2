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
  Shield,
  LogOut,
  User as UserIcon,
  FileText,
  UserCheck,
  LayoutDashboard,
  X
} from 'lucide-react';
import { useActiveEvent } from '../../context/EventContext';
import { PERSONAS } from '../../utils/roles';

export default function Navbar({ 
  theme = 'dark',
  onToggleTheme,
  systemStatus, 
  activeProject, 
  projectsList = [],
  onSelectProject,
  onOpenConfig, 
  onLoadDemo,
  currentUser = null,
  onLogout,
  currentPersona = 'PLANNER',
  onSelectPersona
}) {
  const { activeEventId, activeEvent, clearActiveEvent } = useActiveEvent();

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'IR';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const activePersonaConfig = PERSONAS[currentPersona] || PERSONAS.PLANNER;

  return (
    <header className="h-16 border-b border-[#2A2A2A] bg-[#111111] backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Project Context */}
      <div className="flex items-center gap-4 xl:gap-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D4AF37] to-[#F4D06F] p-0.5 flex items-center justify-center shadow-lg shadow-[#D4AF37]/15 shrink-0">
            <div className="w-full h-full bg-[#0A0A0A] rounded-[10px] flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#D4AF37]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#EAEAEA]">
                InfraRecon <span className="text-[#D4AF37]">AI</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded hidden sm:inline-block">
                SIH 2026 • PS 26122
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#A3A3A3] font-medium hidden md:block leading-none mt-0.5">
              Planning-to-Execution Intelligence
            </p>
          </div>
        </div>

        <div className="h-6 w-px bg-[#2A2A2A] hidden lg:block" />

        {/* Active Project & Version Indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-xs">
          <Building2 className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
          {projectsList && projectsList.length > 0 ? (
            <select
              value={activeProject?.id}
              onChange={(e) => {
                const found = projectsList.find(p => p.id === e.target.value);
                if (found && onSelectProject) {
                  onSelectProject(found);
                }
              }}
              className="bg-transparent text-[#EAEAEA] font-semibold text-xs focus:outline-none cursor-pointer max-w-[160px] truncate"
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#111111] text-[#EAEAEA]">
                  {p.code || p.id} • {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[#EAEAEA] font-medium max-w-[160px] truncate">{activeProject?.name || "Refinery Package 4"}</span>
          )}
          <span className="text-[#A3A3A3]">•</span>
          <span className="text-[#D4AF37] font-mono text-[10px] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-1 py-0.5 rounded font-semibold">
            {activeProject?.active_schedule_version || "v1.0"}
          </span>
        </div>

        {/* Active Execution Event Indicator */}
        {activeEventId && (
          <div className="hidden 2xl:flex items-center gap-2 bg-[#1A1A1A] border border-[#D4AF37]/40 shadow-sm rounded-lg px-2.5 py-1 text-xs text-[#EAEAEA]">
            <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
            <div className="flex items-center gap-1.5">
              <span className="text-[#A3A3A3] text-[11px]">Event:</span>
              <span className="font-mono font-bold text-[#F4D06F] text-xs">
                {activeEvent?.source_id || activeEventId}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                activeEvent?.status === 'VERIFIED'
                  ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                  : activeEvent?.status === 'EXTRACTED'
                    ? 'bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/30'
                    : 'bg-[#D4AF37]/15 text-[#F4D06F] border-[#D4AF37]/30'
              }`}>
                {activeEvent?.status || 'INGESTED'}
              </span>
            </div>
            <button
              onClick={clearActiveEvent}
              className="ml-0.5 text-[#A3A3A3] hover:text-white p-0.5 rounded"
              title="Clear active event focus"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Center Segmented Persona Switcher (Demo View Switcher) */}
      <div className="flex items-center bg-[#141414] border border-[#2A2A2A] p-1 rounded-xl shadow-inner">
        <div className="flex items-center gap-1">
          {/* Persona: SUPERVISOR */}
          <button
            type="button"
            id="persona-switcher-supervisor"
            onClick={() => onSelectPersona && onSelectPersona('SUPERVISOR')}
            title="Supervisor Persona: Field Evidence Ingestion & DPR Logging (Capture)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentPersona === 'SUPERVISOR'
                ? 'bg-[#38BDF8] text-[#0A0A0A] shadow-md shadow-[#38BDF8]/20 font-extrabold'
                : 'text-[#A3A3A3] hover:text-[#38BDF8] hover:bg-[#1C1C1C]'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${currentPersona === 'SUPERVISOR' ? 'text-[#0A0A0A]' : 'text-[#38BDF8]'}`} />
            <span>Supervisor</span>
            <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${
              currentPersona === 'SUPERVISOR'
                ? 'bg-[#0A0A0A]/20 text-[#0A0A0A] font-black'
                : 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30'
            }`}>
              Capture
            </span>
          </button>

          {/* Persona: PLANNER */}
          <button
            type="button"
            id="persona-switcher-planner"
            onClick={() => onSelectPersona && onSelectPersona('PLANNER')}
            title="Planner Persona: 6-Signal Reconciliation, Review Gate & Verification (Verify)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentPersona === 'PLANNER'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#F4D06F] text-[#0A0A0A] shadow-md shadow-[#D4AF37]/20 font-extrabold'
                : 'text-[#A3A3A3] hover:text-[#F4D06F] hover:bg-[#1C1C1C]'
            }`}
          >
            <UserCheck className={`w-3.5 h-3.5 ${currentPersona === 'PLANNER' ? 'text-[#0A0A0A]' : 'text-[#D4AF37]'}`} />
            <span>Planner</span>
            <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${
              currentPersona === 'PLANNER'
                ? 'bg-[#0A0A0A]/20 text-[#0A0A0A] font-black'
                : 'bg-[#D4AF37]/10 text-[#F4D06F] border border-[#D4AF37]/30'
            }`}>
              Verify
            </span>
          </button>

          {/* Persona: LEADERSHIP */}
          <button
            type="button"
            id="persona-switcher-leadership"
            onClick={() => onSelectPersona && onSelectPersona('LEADERSHIP')}
            title="Leadership Persona: S-Curve Progress, Delays, Variance & Audit (Understand)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentPersona === 'LEADERSHIP'
                ? 'bg-[#10B981] text-[#0A0A0A] shadow-md shadow-[#10B981]/20 font-extrabold'
                : 'text-[#A3A3A3] hover:text-[#10B981] hover:bg-[#1C1C1C]'
            }`}
          >
            <LayoutDashboard className={`w-3.5 h-3.5 ${currentPersona === 'LEADERSHIP' ? 'text-[#0A0A0A]' : 'text-[#10B981]'}`} />
            <span className="hidden sm:inline">Leadership</span>
            <span className="sm:hidden">Director</span>
            <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${
              currentPersona === 'LEADERSHIP'
                ? 'bg-[#0A0A0A]/20 text-[#0A0A0A] font-black'
                : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
            }`}>
              Understand
            </span>
          </button>
        </div>
      </div>

      {/* Right Controls: Health, Actions, Theme Toggle, User Profile & Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Backend Health Pill */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-[#0A0A0A] border-[#2A2A2A]">
          {systemStatus?.database_connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[#10B981] font-semibold text-[11px]">Backend Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
              <span className="text-[#F59E0B] font-semibold text-[11px]">Connecting...</span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#222222] hover:border-[#D4AF37]/50 text-[#EAEAEA] shadow-sm"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="theme-toggle-button"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#F4D06F]" />
                <span className="hidden lg:inline text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden lg:inline text-[11px]">Dark</span>
              </>
            )}
          </button>

          <button 
            onClick={onLoadDemo}
            className="btn-outline border-[#D4AF37]/40 hover:border-[#D4AF37] bg-[#D4AF37]/5 text-[#F4D06F] hover:text-[#FFD700] text-xs py-1.5 px-2.5 hidden md:flex items-center gap-1"
            title="Load realistic demo test scenarios"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden xl:inline text-[11px]">Demo Scenarios</span>
          </button>

          <button 
            onClick={onOpenConfig}
            className="btn-secondary text-xs py-1.5 px-2.5 hidden md:flex items-center gap-1"
            title="Configure Reconciliation Weights & Confidence Thresholds"
          >
            <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden xl:inline text-[11px]">Weights</span>
          </button>

          {/* User Account / Session Controls */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#2A2A2A]">
              <div 
                className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37]/40 rounded-lg px-2 py-1 transition-all"
                title={`Logged in as ${currentUser.email} (${currentUser.role || 'User'})`}
              >
                <div 
                  className="w-6 h-6 rounded-md text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: activePersonaConfig.color,
                    boxShadow: `0 0 8px ${activePersonaConfig.color}40`
                  }}
                >
                  {getInitials(currentUser.full_name)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-[#EAEAEA] leading-tight truncate max-w-[100px]">
                    {currentUser.full_name}
                  </div>
                  <div className="text-[10px] font-mono leading-none truncate max-w-[100px]" style={{ color: activePersonaConfig.color }}>
                    {currentUser.role || activePersonaConfig.label}
                  </div>
                </div>
              </div>

              <button
                id="navbar-logout-button"
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] transition-all"
                title="Log out of application"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
