import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { useToast } from "../../context/ToastContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Person } from "../../types.js";
import { QrCode, MonitorCheck, HelpCircle, ShieldAlert, CheckCircle2, Coins, CreditCard, Sparkles, AlertCircle, RefreshCw, Smartphone, Eye, Volume2, VolumeX, Search, X, Keyboard, UserCheck, ScanLine, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PerformanceMetrics, { ScanEvent, HourlyData } from "./PerformanceMetrics.js";

interface ScannedEmployeeResult {
  eligible: boolean;
  reason: string;
  shift_type?: "day" | "night";
  windowDetails?: string;
  secure_verified?: boolean;
  security_method?: string;
  remainingQuota?: number;
  totalQuota?: number;
  claimedCount?: number;
  employee: {
    id: number;
    name: string;
    employee_no: string;
    department_name: string;
    position: string;
  };
}

export default function CashierScan() {
  const { apiFetch, branding } = useAuth();
  const { addToast } = useToast();
  
  const [manualSearchId, setManualSearchId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showScanFlash, setShowScanFlash] = useState(false);
  const [result, setResult] = useState<ScannedEmployeeResult | null>(null);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [feedbackModalData, setFeedbackModalData] = useState<any | null>(null);

  // Performance diagnostics contain only real server transactions and live session timings.
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);

  const addScanMetric = (success: boolean, responseTime: number) => {
    const now = new Date();
    const timestampStr = now.toLocaleTimeString([], { hour12: false });
    const hourLabel = `${String(now.getHours()).padStart(2, "0")}:00`;
    const newScanId = `scan-live-${Math.random().toString(36).substring(2, 9)}`;

    const newScan: ScanEvent = {
      id: newScanId,
      timestamp: timestampStr,
      success,
      responseTime
    };

    setScans(prev => [...prev, newScan]);

    setHourlyData(prev => {
      const idx = prev.findIndex(h => h.hour === hourLabel);
      if (idx !== -1) {
        const updated = [...prev];
        const currentHourData = updated[idx];
        const newScansCount = currentHourData.scans + 1;
        const newAvgResponseTime = Math.round(
          (currentHourData.avgResponseTime * currentHourData.scans + responseTime) / newScansCount
        );
        updated[idx] = {
          ...currentHourData,
          scans: newScansCount,
          avgResponseTime: newAvgResponseTime
        };
        return updated;
      } else {
        return [...prev, { hour: hourLabel, scans: 1, avgResponseTime: responseTime }];
      }
    });
  };

  // Sound Feedback Configuration
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("scanner_sound_enabled");
    return saved !== "false";
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const newVal = !prev;
      localStorage.setItem("scanner_sound_enabled", String(newVal));
      return newVal;
    });
  };

  const playSound = (type: "success" | "fail") => {
    if (!soundEnabled) return;
    
    // Haptic feedback trigger
    if (type === "success" && "vibrate" in navigator) {
      try {
        navigator.vibrate(50);
      } catch (e) {
        // Silently ignore if vibrate fails (not supported or blocked)
      }
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (type === "success") {
        const now = ctx.currentTime;
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = "sine";
          osc.frequency.value = freq;
          
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(start);
          osc.stop(start + duration);
        };
        playTone(523.25, now, 0.15); // C5
        playTone(659.25, now + 0.08, 0.25); // E5
      } else {
        const now = ctx.currentTime;
        const playTone = (freq: number, start: number, duration: number, oscType: OscillatorType) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = oscType;
          osc.frequency.setValueAtTime(freq, start);
          osc.frequency.linearRampToValueAtTime(freq * 0.7, start + duration);
          
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(start);
          osc.stop(start + duration);
        };
        playTone(220, now, 0.25, "sawtooth"); // Low buzzer-like thud
        playTone(223, now, 0.25, "sine"); // detuned dissonant wave
      }
    } catch (_error) {
      // Audio playback blocked
    }
  };

  useEffect(() => {
    // Fetch today's completed transactions for the terminal's actual throughput history.
    apiFetch("/api/cashier/transactions")
      .then((data: any) => {
        if (Array.isArray(data)) {
          setRecentTxs(data);
          const hourly = new Map<string, number>();
          data.forEach((transaction: any) => {
            if (transaction.status !== "completed") return;
            const time = transaction.meal_time || transaction.created_at?.split("T")[1];
            const hour = time?.slice(0, 2);
            if (hour && /^\d{2}$/.test(hour)) {
              const label = `${hour}:00`;
              hourly.set(label, (hourly.get(label) || 0) + 1);
            }
          });
          setHourlyData(Array.from(hourly.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([hour, count]) => ({
            hour,
            scans: count,
            avgResponseTime: 0
          })));
        }
      })
      .catch(() => {});
  }, []);

  // checkout form parameters
  const [paidAmount, setPaidAmount] = useState("");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Optionally keep existing branding logic if you still want a default, 
    // but the user requested manual input. 
    // Given the request, I will remove the auto-prefill entirely.
  }, []);

  const filterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the Zebra reader absorber input for zero-touch cashiers experience
    if (filterInputRef.current) {
      filterInputRef.current.focus();
    }
  }, []);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualSearchId.trim();
    if (query) {
      processScan(query);
    }
  };

  const processScan = async (code: string) => {
    setScanning(true);
    setErrorHeader(null);
    setResult(null);
    setCheckoutSuccess(null);
    const startTime = performance.now();
    try {
      const data = await apiFetch("/api/cashier/scan", {
        method: "POST",
        body: JSON.stringify({ qr_code: code }),
      });
      const endTime = performance.now();
      const duration = Math.max(1, Math.round(endTime - startTime));
      if (data) {
        setResult(data);
        setManualSearchId("");

        if (data.eligible) {
          setShowScanFlash(true);
          setTimeout(() => setShowScanFlash(false), 800);
          playSound("success");
          addScanMetric(true, duration);
        } else {
          playSound("fail");
          addScanMetric(false, duration);
        }
      }
    } catch (err: any) {
      const endTime = performance.now();
      const duration = Math.max(1, Math.round(endTime - startTime));
      setErrorHeader(err.message || "Invalid barcode scanned. Employee not discoverable.");
      setResult(null);
      setManualSearchId("");
      playSound("fail");
      addScanMetric(false, duration);
    } finally {
      setScanning(false);
      // Retain focus for immediate follow-up clicks
      setTimeout(() => {
        filterInputRef.current?.focus();
      }, 100);
    }
  };

  const handleSimulateScan = (code: string) => {
    processScan(code);
  };

  const handleCheckout = async (isFree: boolean) => {
    if (!result || !result.employee) {
      addToast("No valid employee record found for checkout.", "error");
      return;
    }
    
    // Enforce manual price input for paid meals and verify valid employee record returned
    const amount = parseFloat(paidAmount);
    if (!isFree && (isNaN(amount) || amount <= 0)) {
      addToast("Please enter a valid positive price for the cash transaction.", "error");
      return;
    }

    setLoadingCheckout(true);
    try {
      const data = await apiFetch("/api/cashier/process", {
        method: "POST",
        body: JSON.stringify({
          person_id: result.employee.id,
          is_free: isFree,
          meal_amount: isFree ? 0 : amount,
        }),
      });

      const successMsg = isFree
        ? `Redemption Successful! Printed complimentary meal ticket for ${result.employee.name}.`
        : `Successfully processed paid transaction of ${branding?.currencySymbol || "₱"}${amount.toFixed(2)} for ${result.employee.name}.`;

      setCheckoutSuccess(successMsg);
      addToast(successMsg, "success");

      setFeedbackModalData({
        employeeName: result.employee.name,
        mealType: isFree ? "Complimentary" : "Standard",
        tag: isFree ? "free" : "paid",
        mealAmount: data.transaction?.meal_amount || (isFree ? 0 : amount)
      });
      setResult(null);
    } catch (err: any) {
      addToast("Checkout failure: " + err.message, "error");
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <div id="cashier-scanner-terminal">
      <PageHeader
        title="QR Meal Redemption"
        subtitle="Process employee complimentary vouchers or record payroll salary deduction sales using Zebra barcode scanner"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Scanning Console */}
        <div className="lg:col-span-4 space-y-6">
          {/* Unified Scanner & Manual Input */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 px-3 rounded-xl border flex items-center gap-1.5 transition-all text-[10px] font-bold ${
                  soundEnabled
                    ? "bg-teal-50 border-teal-150 text-teal-800 hover:bg-teal-100 cursor-pointer"
                    : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:bg-zinc-100 cursor-pointer"
                }`}
                title={soundEnabled ? "Mute scanner audio feedback" : "Unmute scanner audio feedback"}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                    <span>AUDIO FEEDBACK: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                    <span>AUDIO FEEDBACK: MUTED</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 border border-indigo-100 shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Scan or Search Employee ID</h3>
                <p className="text-[11px] text-zinc-500 font-medium">Use Zebra scanner or type ID manually</p>
              </div>
            </div>
            
            <p className="text-xs text-zinc-550 leading-relaxed mb-4">
              Focus the field below to automatically capture barcode scans, or manually type the employee ID and press Enter if the physical badge is damaged.
            </p>

            <form onSubmit={handleManualSearch} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <ScanLine className="w-4 h-4 text-indigo-500" />
                </div>
                <input
                  ref={filterInputRef}
                  type="text"
                  placeholder="READY TO SCAN OR TYPE... (e.g., EMP-1002)"
                  value={manualSearchId}
                  onChange={(e) => setManualSearchId(e.target.value)}
                  className="w-full pl-9 pr-24 h-12 text-sm bg-zinc-50 border border-zinc-250 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono font-bold text-zinc-900 placeholder-zinc-400 shadow-inner"
                />
                <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200 rounded text-[9px] font-mono font-bold text-emerald-600 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    LIVE
                  </div>
                  {manualSearchId && (
                    <button
                      type="button"
                      onClick={() => setManualSearchId("")}
                      className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-500 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!manualSearchId.trim() || scanning}
                className="w-full h-10 bg-indigo-800 hover:bg-indigo-900 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{scanning ? "Processing..." : "Look Up Employee"}</span>
              </button>
            </form>
          </div>





        </div>

        {/* Right column: Results Panel */}
        <div className="lg:col-span-8 relative min-h-[400px]">
          <AnimatePresence>
            {scanning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 rounded-3xl bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 border border-zinc-200 shadow-xs"
              >
                <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                  {/* Rotating circular scan tracker */}
                  <motion.div
                    className="absolute inset-0 border-4 border-dashed border-teal-600 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div
                    className="absolute inset-2 border-2 border-emerald-500/30 rounded-full"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <QrCode className="w-10 h-10 text-teal-700" />
                </div>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2 max-w-sm"
                >
                  <h3 className="text-base font-black text-zinc-900 tracking-tight flex items-center justify-center gap-2 font-sans">
                    <RefreshCw className="w-4 h-4 text-teal-700 animate-spin" />
                    PROCESSING DIGITAL PASS
                  </h3>
                  <p className="text-xs text-zinc-550 leading-relaxed font-medium">
                    Connecting to Mount Grace security mainframe. Analyzing employee active roster windows, department classifications, and complimentary dietary meal quotas.
                  </p>
                </motion.div>

                {/* Laser scan bar crossing the results loader */}
                <motion.div
                  className="absolute left-0 right-0 h-[3px] bg-teal-500/60 shadow-[0_0_12px_rgba(20,184,166,0.5)] z-10"
                  animate={{
                    top: ["0%", "100%", "0%"]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Default idle screen state */}
          {!result && !errorHeader && !checkoutSuccess && (
            <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <MonitorCheck className="w-12 h-12 text-zinc-400 mb-4 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-900">Scan Area Awaiting Code Scan</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">
                Aim the scanner or click any mock badge in the emulation panel. The employee's record, roster schedule, and eligibility state will appear here instantly.
              </p>
            </div>
          )}

          {/* Error display header */}
          {errorHeader && (
            <div className="bg-white border border-rose-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
              <ShieldAlert className="w-14 h-14 text-rose-500 mb-4 animate-bounce" />
              <h3 className="text-md font-bold text-zinc-900">Unrecognized Staff Barcode</h3>
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 mt-4 max-w-md font-bold leading-normal">
                {errorHeader}
              </p>
            </div>
          )}

          {/* Checkout transaction complete feedback */}
          {checkoutSuccess && (
            <div className="bg-emerald-500 border border-emerald-600 text-white rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[400px] shadow-lg shadow-emerald-950/20">
              <CheckCircle2 className="w-16 h-16 text-white mb-4 animate-bounce" />
              <h3 className="text-base font-extrabold tracking-tight">Voucher Registered</h3>
              <p className="text-sm text-emerald-100 mt-2 max-w-md leading-relaxed">{checkoutSuccess}</p>
              <button
                onClick={() => {
                  setCheckoutSuccess(null);
                  filterInputRef.current?.focus();
                }}
                className="mt-6 h-9 px-6 bg-white hover:bg-emerald-100 text-emerald-950 font-bold rounded-lg text-xs"
              >
                Scan Next Employee
              </button>
            </div>
          )}

          {/* Real Scan Results display panel */}
          {result && result.employee && (
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[400px] animate-fade-in">
              
              {/* Header result notification banner */}
              <div className={`p-6 border-b flex flex-col sm:flex-row items-center justify-between gap-4 ${
                result.eligible 
                  ? "bg-emerald-50/60 border-emerald-150 text-emerald-900" 
                  : "bg-amber-50/60 border-amber-150 text-amber-900"
              }`}>
                <div className="flex items-center gap-3">
                  {result.eligible ? (
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-12 h-12 text-rose-600 shrink-0 animate-pulse" />
                  )}
                  <div className="text-left">
                    <span className="text-[10px] font-mono uppercase font-bold tracking-wider opacity-60">Eligibility Report</span>
                    <h4 className="text-md font-black tracking-tight mt-0.5">
                      {result.eligible ? "AUTHORIZED FREE MEAL VOUCHER" : "INELIGIBLE FOR COMPLIMENTARY VOUCHER"}
                    </h4>
                    <p className="text-xs font-bold font-mono text-zinc-700 mt-0.5">{result.reason}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                  {/* Remaining Meal Quota Info Badge */}
                  <div className={`px-3 py-1.5 rounded-2xl text-xs font-mono font-black border flex items-center gap-2 shadow-2xs ${
                    (result.remainingQuota ?? (result.eligible ? 1 : 0)) > 0
                      ? "bg-emerald-100/90 text-emerald-950 border-emerald-300"
                      : "bg-rose-100/90 text-rose-950 border-rose-300"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      (result.remainingQuota ?? (result.eligible ? 1 : 0)) > 0 ? "bg-emerald-600 animate-pulse" : "bg-rose-600"
                    }`} />
                    <span>
                      Quota: {result.remainingQuota ?? (result.eligible ? 1 : 0)} / {result.totalQuota || 1} Free Left
                    </span>
                  </div>

                  {result.shift_type && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-white border border-zinc-200 text-zinc-700 uppercase tracking-wider">
                      {result.shift_type} shift
                    </span>
                  )}
                </div>
              </div>

              {/* Employee profile metrics details */}
              <div className="p-6 md:p-8 flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">Employee details</span>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-150 text-teal-800 flex items-center justify-center font-bold text-lg select-none">
                      {result?.employee?.name?.[0] || 'E'}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900 leading-none">{result.employee.name}</h4>
                      <p className="text-[11px] font-mono font-bold text-zinc-400 mt-1">ID: {result.employee.employee_no}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-zinc-100 pt-4 text-xs text-zinc-650">
                    <div className="flex justify-between"><span className="text-zinc-400">Department:</span> <span className="font-bold text-zinc-805">{result.employee.department_name}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Position:</span> <span className="font-bold text-zinc-805">{result.employee.position}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Shift Window:</span> <span className="font-mono text-teal-850 font-bold">{result.windowDetails || "Off Duty"}</span></div>
                    
                    {/* Shift Meal Quota Row */}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-zinc-400">Shift Meal Quota:</span>
                      <span className={`font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded-md border ${
                        (result.remainingQuota ?? (result.eligible ? 1 : 0)) > 0
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}>
                        {(result.remainingQuota ?? (result.eligible ? 1 : 0)) > 0 
                          ? `${result.remainingQuota ?? 1}/${result.totalQuota ?? 1} Meal Available` 
                          : `0/${result.totalQuota ?? 1} Quota Claimed`}
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic security shield verification section */}
                  <div className={`mt-4 p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                    result.secure_verified 
                      ? "bg-teal-50/40 border-teal-200 text-teal-900" 
                      : "bg-amber-50/30 border-amber-200/80 text-amber-900"
                  }`}>
                    {result.secure_verified ? (
                      <div className="p-1 rounded-lg bg-teal-100/80 text-teal-850 shrink-0">
                        <MonitorCheck className="w-4 h-4 text-teal-700" />
                      </div>
                    ) : (
                      <div className="p-1 rounded-lg bg-amber-100/80 text-amber-850 shrink-0">
                        <HelpCircle className="w-4 h-4 text-amber-700" />
                      </div>
                    )}
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider font-sans leading-none">Security Shield</span>
                        {result.secure_verified ? (
                          <span className="px-1.5 py-0.5 bg-teal-700 text-white text-[7px] font-black rounded-sm leading-none font-mono uppercase">VERIFIED</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[7px] font-black rounded-sm leading-none font-mono uppercase">LEGACY</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-650 mt-1 font-medium leading-relaxed">
                        {result.secure_verified 
                          ? "Dynamic HMAC cryptographic token authenticated against rotating server keys." 
                          : "Legacy static badge scanned. Highly vulnerable to badge image copying or screenshot forgery."}
                      </p>
                      <p className="text-[9px] font-mono font-bold text-teal-850 bg-teal-50/50 inline-block px-1.5 py-0.5 rounded border border-teal-150 mt-1.5">
                        {result.security_method || "Unsigned barcode data stream"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Operations checkout layout */}
                <div className="border border-zinc-200 rounded-3xl p-6 bg-zinc-50/50 flex flex-col justify-between h-full min-h-[220px]">
                  <div>
                    {/* Policy Quota Banner */}
                    <div className={`p-3 rounded-2xl border text-xs font-medium mb-4 flex items-center justify-between shadow-2xs ${
                      (result.remainingQuota ?? (result.eligible ? 1 : 0)) > 0
                        ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                        : "bg-rose-50 border-rose-200 text-rose-950"
                    }`}>
                      <div className="flex items-center gap-2">
                        <UserCheck className={`w-4 h-4 ${
                          (result.remainingQuota ?? (result.eligible ? 1 : 0)) > 0 ? "text-emerald-600" : "text-rose-600"
                        }`} />
                        <span className="font-bold">Shift Quota Limit:</span>
                      </div>
                      <span className="font-mono font-black text-[11px] uppercase tracking-wider">
                        {result.remainingQuota ?? (result.eligible ? 1 : 0)} / {result.totalQuota || 1} Free Remaining
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Checkout Options</h4>
                        <span className="text-[10px] font-mono text-zinc-500">Manual Price Override Active</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                        Select complimentary voucher claim or process a salary deduction sale with a custom manual price.
                      </p>

                      <div className="space-y-4">
                        {result.eligible && (
                          <button
                            onClick={() => handleCheckout(true)}
                            disabled={loadingCheckout}
                            className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            {loadingCheckout ? "Logging..." : "Process Complimentary Meal"}
                          </button>
                        )}

                        <div className="p-4 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-2xs">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-zinc-800 uppercase tracking-wider block">
                                Manual Price Override ({branding?.currencySymbol || "₱"})
                              </label>
                              {paidAmount !== "" && (
                                <button
                                  type="button"
                                  onClick={() => setPaidAmount("")}
                                  className="text-[10px] text-teal-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Clear manual override"
                                >
                                  <RotateCcw className="w-3 h-3" /> Undo Override
                                </button>
                              )}
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Enter manual price..."
                              value={paidAmount}
                              onChange={(e) => setPaidAmount(e.target.value)}
                              className={`w-full h-10 px-3 text-sm bg-zinc-50 border rounded-xl focus:outline-none focus:ring-2 font-mono font-bold text-zinc-900 ${
                                paidAmount !== "" && (isNaN(parseFloat(paidAmount)) || parseFloat(paidAmount) <= 0)
                                  ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                                  : "border-zinc-300 focus:ring-teal-500"
                              }`}
                            />
                            {paidAmount !== "" && (isNaN(parseFloat(paidAmount)) || parseFloat(paidAmount) <= 0) ? (
                              <span className="text-[10px] text-rose-600 mt-1 block font-medium">
                                Error: Price must be a positive number greater than 0.
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400 mt-1 block">
                                Direct manual input. Bypasses any automated payroll deductions or default meal pricing.
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleCheckout(false)}
                            disabled={loadingCheckout || (paidAmount === "" || isNaN(parseFloat(paidAmount)) || parseFloat(paidAmount) <= 0)}
                            className="w-full h-10 bg-teal-800 hover:bg-teal-950 disabled:bg-teal-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                          >
                            <Coins className="w-4 h-4" />
                            {loadingCheckout ? "Logging..." : `Process Paid Transaction (${branding?.currencySymbol || "₱"}${parseFloat(paidAmount || "0").toFixed(2)})`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action buttons footer */}
              <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    filterInputRef.current?.focus();
                  }}
                  className="h-8 border border-zinc-250 text-zinc-550 rounded-lg text-xs font-bold px-4 hover:bg-zinc-100"
                >
                  Clear scan console
                </button>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Real-time Hardware Diagnostics & Performance Stats */}
      <div className="mt-10">
        <PerformanceMetrics scans={scans} hourlyData={hourlyData} />
      </div>

      {/* Success QR Feedback Modal */}
      <AnimatePresence>
        {feedbackModalData && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full relative overflow-hidden"
            >
              {/* Top status bar/icon */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                  feedbackModalData.tag === "free"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : "bg-amber-50 text-amber-600 border border-amber-100"
                }`}>
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <span className="text-[10px] font-mono font-black tracking-widest text-zinc-400 uppercase">
                  Meal Scan Recorded
                </span>
                <h3 className="text-base font-black text-zinc-900 mt-1">
                  Transaction Authorized
                </h3>
              </div>

              {/* Employee & Transaction info */}
              <div className="space-y-3.5">
                <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-4">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                    Staff Member
                  </span>
                  <p className="text-sm font-extrabold text-zinc-900 mt-0.5">
                    {feedbackModalData.employeeName}
                  </p>
                </div>

                <div className="border border-zinc-150 rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-medium">Meal Class:</span>
                    <span className="font-bold text-zinc-800">{feedbackModalData.mealType} Meal</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-medium">System Tagging:</span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold uppercase border ${
                      feedbackModalData.tag === "free"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {feedbackModalData.tag === "free" ? "Complimentary (FREE)" : "Cash Sale (PAID)"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-100">
                    <span className="text-zinc-500 font-medium">Recorded Amount:</span>
                    <span className="font-extrabold text-zinc-900 font-mono">
                      {branding?.currencySymbol || "₱"}{Number(feedbackModalData.mealAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirm/Ok action */}
              <button
                type="button"
                onClick={() => {
                  setFeedbackModalData(null);
                  setResult(null); // Clear search panel for clean next scan
                  setTimeout(() => {
                    filterInputRef.current?.focus();
                  }, 100);
                }}
                className="w-full mt-6 h-10 bg-zinc-900 hover:bg-zinc-850 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                Done &amp; Ready
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
