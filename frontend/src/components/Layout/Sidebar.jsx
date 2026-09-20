import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  FileText, 
  GitMerge, 
  UserCheck, 
  CheckSquare, 
  ShieldCheck,
  Gauge,
  HelpCircle,
  ChevronRight,
  Cpu,
  Layers,
  Sparkles,
  Sliders
} from 'lucide-react';
import { PERSONAS } from '../../utils/roles';

export const ALL_NAV_ITEMS = [
  { id: 'field-reports', label: 'Field Evidence', icon: FileText, desc: 'DPR & Supervisor Ingestion' },
  { id: 'planner-review', label: 'Planner Review', icon: UserCheck, desc: 'Human-in-the-Loop Validation', badge: '3' },
  { id: 'reconciliation', label: 'Reconciliation', icon: GitMerge, desc: 'Context-Aware Match Engine' },
  { id: 'schedule', label: 'Schedule (L5/L6)', icon: CalendarRange, desc: 'Dynamic Schedule Ingestion' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Progress & Variance S-Curve' },
  { id: 'execution-state', label: 'Execution State', icon: CheckSquare, desc: 'Verified Cumulative Progress' },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck, desc: 'Immutable Governance Ledger' },
  { id: 'evaluation', label: 'Evaluation Benchmarks', icon: Gauge, desc: 'Precision & Recall Suite' },
];

export default function Sidebar({ 
  activeTab, 
  onSelectTab, 
  pendingReviewCount = 3,
  currentPersona = 'PLANNER'
}) {
  const personaConfig = PERSONAS[currentPersona] || PERSONAS.PLANNER;
  const allowedTabs = personaConfig.allowedTabs || [];

  // Filter NAV_ITEMS according to the persona's allowed tabs, preserving persona order
  const filteredNavItems = allowedTabs
    .map(tabId => ALL_NAV_ITEMS.find(item => item.id === tabId))
    .filter(Boolean);

  return (
    <aside className="w-64 border-r border-[#2A2A2A] bg-[#111111] flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      {/* Top Section: Workspace Persona Header & Navigation Items */}
      <div className="p-3 space-y-2 overflow-y-auto">
        {/* Active Persona Workspace Card */}
        <div className="p-3 rounded-xl bg-[#171717] border border-[#2A2A2A] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
              Active Persona
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${personaConfig.badgeClass}`}>
              {personaConfig.actionTag}
            </span>
          </div>
          <div className="text-sm font-extrabold text-[#EAEAEA] tracking-tight">
            {personaConfig.workspaceTitle}
          </div>
          <div className="text-[11px] text-[#A3A3A3] leading-tight">
            {personaConfig.subTitle}
          </div>
        </div>

        {/* Navigation Section Title */}
        <div className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] flex items-center justify-between">
          <span>Target Workflows</span>
          <span className="text-[10px] font-mono text-[#666666]">
            {filteredNavItems.length} {filteredNavItems.length === 1 ? 'view' : 'views'}
          </span>
        </div>
        
        {/* Render Filtered Nav Items */}
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isReview = item.id === 'planner-review';

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                  isActive
                    ? personaConfig.activeTabClass
                    : 'text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-[#EAEAEA]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-[#0A0A0A]' : 'text-[#A3A3A3] group-hover:text-[#D4AF37]'
                  }`} />
                  <span className="tracking-tight">{item.label}</span>
                </div>

                {isReview && pendingReviewCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive 
                      ? 'bg-[#0A0A0A]/20 text-[#0A0A0A]' 
                      : 'bg-[#D4AF37]/15 text-[#F4D06F] border border-[#D4AF37]/40'
                  }`}>
                    {pendingReviewCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Persona Role Guidance & System Footer Info */}
      <div className="p-3.5 border-t border-[#2A2A2A] bg-[#0A0A0A] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#A3A3A3] font-medium text-[11px]">Engine Status</span>
          <span className="font-mono text-[10px] text-[#10B981] flex items-center gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            AI + Deterministic
          </span>
        </div>
        <div className="text-[10px] text-[#A3A3A3] leading-relaxed border-l-2 pl-2" style={{ borderColor: personaConfig.color }}>
          {personaConfig.description}
        </div>
      </div>
    </aside>
  );
}
