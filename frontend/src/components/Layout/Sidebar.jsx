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
  ChevronRight
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Progress & Variance S-Curve' },
  { id: 'schedule', label: 'Schedule (L5/L6)', icon: CalendarRange, desc: 'Dynamic Schedule Ingestion' },
  { id: 'field-reports', label: 'Field Evidence', icon: FileText, desc: 'DPR & Supervisor Ingestion' },
  { id: 'reconciliation', label: 'Reconciliation', icon: GitMerge, desc: 'Context-Aware Match Engine' },
  { id: 'planner-review', label: 'Planner Review', icon: UserCheck, desc: 'Human-in-the-Loop Validation', badge: '3' },
  { id: 'execution-state', label: 'Execution State', icon: CheckSquare, desc: 'Verified Cumulative Progress' },
  { id: 'audit', label: 'Evidence & Audit', icon: ShieldCheck, desc: 'Explainable Decision Trail' },
  { id: 'evaluation', label: 'Evaluation Benchmarks', icon: Gauge, desc: 'Precision & Recall Suite' },
];

export default function Sidebar({ activeTab, onSelectTab, pendingReviewCount = 3 }) {
  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      {/* Navigation Tabs */}
      <div className="p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Core Workflows
        </div>
        
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isReview = item.id === 'planner-review';

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-400'
                }`} />
                <span className="tracking-tight">{item.label}</span>
              </div>

              {isReview && pendingReviewCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                }`}>
                  {pendingReviewCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* System Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Engine Status</span>
          <span className="font-mono text-[11px] text-emerald-400">Deterministic + AI</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 leading-tight">
          Rule: AI extracts events; context engine matches schedule; planner verifies state.
        </div>
      </div>
    </aside>
  );
}
