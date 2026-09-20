export const PERSONAS = {
  SUPERVISOR: {
    id: 'SUPERVISOR',
    label: 'Site Supervisor',
    workspaceTitle: 'Supervisor Workspace',
    subTitle: 'Field Evidence Capture & Status',
    actionTag: 'Capture',
    badgeClass: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
    activeTabClass: 'bg-gradient-to-r from-[#38BDF8] to-[#0284C7] text-[#0A0A0A] shadow-md shadow-[#38BDF8]/25',
    color: '#38BDF8',
    defaultTab: 'field-reports',
    allowedTabs: ['field-reports'],
    description: 'Field Evidence Ingestion, DPR Logging & Real-Time AI Fact Extraction'
  },
  PLANNER: {
    id: 'PLANNER',
    label: 'Construction Planner',
    workspaceTitle: 'Planner Workspace',
    subTitle: 'Reconciliation & Verification Gate',
    actionTag: 'Verify',
    badgeClass: 'bg-[#D4AF37]/15 text-[#F4D06F] border-[#D4AF37]/30',
    activeTabClass: 'bg-gradient-to-r from-[#D4AF37] to-[#F4D06F] text-[#0A0A0A] shadow-md shadow-[#D4AF37]/25',
    color: '#D4AF37',
    defaultTab: 'planner-review',
    allowedTabs: ['planner-review', 'reconciliation', 'schedule', 'execution-state'],
    description: 'Context-Aware 6-Signal Reconciliation, Review Gate & Schedule Baseline'
  },
  LEADERSHIP: {
    id: 'LEADERSHIP',
    label: 'Project Leadership',
    workspaceTitle: 'Executive Workspace',
    subTitle: 'Progress, Delays & Governance Audit',
    actionTag: 'Understand',
    badgeClass: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
    activeTabClass: 'bg-gradient-to-r from-[#10B981] to-[#34D399] text-[#0A0A0A] shadow-md shadow-[#10B981]/25',
    color: '#10B981',
    defaultTab: 'dashboard',
    allowedTabs: ['dashboard', 'execution-state', 'audit', 'evaluation'],
    description: 'S-Curve Performance, Variance Analytics, CPM Risk Chains & Governance Audit'
  }
};

export const normalizeRole = (roleStr) => {
  if (!roleStr) return 'PLANNER';
  const lower = String(roleStr).toLowerCase().trim();
  
  if (lower.includes('supervisor') || lower.includes('foreman') || lower.includes('field') || lower.includes('site')) {
    return 'SUPERVISOR';
  }
  if (lower.includes('planner') || lower.includes('scheduler') || lower.includes('planning')) {
    return 'PLANNER';
  }
  if (lower.includes('director') || lower.includes('executive') || lower.includes('manager') || lower.includes('leadership') || lower.includes('lead') || lower.includes('audit') || lower.includes('qa') || lower.includes('engineer')) {
    return 'LEADERSHIP';
  }
  return 'PLANNER';
};
