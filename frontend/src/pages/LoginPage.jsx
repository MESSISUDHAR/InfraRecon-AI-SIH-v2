import React, { useState } from 'react';
import { 
  Layers, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Sun, 
  Moon, 
  ShieldCheck,
  CheckCircle2,
  Cpu,
  FileText,
  UserCheck,
  LayoutDashboard,
  Sparkles
} from 'lucide-react';
import authService from '../services/auth';

const DEMO_PERSONAS = [
  {
    id: 'supervisor',
    roleName: 'Site Supervisor',
    email: 'supervisor@infra-project.com',
    password: 'demo_password123',
    actionTag: 'Capture',
    workflowDesc: 'Field Reports, DPR logs & free-text evidence',
    icon: FileText,
    color: '#38BDF8',
    borderColor: 'border-[#38BDF8]/40 hover:border-[#38BDF8]',
    bgBadge: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
    iconBg: 'bg-[#38BDF8]/10 text-[#38BDF8]'
  },
  {
    id: 'planner',
    roleName: 'Lead Planner',
    email: 'planner@infra-project.com',
    password: 'demo_password123',
    actionTag: 'Verify',
    workflowDesc: '6-signal reconciliation & planner review gate',
    icon: UserCheck,
    color: '#D4AF37',
    borderColor: 'border-[#D4AF37]/40 hover:border-[#D4AF37]',
    bgBadge: 'bg-[#D4AF37]/15 text-[#F4D06F] border-[#D4AF37]/30',
    iconBg: 'bg-[#D4AF37]/10 text-[#D4AF37]'
  },
  {
    id: 'director',
    roleName: 'Project Director',
    email: 'director@infra-project.com',
    password: 'demo_password123',
    actionTag: 'Understand',
    workflowDesc: 'S-Curve variance, delay chains & audit trail',
    icon: LayoutDashboard,
    color: '#10B981',
    borderColor: 'border-[#10B981]/40 hover:border-[#10B981]',
    bgBadge: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
    iconBg: 'bg-[#10B981]/10 text-[#10B981]'
  }
];

export default function LoginPage({ 
  onLoginSuccess, 
  onSwitchToSignup, 
  theme = 'dark', 
  onToggleTheme,
  initialEmail = '' 
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeDemoId, setActiveDemoId] = useState(null);

  const handleSubmit = async (e, customEmail = null, customPassword = null) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const targetEmail = (customEmail !== null ? customEmail : email).trim();
    const targetPassword = customPassword !== null ? customPassword : password;

    if (!targetEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!targetPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(targetEmail, targetPassword);
      if (data && onLoginSuccess) {
        onLoginSuccess(data);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
      setActiveDemoId(null);
    }
  };

  const handleQuickDemoLogin = (persona) => {
    setEmail(persona.email);
    setPassword(persona.password);
    setActiveDemoId(persona.id);
    handleSubmit(null, persona.email, persona.password);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#0A0A0A] text-[#EAEAEA] flex flex-col justify-between overflow-x-hidden relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.08),rgba(10,10,10,0))]">
      {/* Top Bar with Brand and Theme Switcher */}
      <header className="h-16 border-b border-[#2A2A2A] bg-[#111111]/80 backdrop-blur-md px-6 lg:px-12 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D4AF37] to-[#F4D06F] p-0.5 flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
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
            <p className="text-[11px] text-[#A3A3A3] font-medium hidden sm:block">
              Planning-to-Execution Intelligence Bridge
            </p>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#222222] hover:border-[#D4AF37]/50 text-[#EAEAEA] shadow-sm"
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          id="login-theme-toggle"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#F4D06F]" />
              <span className="text-xs">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-xs">Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Authentication Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 z-10 max-w-5xl mx-auto w-full">
        {/* Top Header / Title */}
        <div className="text-center mb-6 max-w-lg">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#1A1A1A] border border-[#D4AF37]/30 mb-3 shadow-inner">
            <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#EAEAEA]">
            InfraRecon Workspace Login
          </h1>
          <p className="text-xs sm:text-sm text-[#A3A3A3] mt-1.5 font-medium">
            Select a role persona for one-click demo access or enter project credentials
          </p>
        </div>

        {/* 3 Quick Demo Login Persona Cards */}
        <div className="w-full max-w-3xl mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#EAEAEA]">
                Demo Role Personas
              </span>
            </div>
            <span className="text-[11px] text-[#A3A3A3] font-mono">
              Live Backend Auth
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {DEMO_PERSONAS.map((persona) => {
              const Icon = persona.icon;
              const isSelected = activeDemoId === persona.id;

              return (
                <button
                  key={persona.id}
                  type="button"
                  id={`demo-login-card-${persona.id}`}
                  onClick={() => handleQuickDemoLogin(persona)}
                  disabled={loading}
                  className={`panel-card p-4 text-left transition-all duration-200 border relative group cursor-pointer ${
                    isSelected ? 'ring-2 ring-[#D4AF37] bg-[#1A1A1A]' : 'bg-[#121212] hover:bg-[#181818]'
                  } ${persona.borderColor}`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${persona.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full border ${persona.bgBadge}`}>
                      {persona.actionTag}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-[#EAEAEA] group-hover:text-white transition-colors">
                    {persona.roleName}
                  </div>
                  <div className="text-[11px] text-[#A3A3A3] mt-1 leading-snug line-clamp-2">
                    {persona.workflowDesc}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#2A2A2A] flex items-center justify-between text-[10px] font-mono text-[#A3A3A3]">
                    <span className="truncate max-w-[120px]">{persona.email.split('@')[0]}</span>
                    <span className="text-[#D4AF37] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      {isSelected && loading ? 'Logging in...' : 'Launch View →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials Form Box */}
        <div className="w-full max-w-md">
          <div className="panel-card p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl border border-[#2A2A2A] bg-[#111111] shadow-2xl">
            {/* Top Accent Glow */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />

            {/* Error Notification Banner */}
            {errorMessage && (
              <div className="mb-5 p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={(e) => handleSubmit(e)} className="space-y-4" noValidate>
              {/* Email Input */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="engineer@infra-project.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs text-[#EAEAEA] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs text-[#EAEAEA] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A3A3A3] hover:text-[#D4AF37] transition-colors focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                id="login-submit-button"
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2.5 text-xs font-bold tracking-wide mt-3 shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>AUTHENTICATE & ENTER</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Signup */}
            <div className="mt-5 pt-4 border-t border-[#2A2A2A] text-center">
              <p className="text-xs text-[#A3A3A3]">
                Need a new user account?{' '}
                <button
                  id="switch-to-signup-link"
                  onClick={onSwitchToSignup}
                  className="text-[#F4D06F] hover:text-[#FFD700] font-semibold underline-offset-4 hover:underline transition-colors ml-1 focus:outline-none"
                >
                  Register Here
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3.5 border-t border-[#2A2A2A] bg-[#0A0A0A] text-center text-xs text-[#A3A3A3]">
        <div className="flex items-center justify-center gap-2">
          <span>Smart India Hackathon 2026</span>
          <span>•</span>
          <span>Problem Statement 26122</span>
          <span>•</span>
          <span className="text-[#D4AF37] font-semibold">InfraRecon AI</span>
        </div>
      </footer>
    </div>
  );
}
