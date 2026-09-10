import React, { useState } from 'react';
import { 
  Layers, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Briefcase, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sun, 
  Moon, 
  UserPlus
} from 'lucide-react';
import authService from '../services/auth';

const ROLE_OPTIONS = [
  'Lead Project Engineer',
  'Construction Planner',
  'Site Supervisor',
  'Audit & QA Reviewer',
  'Project Director'
];

export default function SignupPage({ 
  onSignupSuccess, 
  onSwitchToLogin, 
  theme = 'dark', 
  onToggleTheme 
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Frontend Validations
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.signup({
        fullName: cleanName,
        email: cleanEmail,
        password,
        confirmPassword,
        role,
      });

      setSuccessMessage('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        if (onSignupSuccess) {
          onSignupSuccess(cleanEmail);
        } else if (onSwitchToLogin) {
          onSwitchToLogin(cleanEmail);
        }
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
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
          id="signup-theme-toggle"
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

      {/* Main Registration Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-lg">
          <div className="panel-card p-8 sm:p-10 relative overflow-hidden backdrop-blur-xl border border-[#2A2A2A] bg-[#111111] shadow-2xl">
            {/* Top Accent Glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1A1A1A] border border-[#D4AF37]/30 mb-3 shadow-inner">
                <UserPlus className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#EAEAEA]">
                Create your account
              </h1>
              <p className="text-xs text-[#A3A3A3] mt-1.5 font-medium">
                Register for the autonomous infrastructure intelligence workspace
              </p>
            </div>

            {/* Notifications */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{successMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Alex Mercer"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm text-[#EAEAEA] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="alex@infra-project.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm text-[#EAEAEA] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1 uppercase tracking-wider">
                  Project Role
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <select
                    id="signup-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm text-[#EAEAEA] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r} className="bg-[#111111] text-[#EAEAEA]">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two Column Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Min 6 chars"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm text-[#EAEAEA] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A3A3A3] hover:text-[#D4AF37] transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A3A3A3]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Re-enter password"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm text-[#EAEAEA] placeholder-[#666666] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A3A3A3] hover:text-[#D4AF37] transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="signup-submit-button"
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-sm font-bold tracking-wide mt-3 shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                    <span>CREATING ACCOUNT...</span>
                  </>
                ) : (
                  <>
                    <span>CREATE ACCOUNT</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Login */}
            <div className="mt-6 pt-5 border-t border-[#2A2A2A] text-center">
              <p className="text-xs text-[#A3A3A3]">
                Already have an account?{' '}
                <button
                  id="switch-to-login-link"
                  onClick={() => onSwitchToLogin && onSwitchToLogin()}
                  className="text-[#F4D06F] hover:text-[#FFD700] font-semibold underline-offset-4 hover:underline transition-colors ml-1 focus:outline-none"
                >
                  Login
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-[#2A2A2A] bg-[#0A0A0A] text-center text-xs text-[#A3A3A3]">
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
