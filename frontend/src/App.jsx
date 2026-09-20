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
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import WeightConfigModal from './components/Common/WeightConfigModal';
import { getProjects } from './services/api';
import authService from './services/auth';
import { Layers } from 'lucide-react';
import { EventProvider } from './context/EventContext';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => authService.getUser());
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [prefilledEmail, setPrefilledEmail] = useState('');

  // Application State
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

  // Verify Session Token on Initial Load
  useEffect(() => {
    const verifyToken = async () => {
      if (authService.isAuthenticated()) {
        try {
          const user = await authService.getMe();
          setCurrentUser(user);
          setIsAuthenticated(true);
        } catch (err) {
          console.warn('Session verification failed, logging out:', err);
          authService.logout();
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setIsVerifyingSession(false);
    };

    verifyToken();
  }, []);

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
    if (isAuthenticated) {
      fetchProjects();
    }
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLoginSuccess = (authData) => {
    setCurrentUser(authData.user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    fetchProjects();
  };

  const handleSignupSuccess = (createdEmail) => {
    setPrefilledEmail(createdEmail || '');
    setAuthView('login');
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAuthView('login');
  };

  const handleLoadDemo = () => {
    setDemoNotice("Sample test scenarios loaded: Refinery Package 4 (120 L5 activities, 5 realistic DPR cases)");
    setTimeout(() => setDemoNotice(null), 5000);
  };

  const handleProjectSelect = (proj) => {
    setActiveProject(proj);
  };

  // Loading Screen while verifying JWT session on refresh
  if (isVerifyingSession) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-[#EAEAEA]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#D4AF37] to-[#F4D06F] p-0.5 flex items-center justify-center shadow-xl shadow-[#D4AF37]/20 mb-4 animate-pulse">
          <div className="w-full h-full bg-[#0A0A0A] rounded-[14px] flex items-center justify-center">
            <Layers className="w-6 h-6 text-[#D4AF37]" />
          </div>
        </div>
        <div className="text-sm font-bold tracking-tight text-[#EAEAEA] flex items-center gap-2">
          <span>InfraRecon <span className="text-[#D4AF37]">AI</span></span>
        </div>
        <p className="text-xs text-[#A3A3A3] mt-2">Authenticating workspace session...</p>
      </div>
    );
  }

  // Unauthenticated Flow: Render Login or Signup Page
  if (!isAuthenticated) {
    if (authView === 'signup') {
      return (
        <SignupPage
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignupSuccess={handleSignupSuccess}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onLoginSuccess={handleLoginSuccess}
        onSwitchToSignup={() => setAuthView('signup')}
        initialEmail={prefilledEmail}
      />
    );
  }

  // Authenticated Application Flow
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
    <EventProvider>
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
          currentUser={currentUser}
          onLogout={handleLogout}
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
    </EventProvider>
  );
}
