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
  Cpu
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Progress & Variance S-Curve' },
  { id: 'schedule', label: 'Schedule (L5/L6)', icon: CalendarRange, desc: 'Dynamic Schedule Ingestion' },
  { id: 'field-reports', label: 'Field Evidence', icon: FileText, desc: 'DPR & Supervisor Ingestion' },
  { id: 'reconciliation', label: 'Reconciliation', icon: GitMerge, desc: 'Context-Aware Match Engine' },
  { id: 'planner-review', label: 'Planner Review', icon: UserCheck, desc: 'Human-in-the-Loop Validation', badge: '3' },
  { id: 'execution-state', label: 'Execution State', icon: CheckSquare, desc: 'Verified Cumulative Progress' },
  { id: 'evaluation', label: 'Evaluation Benchmarks', icon: Gauge, desc: 'Precision & Recall Suite' },
];

export default function Sidebar({ activeTab, onSelectTab, pendingReviewCount = 3 }) {
  return (
    <aside className="w-64 border-r border-[#2A2A2A] bg-[#111111] flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      {/* Navigation Tabs */}
      <div className="p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] flex items-center justify-between">
          <span>Core Workflows</span>
        </div>
        
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isReview = item.id === 'planner-review';

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F4D06F] text-[#0A0A0A] shadow-md shadow-[#D4AF37]/25'
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

      {/* System Footer Info */}
      <div className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#A3A3A3] font-medium">Engine Status</span>
          <span className="font-mono text-[11px] text-[#10B981] flex items-center gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            Deterministic + AI
          </span>
        </div>
        <div className="mt-2 text-[11px] text-[#A3A3A3] leading-relaxed border-l-2 border-[#D4AF37]/40 pl-2">
          Rule: AI extracts events; context engine matches schedule; planner verifies state.
        </div>
      </div>
    </aside>
  );
}
