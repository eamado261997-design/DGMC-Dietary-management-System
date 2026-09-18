import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { TrendingUp, BarChart3, DollarSign, Activity, Clock, RefreshCw, Zap, Flame, CalendarDays, Filter, RotateCcw, Calendar } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { processHourlyVolumeAndPricing, parseTransactionDate, HourlyVolumePricingPoint } from "../utils/analytics.js";
import { Transaction } from "../types.js";

// DGMC Hospital Dietary System - Color Palette & Dark Mode Definition
const DGMC_THEME_PALETTE = {
  light: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    border: "#e2e8f0",
    grid: "#e2e8f0",
    axisText: "#64748b",
    axisLine: "#cbd5e1",
    volume: {
      stroke: "#003299", // DGMC Signature Royal Navy
      fill: "#003299",
      activeFill: "#002570",
      areaFill: "rgba(0, 50, 153, 0.12)",
    },
    price: {
      stroke: "#059669", // DGMC Clinical Emerald
      fill: "#059669",
      activeFill: "#047857",
      areaFill: "rgba(5, 150, 105, 0.10)",
    },
    tooltip: {
      bg: "rgba(255, 255, 255, 0.96)",
      border: "#cbd5e1",
      shadow: "0 12px 28px -4px rgba(0, 50, 153, 0.15), 0 6px 12px -2px rgba(0, 0, 0, 0.05)",
    }
  },
  dark: {
    bg: "#09090b",
    cardBg: "#121212",
    border: "#27272a",
    grid: "#27272a",
    axisText: "#94a3b8",
    axisLine: "#334155",
    volume: {
      stroke: "#38bdf8", // DGMC Sky Blue / High Contrast Accessible Blue
      fill: "#38bdf8",
      activeFill: "#0284c7",
      areaFill: "rgba(56, 189, 248, 0.20)",
    },
    price: {
      stroke: "#4ade80", // DGMC Vivid Emerald for dark mode
      fill: "#4ade80",
      activeFill: "#22c55e",
      areaFill: "rgba(74, 222, 128, 0.18)",
    },
    tooltip: {
      bg: "rgba(18, 18, 18, 0.96)",
      border: "#3f3f46",
      shadow: "0 12px 30px -4px rgba(0, 0, 0, 0.85)",
    }
  }
};

// Custom DGMC Tooltip Component
function DGMCTransactionTooltip({ active, payload, label, currencySymbol, isDark }: {
  active?: boolean;
  payload?: any[];
  label?: string;
  currencySymbol: string;
  isDark: boolean;
}) {
  if (!active || !payload || !payload.length) return null;

  const currentTheme = isDark ? DGMC_THEME_PALETTE.dark : DGMC_THEME_PALETTE.light;

  return (
    <div
      className={`rounded-2xl p-3.5 text-xs border backdrop-blur-md min-w-[190px] transition-all select-none ${
        isDark ? "bg-zinc-900/95 border-zinc-700 text-zinc-100" : "bg-white/95 border-zinc-200 text-zinc-900"
      }`}
      style={{ boxShadow: currentTheme.tooltip.shadow }}
    >
      <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-zinc-200/80 dark:border-zinc-800 font-mono text-[11px] font-bold">
        <Clock className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-teal-700"}`} />
        <span className={isDark ? "text-zinc-200" : "text-zinc-800"}>Time Window: {label}</span>
      </div>

      <div className="space-y-2 font-sans">
        {payload.map((entry: any, index: number) => {
          const isVolume = entry.dataKey === "volume";
          const color = isVolume ? currentTheme.volume.stroke : currentTheme.price.stroke;
          const formattedVal = isVolume
            ? `${entry.value} ${entry.value === 1 ? "transaction" : "transactions"}`
            : `${currencySymbol}${Number(entry.value).toFixed(2)}`;

          return (
            <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                <span className={isDark ? "text-zinc-400 font-medium" : "text-zinc-600 font-medium"}>
                  {entry.name}:
                </span>
              </div>
              <span className="font-mono font-bold" style={{ color }}>
                {formattedVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TransactionSummaryProps {
  totalVolume?: number;
  totalRevenue?: number;
  avgMealPrice?: number;
  chartData?: Array<{ time: string; volume: number; avgPrice: number }>;
  currencySymbol?: string;
  disableAutoFetch?: boolean;
}

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getYestStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TransactionSummaryWidget({
  totalVolume = 0,
  totalRevenue = 0,
  avgMealPrice = 0,
  chartData = [],
  currencySymbol = "₱",
  disableAutoFetch = false
}: TransactionSummaryProps) {
  const { apiFetch, theme } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return (
        document.documentElement.classList.contains("high-contrast-dark") ||
        document.documentElement.classList.contains("dark") ||
        theme === "dark"
      );
    }
    return theme === "dark";
  });

  // Keep isDark reactive to class mutations or theme toggles
  useEffect(() => {
    const evaluateDark = () => {
      const isDarkActive =
        (typeof document !== "undefined" &&
          (document.documentElement.classList.contains("high-contrast-dark") ||
            document.documentElement.classList.contains("dark"))) ||
        theme === "dark";
      setIsDark(isDarkActive);
    };

    evaluateDark();

    if (typeof document !== "undefined") {
      const observer = new MutationObserver(evaluateDark);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    }
  }, [theme]);

  const currentTheme = isDark ? DGMC_THEME_PALETTE.dark : DGMC_THEME_PALETTE.light;

  const [liveChartData, setLiveChartData] = useState<HourlyVolumePricingPoint[]>(chartData);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRolling24h, setIsRolling24h] = useState(true);
  const [activeMetricView, setActiveMetricView] = useState<"all" | "volume" | "price">("all");

  // Date Range Picker States
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "7d" | "30d" | "custom">("today");
  const [startDate, setStartDate] = useState<string>(getTodayStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [appliedDates, setAppliedDates] = useState<{ start: string; end: string; label: string }>({
    start: getTodayStr(),
    end: getTodayStr(),
    label: "Today (Last 24h)"
  });

  // Local derived or fetched stats
  const [fetchedMetrics, setFetchedMetrics] = useState<{
    volume: number;
    revenue: number;
    avgPrice: number;
  } | null>(null);

  // Fetch data from /api/admin/reports/meals with date filtering
  const fetchRealTimeMeals = useCallback(async (startOverride?: string, endOverride?: string, presetOverride?: string) => {
    if (disableAutoFetch) return;
    try {
      setLoading(true);
      const start = startOverride !== undefined ? startOverride : appliedDates.start;
      const end = endOverride !== undefined ? endOverride : appliedDates.end;
      const currentPreset = presetOverride !== undefined ? presetOverride : datePreset;

      const isTodayOnly = currentPreset === "today" || (start === getTodayStr() && end === getTodayStr());
      
      // When rolling 24h is active for today, query from yesterday to capture the full 24h window
      const queryStart = isTodayOnly && isRolling24h ? getYestStr() : start;

      const queryParams = new URLSearchParams();
      if (queryStart) queryParams.set("startDate", queryStart);
      if (end) queryParams.set("endDate", end);

      const endpoint = `/api/admin/reports/meals${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const meals: Transaction[] = await apiFetch(endpoint);

      if (Array.isArray(meals)) {
        const computed = processHourlyVolumeAndPricing(meals, isTodayOnly ? undefined : start, {
          rolling24Hours: isRolling24h && isTodayOnly,
          useAllTransactions: !isTodayOnly
        });
        setLiveChartData(computed);
        setLastUpdated(new Date());

        // Derive metrics from the filtered response
        const completed = meals.filter(m => !m.status || m.status === "completed");
        
        // When in rolling 24h mode, filter exactly within the last 24 elapsed hours
        const nowMs = Date.now();
        const twentyFourHoursAgoMs = nowMs - 24 * 3600 * 1000;
        const activeTxs = isTodayOnly && isRolling24h
          ? completed.filter(m => {
              const tDate = parseTransactionDate(m);
              if (!tDate) return false;
              const tMs = tDate.getTime();
              return tMs >= twentyFourHoursAgoMs && tMs <= nowMs + 60000;
            })
          : completed;

        const vol = activeTxs.length;
        const paidMeals = activeTxs.filter(m => !m.is_free && Number(m.meal_amount) > 0);
        const rev = paidMeals.reduce((acc, m) => acc + (Number(m.meal_amount) || 0), 0);
        const avg = paidMeals.length > 0 ? rev / paidMeals.length : 0;

        setFetchedMetrics({
          volume: vol,
          revenue: rev,
          avgPrice: avg
        });
      }
    } catch (err) {
      console.warn("[TransactionSummaryWidget] Failed to fetch /api/admin/reports/meals:", err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, disableAutoFetch, isRolling24h, appliedDates.start, appliedDates.end, datePreset]);

  // Single effect triggers fetch when applied date range or rolling mode changes, with 30s poll for today
  useEffect(() => {
    fetchRealTimeMeals(appliedDates.start, appliedDates.end, datePreset);

    if (disableAutoFetch || datePreset !== "today") return;

    const interval = setInterval(() => {
      fetchRealTimeMeals(appliedDates.start, appliedDates.end, datePreset);
    }, 30000);
    return () => clearInterval(interval);
  }, [appliedDates.start, appliedDates.end, datePreset, isRolling24h, disableAutoFetch, fetchRealTimeMeals]);

  // Handle preset selections
  const handlePresetSelect = (preset: "today" | "yesterday" | "7d" | "30d" | "custom") => {
    setDatePreset(preset);
    const today = getTodayStr();

    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
      setAppliedDates({ start: today, end: today, label: "Today (Last 24h)" });
    } else if (preset === "yesterday") {
      const yest = getYestStr();
      setStartDate(yest);
      setEndDate(yest);
      setAppliedDates({ start: yest, end: yest, label: "Yesterday" });
    } else if (preset === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setStartDate(s);
      setEndDate(today);
      setAppliedDates({ start: s, end: today, label: "Last 7 Days" });
    } else if (preset === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setStartDate(s);
      setEndDate(today);
      setAppliedDates({ start: s, end: today, label: "Last 30 Days" });
    }
  };

  const handleApplyCustomDateRange = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) return;

    // Automatic inversion protection if start is after end
    let s = startDate;
    let end = endDate;
    if (s > end) {
      s = endDate;
      end = startDate;
      setStartDate(s);
      setEndDate(end);
    }

    setDatePreset("custom");
    const label = s === end ? `Single Date (${s})` : `${s} to ${end}`;
    setAppliedDates({ start: s, end: end, label });
  };

  const handleResetToToday = () => {
    handlePresetSelect("today");
  };

  // Fallback to prop-passed chartData if available and no live data yet
  const effectiveChartData = liveChartData.length > 0 ? liveChartData : chartData;

  // Compute summary stats for the active range
  const totalRangeVolume = useMemo(() => {
    return effectiveChartData.reduce((acc, curr) => acc + (curr.volume || 0), 0);
  }, [effectiveChartData]);

  const peakHour = useMemo(() => {
    let max = -1;
    let peakSlot = "--:--";
    effectiveChartData.forEach(d => {
      if (d.volume > max && d.volume > 0) {
        max = d.volume;
        peakSlot = d.time;
      }
    });
    return { time: peakSlot, volume: max > 0 ? max : 0 };
  }, [effectiveChartData]);

  const displayVolume = fetchedMetrics ? fetchedMetrics.volume : totalVolume;
  const displayRevenue = fetchedMetrics ? fetchedMetrics.revenue : totalRevenue;
  const displayAvgPrice = fetchedMetrics ? fetchedMetrics.avgPrice : avgMealPrice;
  const hasActiveScans = displayVolume > 0;

  return (
    <div className={`w-full border rounded-3xl p-6 shadow-xs space-y-6 transition-colors duration-200 overflow-hidden ${
      isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
    }`}>
      {/* Header section with live sync indicators */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
            isDark ? "bg-teal-950/60 border-teal-800/60 text-sky-400" : "bg-teal-50 border-teal-150 text-teal-800"
          }`}>
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-sm font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
              Transaction &amp; Pricing Summary
            </h3>
            <p className={`text-[11px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Daily volume and average meal pricing trends with date filtering
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-mono font-bold border transition-colors ${
            isDark ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}>
            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            LIVE METRICS
          </div>
          <button
            onClick={() => fetchRealTimeMeals()}
            disabled={loading}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-mono font-medium border transition-colors disabled:opacity-50 cursor-pointer ${
              isDark
                ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200"
                : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}
            title="Refresh transaction data from /api/admin/reports/meals"
          >
            <RefreshCw className={`w-3 h-3 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* Metric Cards Row - Responsive Grid Layout */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden">
        <div className={`w-full p-4 rounded-2xl border transition-colors overflow-hidden ${
          isDark ? "bg-zinc-950/70 border-zinc-800" : "bg-zinc-50 border-zinc-200/80"
        }`}>
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            {datePreset === "today" ? "Total Daily Volume" : "Filtered Total Volume"}
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {displayVolume}
            </span>
            {hasActiveScans ? (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                isDark 
                  ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/60" 
                  : "text-emerald-700 bg-emerald-50 border-emerald-100"
              }`}>
                <TrendingUp className="w-3 h-3" /> Live Active
              </span>
            ) : (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                isDark ? "text-zinc-500 bg-zinc-900 border-zinc-800" : "text-zinc-400 bg-zinc-100 border-zinc-200"
              }`}>
                No Transactions
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            {datePreset === "today" ? "Redemptions & salary deduction sales today" : `Transactions in ${appliedDates.label}`}
          </p>
        </div>

        <div className={`w-full p-4 rounded-2xl border transition-colors overflow-hidden ${
          isDark ? "bg-zinc-950/70 border-zinc-800" : "bg-zinc-50 border-zinc-200/80"
        }`}>
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            {datePreset === "today" ? "Total Gross Revenue" : "Filtered Gross Revenue"}
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {currencySymbol}{displayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              isDark 
                ? "text-sky-400 bg-sky-950/60 border-sky-800/50" 
                : "text-teal-800 bg-teal-50 border-teal-150"
            }`}>
              Paid Sales
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Manual price overrides &amp; cash</p>
        </div>

        <div className={`w-full p-4 rounded-2xl border transition-colors overflow-hidden md:col-span-2 lg:col-span-1 ${
          isDark ? "bg-zinc-950/70 border-zinc-800" : "bg-zinc-50 border-zinc-200/80"
        }`}>
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            Average Meal Pricing
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-2xl font-black tracking-tight ${isDark ? "text-emerald-400" : "text-teal-900"}`}>
              {currencySymbol}{displayAvgPrice.toFixed(2)}
            </span>
            {displayAvgPrice > 0 ? (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                isDark 
                  ? "text-emerald-300 bg-emerald-950/60 border-emerald-800/60" 
                  : "text-emerald-700 bg-emerald-50 border-emerald-100"
              }`}>
                <DollarSign className="w-3 h-3" /> Real Average
              </span>
            ) : (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                isDark ? "text-zinc-500 bg-zinc-900 border-zinc-800" : "text-zinc-400 bg-zinc-100 border-zinc-200"
              }`}>
                No Paid Sales
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Mean price per paid transaction</p>
        </div>
      </div>

      {/* Hourly Volume & Pricing Trend Section */}
      <div className={`w-full space-y-4 pt-2 border-t transition-colors ${
        isDark ? "border-zinc-800" : "border-zinc-100"
      }`}>
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${isDark ? "text-sky-400" : "text-teal-600"}`} />
              <h4 className={`text-xs font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                Hourly Volume &amp; Pricing Trend
              </h4>
            </div>
            <p className={`text-[10px] font-medium mt-0.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Hourly transaction volume curve from <code className={`px-1 py-0.5 rounded font-mono text-[9px] ${
                isDark ? "text-sky-300 bg-zinc-800" : "text-teal-700 bg-teal-50"
              }`}>/api/admin/reports/meals</code> filtered by date selection
            </p>
          </div>

          {/* Quick interactive filters & badges */}
          <div className="flex items-center flex-wrap gap-2">
            {peakHour.volume > 0 && (
              <div className={`flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border ${
                isDark 
                  ? "text-amber-400 bg-amber-950/50 border-amber-800/60" 
                  : "text-amber-700 bg-amber-50 border-amber-200/70"
              }`} title="Peak traffic hour in selection">
                <Flame className="w-3 h-3 text-amber-500" />
                Peak: <strong className="font-bold">{peakHour.time}</strong> ({peakHour.volume} scans)
              </div>
            )}

            <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
              isDark 
                ? "bg-sky-950/60 text-sky-300 border-sky-800/50" 
                : "bg-teal-50 text-teal-800 border-teal-150"
            }`}>
              <Zap className={`w-3 h-3 ${isDark ? "text-sky-400" : "text-teal-600"}`} />
              Volume: {totalRangeVolume} {totalRangeVolume === 1 ? "scan" : "scans"}
            </div>

            {/* Metric Selector Toggle */}
            <div className={`inline-flex rounded-lg p-0.5 border text-[10px] font-medium ${
              isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-100 border-zinc-200"
            }`}>
              <button
                type="button"
                onClick={() => setActiveMetricView("all")}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeMetricView === "all"
                    ? isDark ? "bg-zinc-800 text-white font-bold shadow-xs" : "bg-white text-zinc-900 font-bold shadow-xs"
                    : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveMetricView("volume")}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeMetricView === "volume"
                    ? isDark 
                      ? "bg-sky-950 text-sky-400 font-bold shadow-xs border border-sky-800/40" 
                      : "bg-white text-teal-800 font-bold shadow-xs"
                    : isDark ? "text-zinc-400 hover:text-sky-300" : "text-zinc-600 hover:text-teal-800"
                }`}
              >
                Volume
              </button>
              <button
                type="button"
                onClick={() => setActiveMetricView("price")}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeMetricView === "price"
                    ? isDark 
                      ? "bg-emerald-950 text-emerald-400 font-bold shadow-xs border border-emerald-800/40" 
                      : "bg-white text-emerald-800 font-bold shadow-xs"
                    : isDark ? "text-zinc-400 hover:text-emerald-300" : "text-zinc-600 hover:text-emerald-800"
                }`}
              >
                Price
              </button>
            </div>

            {/* Timeline mode toggle (active when viewing today) */}
            {datePreset === "today" && (
              <button
                type="button"
                onClick={() => setIsRolling24h(!isRolling24h)}
                className={`text-[10px] font-mono border px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  isDark
                    ? "text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 border-zinc-700"
                    : "text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border-zinc-200"
                }`}
                title="Toggle rolling 24 hours vs 00:00 - 23:00 timeline"
              >
                {isRolling24h ? "Rolling 24h" : "00:00 - 23:00"}
              </button>
            )}
          </div>
        </div>

        {/* Date Range Picker Bar directly above the chart */}
        <div className={`w-full border rounded-2xl p-3.5 space-y-3 transition-colors ${
          isDark ? "bg-zinc-950/80 border-zinc-800" : "bg-zinc-50/90 border-zinc-200"
        }`}>
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Quick Presets */}
            <div className="flex items-center flex-wrap gap-1.5">
              <div className={`flex items-center gap-1.5 text-xs font-bold mr-1 ${
                isDark ? "text-zinc-200" : "text-zinc-800"
              }`}>
                <CalendarDays className={`w-4 h-4 ${isDark ? "text-sky-400" : "text-teal-700"}`} />
                <span>Filter Date:</span>
              </div>
              {(["today", "yesterday", "7d", "30d", "custom"] as const).map((p) => {
                const labels: Record<string, string> = {
                  today: "Today (24h)",
                  yesterday: "Yesterday",
                  "7d": "Last 7 Days",
                  "30d": "Last 30 Days",
                  custom: "Custom Range",
                };
                const isActive = datePreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      isActive
                        ? isDark
                          ? "bg-sky-600 text-white font-semibold shadow-xs"
                          : "bg-teal-700 text-white font-semibold shadow-xs"
                        : isDark
                          ? "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-700"
                          : "bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200"
                    }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>

            {/* Active Range Summary */}
            <div className={`text-[11px] font-mono flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              isDark
                ? "text-zinc-300 bg-zinc-900 border-zinc-800"
                : "text-zinc-600 bg-white border-zinc-200/80"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span>Selection: <strong className={`font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{appliedDates.label}</strong></span>
            </div>
          </div>

          {/* Custom Date Selection Row */}
          <form onSubmit={handleApplyCustomDateRange} className={`flex flex-wrap items-center gap-2.5 pt-2 border-t ${
            isDark ? "border-zinc-800" : "border-zinc-200/70"
          }`}>
            <div className="flex items-center gap-1.5">
              <label className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>From:</label>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                className={`text-xs border rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 font-mono shadow-2xs ${
                  isDark
                    ? "bg-zinc-900 border-zinc-700 text-white focus:ring-sky-500/20 focus:border-sky-500"
                    : "bg-white border-zinc-300 text-zinc-800 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>To:</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                className={`text-xs border rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 font-mono shadow-2xs ${
                  isDark
                    ? "bg-zinc-900 border-zinc-700 text-white focus:ring-sky-500/20 focus:border-sky-500"
                    : "bg-white border-zinc-300 text-zinc-800 focus:ring-teal-500/20 focus:border-teal-500"
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !startDate || !endDate}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${
                isDark
                  ? "bg-sky-600 hover:bg-sky-500 text-white"
                  : "bg-teal-800 hover:bg-teal-900 text-white"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {loading ? "Filtering..." : "Filter Range"}
            </button>

            {(datePreset !== "today" || startDate !== getTodayStr() || endDate !== getTodayStr()) && (
              <button
                type="button"
                onClick={handleResetToToday}
                className={`flex items-center gap-1 text-xs border px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? "text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-700"
                    : "text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-100 border-zinc-200"
                }`}
                title="Reset date filter back to today"
              >
                <RotateCcw className="w-3 h-3 text-zinc-400" />
                Reset Today
              </button>
            )}
          </form>
        </div>

        {/* Responsive Recharts Container */}
        <div
          id="dgmc-recharts-aspect-container"
          className={`w-full h-72 sm:h-80 md:h-96 lg:h-[380px] min-h-[260px] relative rounded-2xl p-2 sm:p-4 transition-all duration-200 border overflow-hidden flex flex-col justify-center ${
            isDark
              ? "bg-zinc-950/80 border-zinc-800 shadow-inner"
              : "bg-gradient-to-b from-slate-50/70 to-white border-zinc-200/90 shadow-2xs"
          }`}
        >
          {totalRangeVolume === 0 && !loading && (
            <div className={`absolute inset-2 flex flex-col items-center justify-center rounded-xl z-10 p-6 text-center backdrop-blur-xs ${
              isDark ? "bg-zinc-950/85 text-zinc-300" : "bg-white/85 text-zinc-700"
            }`}>
              <Calendar className={`w-8 h-8 mb-2 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
              <p className="text-xs font-bold">No transaction records found for {appliedDates.label}</p>
              <p className={`text-[10px] mt-1 max-w-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                The API returned 0 matching transactions for this date window. Try picking another date range or click "Reset Today".
              </p>
            </div>
          )}

          <div className="w-full h-full min-w-0 min-h-0 flex-1 relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} className="dgmc-responsive-container">
              <LineChart
                data={effectiveChartData}
                margin={{ top: 16, right: activeMetricView === "volume" ? 16 : 28, left: 0, bottom: 6 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={currentTheme.grid}
                />

                <XAxis
                  dataKey="time"
                  stroke={currentTheme.axisText}
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: currentTheme.axisLine }}
                  minTickGap={20}
                />

                <YAxis
                  yAxisId="volume"
                  stroke={currentTheme.volume.stroke}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                  tickFormatter={(v) => `${v}`}
                />

                {activeMetricView !== "volume" && (
                  <YAxis
                    yAxisId="price"
                    orientation="right"
                    stroke={currentTheme.price.stroke}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    tickFormatter={(v) => `${currencySymbol}${v}`}
                  />
                )}

                <Tooltip
                  content={<DGMCTransactionTooltip currencySymbol={currencySymbol} isDark={isDark} />}
                />

                <Legend
                  wrapperStyle={{
                    fontSize: "11px",
                    paddingTop: "6px",
                    color: currentTheme.axisText
                  }}
                  formatter={(value) => (
                    <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                      {value}
                    </span>
                  )}
                  iconType="circle"
                  iconSize={8}
                />

                {(activeMetricView === "all" || activeMetricView === "volume") && (
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="volume"
                    name="Transaction Volume"
                    stroke={currentTheme.volume.stroke}
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: currentTheme.volume.fill, strokeWidth: 1, stroke: isDark ? "#09090b" : "#ffffff" }}
                    activeDot={{ r: 6, fill: currentTheme.volume.activeFill, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                )}

                {(activeMetricView === "all" || activeMetricView === "price") && (
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="avgPrice"
                    name="Average Price"
                    stroke={currentTheme.price.stroke}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: currentTheme.price.fill, strokeWidth: 1, stroke: isDark ? "#09090b" : "#ffffff" }}
                    activeDot={{ r: 5, fill: currentTheme.price.activeFill, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer info bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between text-[10px] font-mono pt-1 ${
          isDark ? "text-zinc-400" : "text-zinc-500"
        }`}>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>
              Endpoint: GET /api/admin/reports/meals?startDate={appliedDates.start}&amp;endDate={appliedDates.end}
            </span>
          </div>
          <div>
            {lastUpdated ? (
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            ) : (
              <span>Real-time polling: 30s</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
