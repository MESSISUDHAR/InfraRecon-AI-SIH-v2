import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import FieldReportsPage from './pages/FieldReportsPage';
import ReconciliationPage from './pages/ReconciliationPage';
import PlannerReviewPage from './pages/PlannerReviewPage';
import ExecutionStatePage from './pages/ExecutionStatePage';
import AuditPage from './pages/AuditPage';
import EvaluationPage from './pages/EvaluationPage';
import WeightConfigModal from './components/Common/WeightConfigModal';
import { getProjects } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStatus, setSystemStatus] = useState({ database_connected: false });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [demoNotice, setDemoNotice] = useState(null);
  const [projectsList, setProjectsList] = useState([]);

  // Active Project Context
  const [activeProject, setActiveProject] = useState({
    id: "PRJ-REF-04",
    name: "Refinery Expansion Unit 4",
    code: "REF-U4",
    active_schedule_version: "v1.0",
    data_date: "2026-09-06T00:00:00Z"
  });

  const fetchProjects = async () => {
    try {
      const prjs = await getProjects();
      if (Array.isArray(prjs) && prjs.length > 0) {
        setProjectsList(prjs);
        // If current activeProject not found in list, set to first
        const exists = prjs.find(p => p.id === activeProject?.id);
        if (!exists) {
          setActiveProject(prjs[0]);
        }
      }
    } catch (err) {
      console.warn('Could not load project list in App:', err);
    }
  };

  // Check Backend Health on Mount and poll lightly
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get('/health');
        setSystemStatus(response.data);
      } catch (err) {
        setSystemStatus({ database_connected: false, error: err.message });
      }
    };

    checkHealth();
    fetchProjects();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLoadDemo = () => {
    setDemoNotice("Sample test scenarios loaded: Refinery Package 4 (120 L5 activities, 5 realistic DPR cases)");
    setTimeout(() => setDemoNotice(null), 5000);
  };

  const handleProjectSelect = (proj) => {
    setActiveProject(proj);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
      case 'schedule':
        return <SchedulePage onNavigate={setActiveTab} initialProjectId={activeProject?.id} onProjectCreated={fetchProjects} />;
      case 'field-reports':
        return <FieldReportsPage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
      case 'reconciliation':
        return <ReconciliationPage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
      case 'planner-review':
        return <PlannerReviewPage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
      case 'execution-state':
        return <ExecutionStatePage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
      case 'audit':
        return <AuditPage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
      case 'evaluation':
        return <EvaluationPage onNavigate={setActiveTab} />;
      default:
        return <DashboardPage onNavigate={setActiveTab} initialProjectId={activeProject?.id} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        systemStatus={systemStatus}
        activeProject={activeProject}
        projectsList={projectsList}
        onSelectProject={handleProjectSelect}
        onOpenConfig={() => setIsConfigOpen(true)}
        onLoadDemo={handleLoadDemo}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar 
          activeTab={activeTab} 
          onSelectTab={setActiveTab} 
          pendingReviewCount={3}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-900/40 to-slate-950/80">
          {demoNotice && (
            <div className="bg-brand-950/80 border-b border-brand-700/50 px-6 py-2.5 text-xs text-brand-300 flex items-center justify-between">
              <span>✨ {demoNotice}</span>
              <button onClick={() => setDemoNotice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}
          {renderContent()}
        </main>
      </div>

      {/* Reconciliation Weight Config Modal */}
      <WeightConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </div>
  );
}
