import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Users, HelpCircle, Activity, Eye, EyeOff, Loader2, User, Lock, Building2, CheckCircle2, ShieldAlert, Sparkles, HeartPulse } from "lucide-react";
import DGMCLogo from "../components/DGMCLogo.js";
import { getApiBaseUrl } from "../utils/apiConfig.js";
import { motion } from "motion/react";

export default function Login() {
  const { login, branding, refreshBranding } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publicStats, setPublicStats] = useState<{ totalStaff: number; mealsProcessed: number } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  const [itSupportContact, setItSupportContact] = useState("Medical arts Bldg. 5th floor/ICT dept. / 2568");
  const [dynamicCompanyName, setDynamicCompanyName] = useState("Divine Grace Medical Center");


  useEffect(() => {
    // Refresh branding from context as well as retrieving public telemetry
    if (typeof refreshBranding === "function") {
      refreshBranding().catch(() => {});
    }
    
    const baseUrl = getApiBaseUrl();

    // Retrieve safe general telemetry for hospital login presentation
    fetch(`${baseUrl}/api/public-stats`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => setPublicStats(data))
      .catch(() => {
        // Fallback placeholder stats if offline or unseeded
        setPublicStats({ totalStaff: 0, mealsProcessed: 0 });
      });

    // Fetch helpdesk contact and company branding dynamically from settings endpoint
    fetch(`${baseUrl}/api/settings`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const itSupport = data.find((item: any) => item.setting_key === "it_support_phone");
          if (itSupport && itSupport.setting_value) {
            setItSupportContact(itSupport.setting_value);
          }
          const companyObj = data.find((item: any) => item.setting_key === "company_name");
          if (companyObj && companyObj.setting_value) {
            setDynamicCompanyName(companyObj.setting_value);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in both personnel credential fields.");
      setShakeKey((prev) => prev + 1);
      return;
    }
    setError(null);
    setSubmitting(true);

    const result = await login(username.trim(), password);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Invalid user credentials. Please try again.");
      setShakeKey((prev) => prev + 1);
    }
  };

  return (
    <div id="login-pane" className="min-h-screen bg-gradient-to-tr from-slate-100 via-sky-50/20 to-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Background ambient lighting for modern medical portal feel */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto my-auto z-10">
        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 ? { x: [0, -10, 10, -10, 10, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,38,99,0.06)] flex flex-col lg:flex-row border border-slate-200/80 min-h-[580px]"
        >
          
          {/* Left Hero Panel: Hospital Branding & Telemetry */}
          <div className="w-full lg:w-5/12 bg-gradient-to-br from-[#002663] via-[#003db3] to-[#001c4a] p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
            {/* Medical ECG Pulse Wave graphic overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 500 500" preserveAspectRatio="none">
              <path d="M 0 250 Q 100 250 150 250 L 170 200 L 190 320 L 210 150 L 230 280 L 250 240 L 270 250 L 500 250" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>

            {/* Accent light highlights inside the hero panel */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-teal-400/20 blur-2xl pointer-events-none" />

            {/* Top Logo Section */}
            <div className="relative z-10">
              <DGMCLogo variant="white" />
            </div>

            {/* Center Portal Description */}
            <div className="my-8 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sky-200 text-xs font-mono font-bold tracking-wider uppercase mb-4">
                <HeartPulse className="w-3.5 h-3.5 text-sky-300 animate-pulse" />
                <span>Hospital Staff Portal</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Dietary &amp; Benefit Management System
              </h2>
              <p className="text-xs text-slate-200/80 mt-3 leading-relaxed font-normal">
                Secure enterprise portal for Divine Grace Medical Center personnel. Real-time shift validation, meal quota debits, and badging services.
              </p>

              {/* Feature highlights list with crisp clinic-themed bullet layouts */}
              <div className="mt-8 space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-sky-100 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <span>Instant QR Badge Meal Allowance Verification</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-sky-100 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <span>Shift Schedule &amp; Active Roster Synchronization</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-sky-100 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <span>Cashier Terminal &amp; Transaction Receipts Audit</span>
                </div>
              </div>
            </div>

            {/* Bottom Telemetry Counters */}
            <div className="grid grid-cols-2 gap-3 pt-5 border-t border-white/10 relative z-10">
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-sky-300 mb-1">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-sky-200">Active Roster</span>
                </div>
                <p className="text-xl font-black text-white font-mono leading-none">
                  {publicStats ? publicStats.totalStaff : "..."} <span className="text-xs font-sans text-sky-200 font-normal">staff</span>
                </p>
              </div>
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-sky-300 mb-1">
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-sky-200">Meals Served</span>
                </div>
                <p className="text-xl font-black text-white font-mono leading-none">
                  {publicStats ? publicStats.mealsProcessed : "..."} <span className="text-xs font-sans text-sky-200 font-normal">today</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Form Panel: Authentication Card */}
          <div className="w-full lg:w-7/12 p-8 lg:p-12 flex flex-col justify-between bg-white">
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#003299] shadow-2xs">
                    <Building2 className="w-4 h-4 text-[#003299]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-[#003299] uppercase tracking-widest font-mono">Divine Grace Medical Center</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Information Systems Gateway</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Personnel Gateway Sign-In
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Authorized medical staff can access active meal allotments, schedules, and badging terminals.
                </p>
              </div>

              {error && (
                <div 
                  ref={errorRef} 
                  tabIndex={0} 
                  aria-live="polite" 
                  className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-3 font-semibold outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                >
                  <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                  {/* Username distinct credential container card */}
                  <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200 hover:border-slate-350 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-md focus-within:shadow-blue-500/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="login-username" className="text-[10px] font-black text-[#003299] uppercase tracking-wider font-mono">
                        Username
                      </label>
                      <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md border border-blue-100 font-mono">
                        Required
                      </span>
                    </div>
                    <div className="relative mt-2">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <input
                        id="login-username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        required
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Enter your system username (e.g. cashier1)"
                        className="w-full h-10 pl-9 pr-3 text-xs bg-transparent text-slate-900 placeholder-slate-400 font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Password distinct credential container card */}
                  <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200 hover:border-slate-350 focus-within:border-emerald-500 focus-within:bg-white focus-within:shadow-md focus-within:shadow-emerald-500/5 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="login-password" className="text-[10px] font-black text-emerald-800 uppercase tracking-wider font-mono">
                        Password
                      </label>
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-100 font-mono">
                        Encrypted
                      </span>
                    </div>
                    <div className="relative mt-2">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4 text-emerald-600" />
                      </div>
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="••••••••••••"
                        className="w-full h-10 pl-9 pr-10 text-xs bg-transparent text-slate-900 placeholder-slate-400 font-semibold focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#003299] focus:ring-[#003299] border-slate-300 cursor-pointer"
                    />
                    <span className="text-slate-600 font-medium">Keep terminal logged in</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-[#003299] hover:bg-[#002473] active:scale-[0.99] disabled:bg-slate-300 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-900/10 mt-4 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                        className="flex items-center justify-center"
                      >
                        <HeartPulse className="w-4.5 h-4.5 text-white fill-white" />
                      </motion.div>
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </form>
            </div>

            {/* Security Notice & IT Support */}
            <div className="mt-6 border-t border-slate-100 pt-4 flex items-start gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60">
              <HelpCircle className="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-500 leading-relaxed">
                <span className="font-extrabold text-slate-800 block uppercase tracking-wider text-[9px] mb-0.5">IT Access Support</span>
                Forgot credentials? Contact <span className="font-bold text-[#003299]">{itSupportContact}</span> or your supervisor on duty.
              </div>
            </div>

          </div>
        </motion.div>
      </div>

      {/* Footer Audit Notice */}
      <div className="w-full max-w-5xl mx-auto text-center text-[11px] text-slate-500 py-2 z-10">
        © {dynamicCompanyName} • Authorized Access Only • All Access Logged &amp; Audited
      </div>
    </div>
  );
}

