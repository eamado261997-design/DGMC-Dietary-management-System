import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { 
  Calendar, 
  History, 
  QrCode, 
  TrendingUp, 
  Heart, 
  Activity, 
  Clock, 
  ShieldCheck, 
  DollarSign,
  AlertCircle,
  PieChart
} from "lucide-react";
import DGMCLogo from "../../components/DGMCLogo.js";
import { Skeleton } from "../../components/Skeleton.js";

interface DashboardData {
  totalFreeClaims: number;
  totalPaidMeals: number;
  estimatedMoneySaved: number;
  scheduledShiftToday: string | null;
  mealsClaimedThisMonth?: number;
  monthlyMealAllocation?: number;
}

export default function EmployeeDashboard({ onViewChange }: { onViewChange: (view: string) => void }) {
  const { user, apiFetch, branding } = useAuth();
  const [data, setData] = useState<DashboardData | null>(() => {
    const cached = localStorage.getItem("cached_employee_dashboard");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(!data);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(() => 
    localStorage.getItem("cached_employee_dashboard_timestamp")
  );

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await apiFetch("/api/employee/dashboard-data");
        setData(stats);
        localStorage.setItem("cached_employee_dashboard", JSON.stringify(stats));
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString();
        localStorage.setItem("cached_employee_dashboard_timestamp", nowStr);
        setCacheTimestamp(nowStr);
        setIsOfflineMode(false);
      } catch (_err) {
        const cached = localStorage.getItem("cached_employee_dashboard");
        if (cached) {
          setData(JSON.parse(cached));
          setIsOfflineMode(true);
        }
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <VitalSignsLoader size="md" color="teal" className="mb-2" />
        <p className="text-xs font-mono font-bold text-teal-800 mt-2 uppercase tracking-widest">
          Syncing Benefit Portal...
        </p>
      </div>
    );
  }

  const shiftStatusText = () => {
    if (!data?.scheduledShiftToday) return "Off Duty Today";
    return data.scheduledShiftToday === "day" 
      ? "Day Shift (11:00 AM - 2:00 PM)" 
      : "Night Shift (10:00 PM - 6:00 AM)";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {isOfflineMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 items-center non-printable">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Intermittent Connectivity - Offline Mode</p>
            <p className="text-zinc-650 mt-0.5">
              Showing cached dashboard telemetry (last synced: {cacheTimestamp || "recently"}). Recent meal transactions may not be visible.
            </p>
          </div>
        </div>
      )}

      {/* 1. Header Greeting Card */}
      <div className="bg-gradient-to-br from-teal-900 to-teal-980 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-teal-950/10">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5 blur-2xl"></div>
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5 blur-2xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] bg-white/10 border border-white/20 text-teal-300 font-extrabold uppercase py-0.5 px-3 rounded-full font-mono tracking-widest inline-block">
              Hospital Personnel Portal
            </span>
            <h2 className="text-2xl font-black mt-3 flex items-center gap-2.5">
              <span>Mabuhay, {user.first_name}!</span>
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
            </h2>
            <p className="text-xs text-teal-200/90 mt-1 max-w-lg">
              Welcome to the {branding.companyName} Dietary Hub. Check your active work schedules, generate scan codes, and review your daily meal benefit allocations.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 text-[10px] font-mono">
              <span className="bg-teal-950/60 text-teal-300 py-1 px-2.5 rounded-lg border border-teal-800/40">
                EMP ID: {user.employee_no || "N/A"}
              </span>
              <span className="bg-teal-950/60 text-teal-300 py-1 px-2.5 rounded-lg border border-teal-800/40">
                Dept: {user.position || "Medical Practitioner"}
              </span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/10 p-5 rounded-2xl shrink-0 text-center min-w-[200px]">
            <span className="text-[9px] uppercase font-mono tracking-widest text-teal-300 font-bold block">
              Active Shift Status
            </span>
            <div className="flex items-center justify-center gap-2 mt-2 text-white">
              <Clock className="w-4 h-4 text-teal-300 shrink-0" />
              {loading ? (
                <Skeleton className="h-4 w-32 bg-teal-800/40" />
              ) : (
                <p className="text-sm font-extrabold font-sans">
                  {shiftStatusText()}
                </p>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-3 w-40 mt-1.5 mx-auto bg-teal-800/40" />
            ) : (
              <p className="text-[10px] text-teal-200/70 mt-1.5 leading-snug">
                {data?.scheduledShiftToday 
                  ? "Your free meal benefit code is active during scheduled hours." 
                  : "No food credits currently active for this calendar date."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Primary Analytics Bento Row */}
      <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono mt-8">My Diet Telemetry</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1: Claimed Free Meals */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 block tracking-wider">Free Meals Claimed</span>
            {loading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-black text-zinc-950 font-mono mt-1 leading-none">{data?.totalFreeClaims ?? 0}</p>
            )}
            <span className="text-[9px] text-zinc-400 mt-1 block">Full welfare claims issued</span>
          </div>
        </div>

        {/* Metric 2: Estimated Savings */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 block tracking-wider">Estimated Care Savings</span>
            {loading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className="text-2xl font-black text-emerald-800 font-mono mt-1 leading-none">
                ₱{(data?.estimatedMoneySaved ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            )}
            <span className="text-[9px] text-zinc-400 mt-1 block">Subsidized diet balance</span>
          </div>
        </div>

        {/* Metric 3: Paid Meals Count */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 block tracking-wider">Personal Cash Purchases</span>
            {loading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-black text-zinc-950 font-mono mt-1 leading-none">{data?.totalPaidMeals ?? 0}</p>
            )}
            <span className="text-[9px] text-zinc-400 mt-1 block">Meals purchased off-roster</span>
          </div>
        </div>
      </div>

      {/* Monthly Meal Budget Tracking */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 mt-6 shadow-xs flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-6 w-full" />
        </div>
      ) : (
        data?.monthlyMealAllocation !== undefined && data?.mealsClaimedThisMonth !== undefined && (
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 mt-6 shadow-xs flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-700 border border-violet-100 shrink-0">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-zinc-900 font-sans uppercase tracking-tight">Monthly Meal Allocation</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Visualize your cafeteria meal claims for the current month.</p>
              </div>
            </div>
            
            <div className="mt-2">
              <div className="flex justify-between text-xs font-bold text-zinc-700 mb-2">
                <span>{data.mealsClaimedThisMonth} Meals Claimed</span>
                <span>{data.monthlyMealAllocation} Total Allocation</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-3.5 mb-2 overflow-hidden border border-zinc-200 relative">
                <div 
                  className={`h-3.5 rounded-full ${
                    (data.mealsClaimedThisMonth / data.monthlyMealAllocation) > 0.85 
                      ? "bg-rose-500" 
                      : "bg-violet-600"
                  } transition-all duration-1000 ease-out`} 
                  style={{ width: `${Math.min(100, (data.mealsClaimedThisMonth / data.monthlyMealAllocation) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase font-mono text-zinc-500">
                <span>
                  {Math.max(0, data.monthlyMealAllocation - data.mealsClaimedThisMonth)} Meals Remaining
                </span>
                <span>
                  {Math.round((data.mealsClaimedThisMonth / data.monthlyMealAllocation) * 100)}% Consumed
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {/* 3. Fast Operations Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* Quick Action Block 1: QR Badge Access */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-800 mb-4 border border-teal-100">
              <QrCode className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-zinc-900 font-sans uppercase tracking-tight">Printable Badge QR Code</h4>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Show your unique digital cafeteria scan badge at the counter register to automatically activate your cafeteria allowances.
            </p>
          </div>
          <button
            onClick={() => onViewChange("employee-qr")}
            className="w-full text-center py-2.5 px-4 bg-[#003299] hover:bg-[#002d8a] text-white rounded-xl text-xs font-bold font-sans mt-5 transition-colors"
          >
            Access My QR Badge
          </button>
        </div>

        {/* Quick Action Block 2: Work Schedule Access */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 mb-4 border border-amber-100">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-zinc-900 font-sans uppercase tracking-tight">Work Roster Calendar</h4>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Audit dates where you have been scheduled for day or night duty, which dictates when you are eligible for the daily free meal credit.
            </p>
          </div>
          <button
            onClick={() => onViewChange("employee-schedule")}
            className="w-full text-center py-2.5 px-4 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold font-sans mt-5 transition-colors"
          >
            Check Duty Rosters
          </button>
        </div>

      </div>
    </div>
  );
}
