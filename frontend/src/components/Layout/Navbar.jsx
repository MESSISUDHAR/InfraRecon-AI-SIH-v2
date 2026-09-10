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
  User as UserIcon
} from 'lucide-react';

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
  onLogout
}) {
  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return 'IR';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

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

      {/* Right Controls: Data Date, Health, Actions, User Profile & Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden xl:flex items-center gap-2 text-xs text-[#A3A3A3] bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1.5 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Data Date: <strong className="text-[#EAEAEA] font-medium">06-Sep-2026</strong></span>
        </div>

        {/* Backend Health Pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-[#0A0A0A] border-[#2A2A2A]">
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#222222] hover:border-[#D4AF37]/50 text-[#EAEAEA] shadow-sm"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="theme-toggle-button"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#F4D06F]" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </button>

          <button 
            onClick={onLoadDemo}
            className="btn-outline border-[#D4AF37]/40 hover:border-[#D4AF37] bg-[#D4AF37]/5 text-[#F4D06F] hover:text-[#FFD700]"
            title="Load realistic demo test scenarios"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden lg:inline">Demo Scenarios</span>
          </button>

          <button 
            onClick={onOpenConfig}
            className="btn-secondary text-xs py-1.5 px-3"
            title="Configure Reconciliation Weights & Confidence Thresholds"
          >
            <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden lg:inline">Weights & Rules</span>
          </button>

          {/* User Account / Session Controls */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#2A2A2A]">
              <div 
                className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#D4AF37]/40 rounded-lg px-2.5 py-1 transition-all"
                title={`Logged in as ${currentUser.email}`}
              >
                <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-[#D4AF37] to-[#F4D06F] text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center shrink-0">
                  {getInitials(currentUser.full_name)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-[#EAEAEA] leading-tight truncate max-w-[110px]">
                    {currentUser.full_name}
                  </div>
                  <div className="text-[10px] text-[#A3A3A3] leading-none truncate max-w-[110px]">
                    {currentUser.role || "Engineer"}
                  </div>
                </div>
              </div>

              <button
                id="navbar-logout-button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] transition-all"
                title="Log out of application"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
