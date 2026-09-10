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
  
  // Theme State (Dark / Light) with Persistence
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('infra_theme') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('infra_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#EAEAEA]">
      {/* Top Navigation */}
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
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
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.04),rgba(10,10,10,0))]">
          {demoNotice && (
            <div className="bg-[#1A1A1A] border-b border-[#D4AF37]/30 px-6 py-2.5 text-xs text-[#F4D06F] flex items-center justify-between shadow-sm">
              <span className="flex items-center gap-2">
                <span className="text-[#D4AF37]">✨</span>
                <span>{demoNotice}</span>
              </span>
              <button onClick={() => setDemoNotice(null)} className="text-[#A3A3A3] hover:text-[#D4AF37] transition-colors">✕</button>
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
