import { useState } from 'react';
import {
  Loader2, LogIn, UserPlus, AlertCircle,
  FileText, CheckCircle2, Zap, Shield, ArrowDown, Layers, Bot, Mail
} from 'lucide-react';
import { supabase } from '../supabase';

export default function AuthScreen({ authError }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) {
        setLoading(false);
        return setMessage("Supabase is not properly configured. Please check your credentials.");
      }
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (result.error) return setMessage(result.error.message);
      if (mode === 'signup') {
        setSuccessMessage('Check Your Inbox for Verification Email');
      } else {
        setMessage('Signed in successfully.');
      }
    } catch (err) {
      setLoading(false);
      setMessage(err?.message || 'An unexpected error occurred during authentication.');
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setMessage('');
    setSuccessMessage('');
  };

  const demoLogin = async () => {
    setLoading(true);
    setMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) {
        setLoading(false);
        return setMessage("Supabase is not properly configured. Please check your credentials.");
      }
      const result = await supabase.auth.signInWithPassword({ email: 'admin@gmail.com', password: 'admin123' });
      setLoading(false);
      if (result.error) return setMessage(result.error.message);
    } catch (err) {
      setLoading(false);
      setMessage(err?.message || 'Demo login failed.');
    }
  };

  const displayMessage = message || authError;

  return (
    <main
      id="auth-scroll-container"
      className="h-screen overflow-y-auto relative text-white scroll-smooth select-none"
      style={{
        background: 'linear-gradient(135deg, #07131d 0%, #0d2332 40%, #081a26 100%)'
      }}
    >
      {/* Background Glows */}
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(58,124,165,0.18) 0%, transparent 70%)',
          animation: 'glowPulse 8s ease-in-out infinite'
        }}
      />
      <div
        className="fixed top-2/3 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(77,212,170,0.1) 0%, transparent 70%)'
        }}
      />

      {/* Hero / Portal Container */}
      <div className="min-h-screen relative z-10 flex flex-col justify-between p-6 md:p-10 max-w-7xl mx-auto">
        
        {/* Top Minimal Header */}
        <header className="flex items-center justify-between w-full pt-2 pb-6 border-b border-accent-900/30">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="IPO Sherpa"
              className="h-8 w-auto rounded-lg drop-shadow-[0_2px_12px_rgba(58,124,165,0.45)]"
            />
            <span className="font-display font-bold text-lg text-white tracking-tight">
              IPO <span className="text-[#81C3D7]">Sherpa</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-400/80 bg-accent-950/40 border border-accent-800/40 px-3.5 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#81C3D7] animate-pulse" />
            <span>SEBI Chapter IX Compliant</span>
          </div>
        </header>

        {/* Hero Middle Section: Left Feature | Login Box | Right Feature */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Side Apple-Style Feature Cards (Desktop) */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-6" style={{ animation: 'floatLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            
            <div className="group rounded-2xl p-5 bg-[#0b1e2c]/80 border border-[#1b3d52] backdrop-blur-xl hover:border-[#81C3D7]/60 transition-all duration-300 shadow-xl hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-accent-950/80 border border-accent-500/30 flex items-center justify-center text-[#81C3D7] mb-3 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1 tracking-tight">
                ICDR Chapter IX Validator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated regulatory check cross-validating 40+ statutory fields across financial statements.
              </p>
            </div>

            <div className="group rounded-2xl p-5 bg-[#0b1e2c]/80 border border-[#1b3d52] backdrop-blur-xl hover:border-[#81C3D7]/60 transition-all duration-300 shadow-xl hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-accent-950/80 border border-accent-500/30 flex items-center justify-center text-[#81C3D7] mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1 tracking-tight">
                Instant Prospectus Drafting
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generates a fully structured SEBI `.docx` Draft Prospectus with 1-click download.
              </p>
            </div>

          </div>

          {/* Center Column: Main Login Portal */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto space-y-6">
            
            {/* Brand Logo Header */}
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <img
                  src="/logo.png"
                  alt="IPO Sherpa"
                  className="w-40 md:w-44 h-auto rounded-2xl mx-auto shadow-2xl transition-transform duration-300 hover:scale-105"
                  style={{
                    filter: 'drop-shadow(0 10px 36px rgba(58,124,165,0.45))'
                  }}
                />
              </div>
              <div>
                <h1 className="text-[28px] md:text-[34px] font-extrabold text-white tracking-tight font-display">
                  SME IPO <span className="text-[#81C3D7]">Workspace</span>
                </h1>
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-accent-400/80 mt-1">
                  AI-Powered Compliance Auditor & Draft Prospectus Generator
                </p>
              </div>
            </div>

            {/* Login Card */}
            <form
              onSubmit={submit}
              className="rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-2xl border border-[#1d445c] bg-[#0a1e2d]/90 text-white"
            >
              {/* Centered Welcome Message */}
              <div className="border-b border-[#1b3d52] pb-5 text-center">
                <h2 className="text-xl font-bold text-white tracking-tight font-display">
                  {mode === 'signin' ? 'Welcome Back' : 'Create Workspace Account'}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Enter your credentials to access your secure draft filings.
                </p>
              </div>

              {displayMessage && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span>{displayMessage}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Work Email
                  </label>
                  <input
                    className="w-full bg-[#061520] border border-[#1b3d52] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81C3D7] focus:ring-2 focus:ring-[#81C3D7]/25 transition-all"
                    type="email"
                    placeholder="founder@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    className="w-full bg-[#061520] border border-[#1b3d52] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81C3D7] focus:ring-2 focus:ring-[#81C3D7]/25 transition-all"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength="8"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>

              <button
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3A7CA5] to-[#81C3D7] hover:from-[#2F6690] hover:to-[#3A7CA5] px-4 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-[#3A7CA5]/25 disabled:opacity-60 transition-all duration-200 cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                ) : mode === 'signin' ? (
                  <LogIn className="h-4 w-4 text-slate-950" />
                ) : (
                  <UserPlus className="h-4 w-4 text-slate-950" />
                )}
                {mode === 'signin' ? 'Sign In to Workspace' : 'Create Workspace Account'}
              </button>

              {/* Demo shortcut — skips manual credential entry for evaluators/reviewers */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#1b3d52]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">or</span>
                <div className="h-px flex-1 bg-[#1b3d52]" />
              </div>
              <button
                type="button"
                onClick={demoLogin}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#1d445c] bg-[#0a1e2d] hover:bg-[#0d2636] px-4 py-3 text-sm font-bold text-[#81C3D7] disabled:opacity-60 transition-all duration-200 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Try Demo Account
              </button>

              {/* Verification Email Message Banner below */}
              {successMessage && (
                <div className="p-4 rounded-2xl bg-accent-950/90 border border-accent-500/40 flex items-start gap-3 text-[#81C3D7] text-xs leading-relaxed shadow-xl animate-fade-in-up">
                  <Mail className="w-5 h-5 text-[#81C3D7] mt-0.5 shrink-0 animate-bounce" />
                  <div>
                    <p className="font-bold text-white text-sm">Check Your Inbox for Verification Email</p>
                    <p className="text-slate-300 text-xs mt-0.5">We've sent a verification link to <span className="text-accent-400 font-medium">{email}</span>. Please click the link to activate your workspace.</p>
                  </div>
                </div>
              )}

              <div className="pt-1 text-center">
                <button
                  type="button"
                  className="text-xs font-semibold text-[#81C3D7] hover:text-[#3A7CA5] transition-colors cursor-pointer"
                  onClick={toggleMode}
                >
                  {mode === 'signin'
                    ? 'Need a new workspace account? Sign up'
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </form>

          </div>

          {/* Right Side Apple-Style Feature Cards (Desktop) */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-6" style={{ animation: 'floatRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            
            <div className="group rounded-2xl p-5 bg-[#0b1e2c]/80 border border-[#1b3d52] backdrop-blur-xl hover:border-[#81C3D7]/60 transition-all duration-300 shadow-xl hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-accent-950/80 border border-accent-500/30 flex items-center justify-center text-[#81C3D7] mb-3 group-hover:scale-110 transition-transform">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1 tracking-tight">
                NLP Red-Flag Scanner
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Detects legal liabilities, RPT disclosures, and financial anomalies automatically.
              </p>
            </div>

            <div className="group rounded-2xl p-5 bg-[#0b1e2c]/80 border border-[#1b3d52] backdrop-blur-xl hover:border-[#81C3D7]/60 transition-all duration-300 shadow-xl hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-accent-950/80 border border-accent-500/30 flex items-center justify-center text-[#81C3D7] mb-3 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1 tracking-tight">
                OCR & Multi-Doc Ingestion
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                OCR extracts data directly from PAN, GST, Financial Statements & Corporate Records.
              </p>
            </div>

          </div>

        </div>

        {/* Scroll Hint */}
        <div className="flex flex-col items-center justify-center pt-4 pb-2 text-slate-400/80 animate-bounce">
          <span className="text-[11px] font-semibold tracking-widest uppercase mb-1">Scroll to explore features</span>
          <ArrowDown className="w-4 h-4 text-[#81C3D7]" />
        </div>

      </div>

      {/* ── Apple-Style Feature Presentation Section (Scroll Down) ── */}
      <section className="relative z-10 py-24 px-6 md:px-12 border-t border-accent-900/30 bg-[#051019]/90 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto space-y-20">
          
          {/* Main Kinetic Title Banner */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs font-bold tracking-[0.25em] uppercase text-[#81C3D7] bg-accent-950/60 border border-accent-800/40 px-4 py-1.5 rounded-full inline-block">
              Engineered for Precision
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight font-display">
              Preparation for SEBI SME IPOs. <br />
              <span className="bg-gradient-to-r from-[#3A7CA5] via-[#81C3D7] to-[#a855f7] bg-clip-text text-transparent">
                Re-imagined with Intelligence.
              </span>
            </h2>
            <p className="text-sm md:text-base text-slate-400 leading-relaxed">
              Eliminate costly manual legal revisions, formatting errors, and regulatory non-compliance with automated AI verification.
            </p>
          </div>

          {/* 3-Column Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="rounded-3xl p-8 bg-[#0a1b26] border border-[#1b3d52] hover:border-[#81C3D7]/60 transition-all duration-300 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/10 rounded-full blur-2xl group-hover:bg-accent-500/20 transition-all" />
              <div className="w-12 h-12 rounded-2xl bg-accent-950 border border-accent-500/40 flex items-center justify-center text-[#81C3D7] mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">
                Statutory Cross-Validation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Automatically matches figures across financial statements, authorized capital declarations, and promoter holdings to catch discrepancies before filing.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#81C3D7]">
                <span>100% ICDR Schedule VI Compliant</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl p-8 bg-[#0a1b26] border border-[#1b3d52] hover:border-[#81C3D7]/60 transition-all duration-300 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/10 rounded-full blur-2xl group-hover:bg-accent-500/20 transition-all" />
              <div className="w-12 h-12 rounded-2xl bg-accent-950 border border-accent-500/40 flex items-center justify-center text-[#81C3D7] mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">
                Automated Prospectus Compiler
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Generates a fully structured SEBI Draft Prospectus in `.docx` format, complete with Cover Page, Objects of Issue, and Risk Disclosures.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#81C3D7]">
                <span>1-Click DOCX Download</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl p-8 bg-[#0a1b26] border border-[#1b3d52] hover:border-[#81C3D7]/60 transition-all duration-300 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/10 rounded-full blur-2xl group-hover:bg-accent-500/20 transition-all" />
              <div className="w-12 h-12 rounded-2xl bg-accent-950 border border-accent-500/40 flex items-center justify-center text-[#81C3D7] mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">
                Isolated User Workspaces
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Your company's financial data, corporate identities, and draft documents are stored strictly within your private account workspace.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#81C3D7]">
                <span>Encrypted & Private</span>
              </div>
            </div>

          </div>

          {/* Interactive Feature Metrics Bar */}
          <div className="rounded-3xl p-8 bg-gradient-to-r from-[#0a1b26] via-[#0d2636] to-[#0a1b26] border border-[#1d445c] flex flex-col md:flex-row items-center justify-around gap-8 text-center shadow-2xl">
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-[#81C3D7] font-display">40+</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">Statutory Rule Checks</div>
            </div>
            <div className="hidden md:block w-px h-12 bg-slate-800" />
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-[#3A7CA5] font-display">7 Chapters</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">SEBI ICDR Wizard Steps</div>
            </div>
            <div className="hidden md:block w-px h-12 bg-slate-800" />
            <div>
              <div className="text-3xl md:text-4xl font-extrabold text-[#81C3D7] font-display">&lt; 2 Seconds</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">Draft Prospectus Generation</div>
            </div>
          </div>

          {/* Footer */}
          <footer className="pt-8 text-center text-xs text-slate-500 border-t border-slate-900">
            <p>© {new Date().getFullYear()} IPO Sherpa. SEBI Chapter IX SME IPO Compliance & Prospectus Generator.</p>
          </footer>

        </div>
      </section>

      {/* Keyframe Injector */}
      <style>{`
        @keyframes floatLeft {
          from { transform: translateX(-35px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes floatRight {
          from { transform: translateX(35px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50%      { opacity: 0.35; transform: scale(1.08); }
        }
      `}</style>
    </main>
  );
}



