import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Skeleton } from "../../components/Skeleton.js";
import EmptyState from "../../components/EmptyState.js";
import SystemDiagnostics from "../../components/admin/SystemDiagnostics.js";
import AuthDebugger from "../../components/admin/AuthDebugger.js";
import RBACPermissionMatrix from "../../components/admin/RBACPermissionMatrix.js";
import LatencyPercentilePanel from "../../components/admin/LatencyPercentilePanel.js";
import DiagnosticChart from "../../components/admin/DiagnosticChart.js";
import { Users, Building, Activity, Coins, ClipboardList, TrendingUp, Settings, Clock, Utensils, Cpu, Server, Database, Zap, RefreshCw } from "lucide-react";
import { 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from "recharts";
import {
  Transaction,
  ActivityLog,
  AdminStats,
  BenchmarkAggregate,
  BenchmarkLog,
  SystemPerfData,
  HourlyDataPoint,
  DepartmentChartItem,
  TrendDataPoint,
  SessionDataItem,
  TREND_COLORS,
  formatUptime,
  processHourlyData,
  processDepartmentChartData,
  processDailyTrendData,
  processSessionChartData
} from "../../utils/analytics.js";

export type {
  Transaction,
  ActivityLog,
  AdminStats,
  BenchmarkAggregate,
  BenchmarkLog,
  SystemPerfData,
  HourlyDataPoint,
  DepartmentChartItem,
  TrendDataPoint,
  SessionDataItem
};

export interface RechartsTooltipPayloadItem {
  payload: Record<string, unknown>;
  value?: number | string;
  name?: string;
  color?: string;
  fill?: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: RechartsTooltipPayloadItem[];
  label?: string | number;
}

// Custom Tooltip component for hourly scans (Cafeteria Hourly Density)
const HourlyTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as unknown as HourlyDataPoint;
    const departmentsArray = Object.entries(data.departments || {}).sort((a, b) => b[1] - a[1]);
    
    return (
      <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl border border-zinc-800 text-xs max-w-xs font-sans min-w-[200px]">
        <div className="font-bold text-zinc-100 text-[13px] border-b border-zinc-800 pb-2 mb-2 flex justify-between items-center">
          <span>Hour: {data.label}</span>
          <span className="px-2 py-0.5 bg-teal-950 text-teal-300 rounded-full text-[10px] uppercase font-mono font-bold">
            Activity Load
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center py-1">
            <span className="text-zinc-400">Total Swipes:</span>
            <span className="font-mono text-teal-400 font-extrabold text-[14px]">
              {data.scans} scan{data.scans !== 1 ? 's' : ''}
            </span>
          </div>
          {departmentsArray.length > 0 ? (
            <div className="border-t border-zinc-800 pt-2 mt-2">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold mb-1.5">
                Department Scans Breakdown:
              </p>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {departmentsArray.map(([dept, count]) => (
                  <div key={dept} className="flex justify-between items-center text-zinc-300 text-[11px]">
                    <span className="truncate max-w-[130px] font-medium" title={dept}>{dept}</span>
                    <span className="font-mono text-teal-400 font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500 italic mt-2">No department recordings in this block</p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip component for department meal redemption breakdown
const DepartmentTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as unknown as DepartmentChartItem;
    const total = data.total || 0;
    const freePct = total > 0 ? Math.round((data.free / total) * 100) : 0;
    const paidPct = total > 0 ? Math.round((data.paid / total) * 100) : 0;

    return (
      <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl border border-zinc-800 text-xs max-w-sm font-sans min-w-[220px]">
        <div className="font-bold text-zinc-100 text-[13px] border-b border-zinc-800 pb-2 mb-2 truncate" title={data.department}>
          {data.department}
        </div>
        <div className="space-y-2">
          {/* Total row */}
          <div className="flex justify-between items-center py-0.5">
            <span className="text-zinc-400">Total Redeemed:</span>
            <span className="font-mono text-zinc-100 font-extrabold text-[13px]">{total} meals</span>
          </div>
          
          <div className="space-y-1.5 border-t border-zinc-800 pt-2">
            {/* Free row */}
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span>Free (Voucher):</span>
              </span>
              <span className="font-mono text-teal-400 font-bold">
                {data.free} <span className="text-[10px] text-zinc-400 font-normal">({freePct}%)</span>
              </span>
            </div>
            
            {/* Paid row */}
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Paid (Cash):</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {data.paid} <span className="text-[10px] text-zinc-400 font-normal">({paidPct}%)</span>
              </span>
            </div>
          </div>
          
          {/* Progress bar visual */}
          {total > 0 && (
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex mt-2">
              <div style={{ width: `${freePct}%` }} className="bg-teal-500 h-full" />
              <div style={{ width: `${paidPct}%` }} className="bg-amber-500 h-full" />
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Daily Employee Meal Consumption Trends by Department
const DailyTrendTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc: number, entry) => acc + (Number(entry.value) || 0), 0);
    return (
      <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl border border-zinc-800 text-xs max-w-sm font-sans min-w-[220px]">
        <div className="font-bold text-zinc-100 text-[13px] border-b border-zinc-800 pb-2 mb-2 flex justify-between items-center">
          <span>Date: {label}</span>
          <span className="px-2 py-0.5 bg-teal-950 text-teal-300 rounded-full text-[10px] uppercase font-mono font-bold">
            Daily Trend
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-0.5 border-b border-zinc-800 pb-2">
            <span className="text-zinc-400">Total Consumed:</span>
            <span className="font-mono text-zinc-100 font-extrabold text-[13px]">{total} meals</span>
          </div>
          <div className="space-y-1.5 pt-1">
            {payload.map((entry) => {
              if (Number(entry.value) === 0) return null;
              const pct = total > 0 ? Math.round((Number(entry.value) / total) * 100) : 0;
              return (
                <div key={entry.name} className="flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: entry.color || entry.fill }}
                    />
                    <span className="truncate max-w-[130px]" title={entry.name}>{entry.name}:</span>
                  </span>
                  <span className="font-mono text-teal-400 font-bold">
                    {entry.value} <span className="text-[10px] text-zinc-400 font-normal">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Meal Sessions
const SessionTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as unknown as SessionDataItem;
    return (
      <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl border border-zinc-800 text-xs font-sans min-w-[200px]">
        <div className="font-bold text-zinc-100 text-[13px] border-b border-zinc-800 pb-2 mb-2 flex justify-between items-center">
          <span>{data.session} Session</span>
          <span className="px-2 py-0.5 bg-sky-950 text-sky-300 rounded-full text-[9px] uppercase font-mono font-bold">
            Roster Period
          </span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-zinc-400">Staff Swiped:</span>
          <span className="font-mono text-sky-450 font-extrabold text-[14px]">
            {data["Meal Check-ins"]} check-ins
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard({ onViewChange }: { onViewChange: (v: string) => void }) {
  const { apiFetch, branding } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Benchmarking Utility state
  const [benchmarks, setBenchmarks] = useState<SystemPerfData | null>(null);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [autoRefreshBenchmarks, setAutoRefreshBenchmarks] = useState(true);

  const fetchBenchmarks = (showLoader = false) => {
    if (showLoader) setBenchmarksLoading(true);
    apiFetch("/api/admin/sys-perf")
      .then((data: SystemPerfData) => {
        setBenchmarks(data);
      })
      .catch((err) => console.error("Failed to fetch API benchmarks", err))
      .finally(() => {
        if (showLoader) setBenchmarksLoading(false);
      });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/admin/stats"),
      apiFetch("/api/admin/reports/meals")
    ])
      .then(([statsData, mealsData]: [AdminStats, Transaction[]]) => {
        setStats(statsData);
        setTransactions(mealsData || []);
      })
      .catch((err) => console.error("Stats fetching failed", err))
      .finally(() => setLoading(false));

    // Fetch benchmarks initially
    fetchBenchmarks(true);
  }, []);

  useEffect(() => {
    if (!autoRefreshBenchmarks) return;
    const interval = setInterval(() => {
      fetchBenchmarks(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefreshBenchmarks]);

  // Compute Cafeteria Peak Hours (24-hour distribution) with department breakdowns
  const hourlyData = useMemo<HourlyDataPoint[]>(() => {
    return processHourlyData(transactions);
  }, [transactions]);

  // Compute Meal Types (Free vs Paid) per Department
  const deptChartData = useMemo<DepartmentChartItem[]>(() => {
    return processDepartmentChartData(transactions);
  }, [transactions]);

  // Compute Daily Meal Consumption Trends by Department (Chronological)
  const { trendChartData, activeDeptsList } = useMemo<{ trendChartData: TrendDataPoint[]; activeDeptsList: string[] }>(() => {
    return processDailyTrendData(transactions);
  }, [transactions]);

  // Compute Meal Sessions Check-ins
  const sessionChartData = useMemo<SessionDataItem[]>(() => {
    return processSessionChartData(transactions);
  }, [transactions]);

  return (
    <div id="admin-dashboard-page">
      <PageHeader
        title="Administrator Dashboard"
        subtitle={`${branding.companyName} Cafeteria Operations Hub`}
      />

          <div className="space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Personnel Registry</span>
                  {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.totalPeople}</span>
                  )}
                  <span className="text-[10px] text-zinc-550 block mt-0.5">Staff &amp; accounts</span>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Departments</span>
                  {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.totalDepartments}</span>
                  )}
                  <span className="text-[10px] text-zinc-550 block mt-0.5">Assigned divisions</span>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Free Meals Today</span>
                  {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.freeMealsToday}</span>
                  )}
                  <span className="text-[10px] text-zinc-550 block mt-0.5">Vouchers redeemed</span>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Cash Earnings Today</span>
                  {loading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <span className="text-2xl font-black text-zinc-900 leading-tight block">₱{stats?.paidAmountToday?.toFixed(2)}</span>
                  )}
                  <span className="text-[10px] text-zinc-550 block mt-0.5">{loading ? "" : `${stats?.cashMealsTodayCount} paid transactions`}</span>
                </div>
              </div>

            </div>

            {/* Operational Watch & Daily Indicators Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Active Employees Card */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block mb-1">Active Employees</span>
                    {loading ? (
                      <Skeleton className="h-8 w-28 mt-1" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-zinc-950 leading-none">
                          {stats?.activeEmployees ?? 0}
                        </span>
                        <span className="text-xs font-mono text-zinc-450">/ {stats?.totalEmployees ?? 0} total</span>
                      </div>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 relative">
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 border-t border-zinc-100 pt-3 flex items-center gap-2 text-xs text-zinc-550">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>Active employee accounts currently authorized in system.</span>
                </div>
              </div>

              {/* Pending Meal Requests Card */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block mb-1">Pending Meal Entitlements</span>
                    {loading ? (
                      <Skeleton className="h-8 w-28 mt-1" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-zinc-950 leading-none">
                          {stats?.pendingMealRequests ?? 0}
                        </span>
                        <span className="text-xs font-mono text-zinc-450">awaiting QR scan today</span>
                      </div>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 relative">
                    {!loading && (stats?.pendingMealRequests ?? 0) > 0 && (
                      <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    )}
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 border-t border-zinc-100 pt-3 flex items-center gap-2 text-xs text-zinc-550">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(!loading && (stats?.pendingMealRequests ?? 0) > 0) ? "bg-amber-500 animate-pulse" : "bg-zinc-350"}`}></span>
                  <span>Scheduled staff who haven't claimed their meal vouchers yet today.</span>
                </div>
              </div>

              {/* Recent Transactions Card */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block mb-1">Recent Transactions</span>
                    {loading ? (
                      <Skeleton className="h-8 w-28 mt-1" />
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-zinc-950 leading-none">
                          {stats?.recentTransactions?.length ?? 0}
                        </span>
                        <span className="text-xs font-mono text-zinc-450">logged entries</span>
                      </div>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 border-t border-zinc-100 pt-3 flex items-center gap-2 text-xs text-zinc-550">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"></span>
                  <span>Latest digital cafeteria voucher &amp; cash transactions.</span>
                </div>
              </div>
            </div>

            {/* Operational Intelligence & Chart Suite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Peak Cafeteria Hours Chart */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Cafeteria Hourly Density</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Hourly distribution of employee meal logs</p>
                  </div>
                </div>

                <div className="relative h-64 min-h-[256px] w-full overflow-hidden mt-4">
                  {loading ? (
                    <div className="w-full h-full flex flex-col justify-between p-2 space-y-4">
                      <div className="flex items-end justify-between flex-1 gap-2">
                        {[...Array(12)].map((_, i) => (
                          <Skeleton 
                            key={i} 
                            className="w-full bg-zinc-100/85 rounded-t-lg"
                            style={{ height: `${20 + (i % 3) * 25}%` }} 
                          />
                        ))}
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-2 w-12" />
                        <Skeleton className="h-2 w-12" />
                        <Skeleton className="h-2 w-12" />
                      </div>
                    </div>
                  ) : transactions.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No Transactions Recorded"
                      description="No cafeteria transactions available for hourly density calculations."
                      variant="dashed"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis 
                          dataKey="label" 
                          stroke="#71717a" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          interval={2} 
                        />
                        <YAxis 
                          stroke="#71717a" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false} 
                          allowDecimals={false}
                        />
                        <Tooltip content={<HourlyTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="scans" 
                          name="Processed Swipes" 
                          stroke="#0f766e" 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#colorScans)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Department Meal Redeemed Volume & Type Chart */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Transaction Climax by Department</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Top consuming hospital departments by meal type</p>
                  </div>
                </div>

                <div className="relative h-64 min-h-[256px] w-full overflow-hidden mt-4">
                  {loading ? (
                    <div className="w-full h-full flex flex-col justify-between p-2 space-y-4">
                      <div className="flex items-end justify-between flex-1 gap-4">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="flex-1 flex flex-col justify-end space-y-1 h-full">
                            <Skeleton className="w-full bg-amber-100/60 rounded-t-sm" style={{ height: `${10 + (i % 2) * 20}%` }} />
                            <Skeleton className="w-full bg-teal-100/60 rounded-t-sm" style={{ height: `${15 + (i % 3) * 15}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-2 w-16" />
                      </div>
                    </div>
                  ) : deptChartData.length === 0 ? (
                    <EmptyState
                      icon={Utensils}
                      title="No Department Records"
                      description="No department breakdown details recorded for transactions."
                      variant="dashed"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis 
                          dataKey="department" 
                          stroke="#71717a" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 10)}...` : value}
                        />
                        <YAxis 
                          stroke="#71717a" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false} 
                          allowDecimals={false}
                        />
                        <Tooltip content={<DepartmentTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '8px' }} />
                        <Bar dataKey="free" name="Free (Voucher)" fill="#0f766e" stackId="a" />
                        <Bar dataKey="paid" name="Paid (Cash)" fill="#f59e0b" stackId="a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>

            {/* Real-time Check-in Analytics Section */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Active Session Check-ins</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Employee meal check-ins categorized by service periods</p>
                  </div>
                </div>

                <div className="relative h-64 w-full overflow-hidden mt-4">
                  {loading ? (
                    <div className="w-full h-full flex flex-col justify-between p-2 space-y-4">
                      <div className="flex items-end justify-between flex-1 gap-6">
                        {[...Array(4)].map((_, i) => (
                          <Skeleton 
                            key={i} 
                            className="flex-1 bg-sky-100/60 rounded-t-lg"
                            style={{ height: `${25 + (i % 4) * 15}%` }} 
                          />
                        ))}
                      </div>
                      <div className="flex justify-between px-4">
                        <Skeleton className="h-2 w-12" />
                        <Skeleton className="h-2 w-12" />
                        <Skeleton className="h-2 w-12" />
                        <Skeleton className="h-2 w-12" />
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sessionChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis 
                          dataKey="session" 
                          stroke="#71717a" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#71717a" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false} 
                          allowDecimals={false}
                        />
                        <Tooltip content={<SessionTooltip />} />
                        <Bar 
                          dataKey="Meal Check-ins" 
                          fill="#0284c7" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={45}
                        >
                          {sessionChartData.map((_entry: SessionDataItem, index: number) => {
                            const colors = ["#0284c7", "#0f766e", "#f59e0b", "#6366f1"];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Daily Meal Consumption Trends by Department Bar Chart */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Daily Meal Consumption Trends by Department</h3>
                  <p className="text-[10px] text-zinc-500 font-medium">Daily chronological breakdown of employee meal vouchers and cash purchases by active hospital division</p>
                </div>
              </div>

              <div className="relative h-72 min-h-[288px] w-full overflow-hidden mt-4">
                {loading ? (
                  <div className="w-full h-full flex flex-col justify-between p-2 space-y-4">
                    <div className="flex items-end justify-between flex-1 gap-2">
                      {[...Array(15)].map((_, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end h-full">
                          <Skeleton className="w-full bg-zinc-150/80 rounded-t-md" style={{ height: `${15 + (i % 5) * 12}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-2 w-10" />
                      <Skeleton className="h-2 w-10" />
                      <Skeleton className="h-2 w-10" />
                    </div>
                  </div>
                ) : trendChartData.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No Historical Trend Data"
                    description="No daily chronological records found across active divisions."
                    variant="dashed"
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis 
                        dataKey="dateLabel" 
                        stroke="#71717a" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#71717a" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        allowDecimals={false}
                      />
                      <Tooltip content={<DailyTrendTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '8px' }} />
                      {activeDeptsList.map((dept, index) => (
                        <Bar 
                          key={dept} 
                          dataKey={dept} 
                          name={dept} 
                          fill={TREND_COLORS[index % TREND_COLORS.length]} 
                          stackId="dailyTrend" 
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Live Activity Feed (Transactions) */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-700 shrink-0">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">Recent Transactions Feed</h3>
                      <p className="text-[10px] text-zinc-500 font-medium">Live view of the last 5 registered cafeteria swiped logs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onViewChange("admin-reports")}
                    className="px-3 py-1.5 border border-zinc-200 hover:border-zinc-300 text-zinc-700 font-bold text-[10px] font-mono uppercase tracking-wider rounded-xl transition-all shadow-2xs w-full sm:w-auto"
                  >
                    View All
                  </button>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-50/70 rounded-2xl border border-zinc-100">
                        <div className="flex items-center gap-3 w-2/3">
                          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                          <div className="space-y-2 w-full">
                            <Skeleton className="h-3.5 w-1/2" />
                            <Skeleton className="h-2.5 w-1/3" />
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <Skeleton className="h-3.5 w-12 ml-auto" />
                          <Skeleton className="h-2.5 w-10 ml-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !stats?.recentTransactions || stats.recentTransactions.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="Waiting for Meal Swipes"
                    description="No transactions have been processed in the recent feed yet."
                    variant="dashed"
                  />
                ) : (
                  <div className="space-y-4">
                    {stats.recentTransactions.slice(0, 5).map((tx: Transaction) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.is_free ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                            <Utensils className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-zinc-900">{tx.employee_name}</div>
                            <div className="text-[9px] text-zinc-500">{tx.department_name} • {tx.meal_time}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-black text-zinc-900">₱{Number(tx.meal_amount).toFixed(2)}</div>
                          <div className={`text-[9px] font-bold ${tx.is_free ? 'text-teal-600' : 'text-amber-600'}`}>
                            {tx.is_free ? 'Voucher' : 'Cash'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent System Activities (Audit Logs) */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-700 shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">System Events Feed</h3>
                      <p className="text-[10px] text-zinc-500 font-medium">Real-time log of security, users, and data modifications</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onViewChange("admin-audit-trail")}
                    className="px-3 py-1.5 border border-zinc-200 hover:border-zinc-300 text-zinc-700 font-bold text-[10px] font-mono uppercase tracking-wider rounded-xl transition-all shadow-2xs w-full sm:w-auto"
                  >
                    Full Trail
                  </button>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50/70 rounded-2xl border border-zinc-100">
                        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-2 w-10 animate-pulse" />
                          </div>
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-2 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !stats?.recentActivities || stats.recentActivities.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No System Events"
                    description="No recent security or audit activity logs recorded."
                    variant="dashed"
                  />
                ) : (
                  <div className="space-y-4">
                    {stats.recentActivities.map((log: ActivityLog) => {
                      const getActionIcon = (action: string) => {
                        if (action === "LOGIN") return <Users className="w-3 h-3" />;
                        if (action.includes("CREATE")) return <ClipboardList className="w-3 h-3" />;
                        if (action.includes("UPDATE")) return <Settings className="w-3 h-3" />;
                        if (action.includes("DELETE")) return <Activity className="w-3 h-3" />;
                        return <Activity className="w-3 h-3" />;
                      };

                      const getActionColor = (action: string) => {
                        if (action === "LOGIN") return "bg-blue-100 text-blue-700 border-blue-200";
                        if (action.includes("CREATE")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
                        if (action.includes("UPDATE")) return "bg-amber-100 text-amber-700 border-amber-200";
                        if (action.includes("DELETE")) return "bg-rose-100 text-rose-700 border-rose-200";
                        return "bg-zinc-100 text-zinc-700 border-zinc-200";
                      };

                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10px] font-black text-zinc-900 uppercase tracking-tight truncate">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-400 whitespace-nowrap">
                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-600 leading-tight mt-0.5 line-clamp-1">
                              {log.new_value && typeof log.new_value === 'string' ? log.new_value : (log.action === "LOGIN" ? "Personnel system access granted" : `Modified ${log.entity_type} entity`)}
                            </div>
                            <div className="text-[9px] text-zinc-400 mt-1 flex items-center gap-1">
                              <span className="font-bold text-zinc-500">{log.actor_name}</span>
                              <span>•</span>
                              <span className="capitalize">{log.actor_role || 'System'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 1-Hour Telemetry (Latency & Request Frequency) Diagnostic Chart */}
            <DiagnosticChart 
              data={benchmarks} 
              loading={benchmarksLoading} 
            />

            {/* High-Contrast API Latency & P95/P99 Percentiles KPI Display Panel */}
            <LatencyPercentilePanel 
              data={benchmarks} 
              loading={benchmarksLoading} 
              onRefresh={() => fetchBenchmarks(true)} 
            />

            {/* System Performance & API Latency Benchmarks */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">System Performance &amp; API Benchmarking</h3>
                    <p className="text-[10px] text-zinc-500 font-medium">Real-time latency profiling and REST API endpoint round-trip monitoring</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoRefreshBenchmarks}
                      onChange={(e) => setAutoRefreshBenchmarks(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 border-zinc-350 focus:ring-teal-500 accent-teal-600"
                    />
                    <span>Auto-refresh (4s)</span>
                  </label>

                  <button
                    onClick={() => fetchBenchmarks(true)}
                    disabled={benchmarksLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 hover:border-zinc-300 text-zinc-700 font-bold text-[10px] font-mono uppercase tracking-wider rounded-xl transition-all shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${benchmarksLoading ? "animate-spin text-teal-500" : ""}`} />
                    <span>Sync Metrics</span>
                  </button>
                </div>
              </div>

              {/* Benchmark Summary Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                
                <div className="border border-zinc-150 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-455 font-bold">Server Runtime Uptime</span>
                    <Cpu className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="text-lg font-black text-zinc-850 font-mono">
                    {benchmarks?.systemStats ? formatUptime(benchmarks.systemStats.uptime) : "0s"}
                  </div>
                  <div className="text-[9px] text-zinc-450 mt-1">Continuous daemon lifespan</div>
                </div>

                <div className="border border-zinc-150 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Node Memory Heap</span>
                    <Server className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="text-lg font-black text-zinc-850 font-mono">
                    {benchmarks?.systemStats ? `${benchmarks.systemStats.memoryHeapUsed} MB` : "0 MB"}
                  </div>
                  <div className="text-[9px] text-zinc-450 mt-1">
                    Heap Limit: {benchmarks?.systemStats ? `${benchmarks.systemStats.memoryHeapTotal} MB` : "0 MB"}
                  </div>
                </div>

                <div className="border border-zinc-150 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Persistence Engine</span>
                    <Database className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative flex shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-extrabold text-zinc-800 leading-tight">
                      {benchmarks?.systemStats?.databaseConnected ? "MySQL Prod Server" : "Local JSON Engine"}
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-450 mt-1.5">Reactive connection alive</div>
                </div>

                <div className="border border-zinc-150 rounded-2xl p-4 bg-zinc-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Round-Trip Swipes</span>
                    <Zap className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="text-lg font-black text-zinc-850 font-mono">
                    {benchmarks?.systemStats?.totalTrackedRequests ?? 0} reqs
                  </div>
                  <div className="text-[9px] text-zinc-450 mt-1">Performance profiling buffer size</div>
                </div>

              </div>

              {/* Endpoints & Live Terminals Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Latency aggregates by endpoint */}
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-550" />
                    REST Endpoint Performance Metrics
                  </h4>
                  
                  <div className="overflow-x-auto border border-zinc-150 rounded-2xl bg-zinc-50/20 max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-400 text-[9px] font-mono uppercase tracking-wider sticky top-0 z-10">
                          <th className="py-2.5 px-4 font-bold">API Endpoint</th>
                          <th className="py-2.5 px-4 font-bold text-center">Avg Latency</th>
                          <th className="py-2.5 px-4 font-bold text-center">Calls</th>
                          <th className="py-2.5 px-4 font-bold text-right">Errors</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white">
                        {!benchmarks?.aggregates || benchmarks.aggregates.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-zinc-400 italic">No API aggregates recorded yet</td>
                          </tr>
                        ) : (
                          benchmarks.aggregates.map((item: BenchmarkAggregate, index: number) => {
                            const parts = item.endpoint.split(" ");
                            const method = parts[0];
                            const path = parts[1] || "";
                            const isGet = method === "GET";

                            let latencyColor = "text-emerald-600";
                            let latencyBg = "bg-emerald-50";
                            if (item.avgLatency > 120) {
                              latencyColor = "text-rose-600";
                              latencyBg = "bg-rose-50";
                            } else if (item.avgLatency > 70) {
                              latencyColor = "text-amber-600";
                              latencyBg = "bg-amber-50";
                            }

                            return (
                              <tr key={index} className="hover:bg-zinc-50 transition-colors">
                                <td className="py-2 px-4 font-mono text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                      isGet ? "bg-sky-50 text-sky-700 border border-sky-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    }`}>
                                      {method}
                                    </span>
                                    <span className="text-zinc-700 truncate max-w-[150px]" title={path}>{path}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-4 text-center">
                                  <span className={`px-1.5 py-0.5 rounded-full font-bold font-mono text-[10px] ${latencyBg} ${latencyColor}`}>
                                    {item.avgLatency}ms
                                  </span>
                                </td>
                                <td className="py-2 px-4 text-center font-mono font-semibold text-zinc-650">
                                  {item.calls}
                                </td>
                                <td className="py-2 px-4 text-right font-mono">
                                  <span className={`font-bold ${item.errorRate > 0 ? "text-rose-600 animate-pulse" : "text-zinc-400"}`}>
                                    {item.errorRate}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Recharts Relative Latency Horizontal Bar Chart */}
                  {benchmarks?.aggregates && benchmarks.aggregates.length > 0 && (
                    <div className="mt-4 border border-zinc-150 rounded-2xl p-4 bg-zinc-50/10">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold mb-2 text-center">
                        Horizontal Latency Profiles (Visualized Comparison)
                      </p>
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={benchmarks.aggregates}
                            layout="vertical"
                            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                            <XAxis type="number" stroke="#d4d4d8" fontSize={9} unit="ms" />
                            <YAxis 
                              dataKey="endpoint" 
                              type="category" 
                              stroke="#a1a1aa" 
                              fontSize={8} 
                              width={110} 
                              tickFormatter={(val) => {
                                const p = val.split(" ");
                                return `${p[0]} ${p[1]?.replace("/api/", "") || ""}`;
                              }} 
                            />
                            <Tooltip formatter={(value) => [`${value} ms`, 'Avg Latency']} />
                            <Bar dataKey="avgLatency" radius={[0, 4, 4, 0]} barSize={10}>
                              {benchmarks.aggregates.map((_entry: BenchmarkAggregate, idx: number) => {
                                const colors = ["#0d9488", "#0284c7", "#4f46e5", "#7c3aed", "#b45309", "#dc2626"];
                                return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </div>

                {/* Live Console Request Logs */}
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-500 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-pulse" />
                      Live Request Stream (Latest 100 Logs)
                    </span>
                    <span className="text-[9px] text-zinc-400 font-normal normal-case">Scrolling console buffer</span>
                  </h4>
                  
                  <div className="flex-1 bg-zinc-950 rounded-2xl p-4 font-mono text-[10px] text-zinc-300 overflow-y-auto max-h-[465px] border border-zinc-900 shadow-inner space-y-2">
                    {!benchmarks?.recentLogs || benchmarks.recentLogs.length === 0 ? (
                      <div className="text-zinc-500 italic text-center py-20">Waiting for live request payloads to broadcast...</div>
                    ) : (
                      benchmarks.recentLogs.map((log: BenchmarkLog, idx: number) => {
                        let statusColor = "text-emerald-400";
                        if (log.status >= 500) {
                          statusColor = "text-rose-500";
                        } else if (log.status >= 400) {
                          statusColor = "text-amber-500";
                        }

                        let latencyColor = "text-emerald-500";
                        if (log.latency > 150) {
                          latencyColor = "text-rose-400 font-bold";
                        } else if (log.latency > 80) {
                          latencyColor = "text-amber-400";
                        }

                        const timeFormatted = log.timestamp ? log.timestamp.split("T")[1].slice(0, 8) : "";

                        return (
                          <div key={idx} className="flex justify-between items-start gap-4 border-b border-zinc-900/50 pb-1.5 last:border-0 hover:bg-zinc-900/30 px-1 py-0.5 rounded transition-colors">
                            <div className="flex items-start gap-2 truncate">
                              <span className="text-zinc-500 shrink-0 font-medium select-none">[{timeFormatted}]</span>
                              <span className={`font-bold shrink-0 ${log.method === "GET" ? "text-sky-400" : "text-emerald-400"}`}>
                                {log.method}
                              </span>
                              <span className="text-zinc-200 truncate select-all">{log.path}</span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-zinc-500 text-[9px] select-all">{log.ip}</span>
                              <span className={`font-bold ${statusColor}`}>{log.status}</span>
                              <span className={`font-semibold min-w-[36px] text-right ${latencyColor}`}>{log.latency}ms</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* System Diagnostics & Cache Layering Widget */}
            <SystemDiagnostics />
            <AuthDebugger />
            <RBACPermissionMatrix />

            {/* Quick Admin Navigation Blocks */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
            <h2 className="text-md font-extrabold tracking-tight text-zinc-900 mb-2">Central System Shortcuts</h2>
            <p className="text-xs text-zinc-500 mb-6">Manage system datasets, verify employees rosters, and compile reports.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <button
                onClick={() => onViewChange("admin-employees")}
                className="group border border-zinc-200 hover:border-teal-600 hover:bg-teal-50/10 p-5 rounded-2xl text-left transition-all outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center text-teal-800 transition-colors mb-4">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 block group-hover:text-teal-900">Manage Employee List</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Add new healthcare practitioners, modify card barcode parameters, update statuses, and view hiring rosters.
                </p>
              </button>

              <button
                onClick={() => onViewChange("admin-departments")}
                className="group border border-zinc-200 hover:border-sky-600 hover:bg-sky-50/10 p-5 rounded-2xl text-left transition-all outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-50 group-hover:bg-sky-100 flex items-center justify-center text-sky-800 transition-colors mb-4">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 block group-hover:text-sky-900">Manage Departments</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Configure primary hospital operations bureaus, department details, and manager assignments parameters.
                </p>
              </button>

              <button
                onClick={() => onViewChange("admin-reports")}
                className="group border border-zinc-200 hover:border-amber-600 hover:bg-amber-50/10 p-5 rounded-2xl text-left transition-all outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center text-amber-800 transition-colors mb-4">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 block group-hover:text-amber-900">Reports &amp; Live Auditing</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Analyze cafeteria distribution statistics, export official audit CSV sheets, and track daily financial returns.
                </p>
              </button>

              <button
                onClick={() => onViewChange("admin-settings")}
                className="group border border-zinc-200 hover:border-emerald-600 hover:bg-emerald-50/10 p-5 rounded-2xl text-left transition-all outline-none"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-emerald-800 transition-colors mb-4">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900 block group-hover:text-emerald-900">System Settings &amp; Audits</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Configure meal prices, shift eligibility timings, subsidy rates, and inspect secure auditable database logs.
                </p>
              </button>

            </div>
          </div>
        </div>
    </div>
  );
}
