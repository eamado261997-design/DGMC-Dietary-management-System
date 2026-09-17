export interface Transaction {
  id: number | string;
  person_id: number;
  employee_name?: string;
  department_name?: string;
  meal_time?: string;
  meal_date?: string;
  meal_amount: number;
  is_free: boolean;
  status: string;
  created_at?: string;
}

export interface ActivityLog {
  id: number | string;
  action: string;
  created_at: string;
  actor_name?: string;
  actor_role?: string;
  new_value?: string | Record<string, unknown> | null;
  entity_type?: string;
}

export interface AdminStats {
  totalPeople: number;
  totalDepartments: number;
  freeMealsToday: number;
  cashMealsTodayCount: number;
  paidAmountToday: number;
  activeEmployees: number;
  totalEmployees: number;
  pendingMealRequests: number;
  recentTransactions: Transaction[];
  recentActivities: ActivityLog[];
}

export interface BenchmarkAggregate {
  endpoint: string;
  avgLatency: number;
  calls: number;
  errorRate: number;
}

export interface BenchmarkLog {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  status: number;
  latency: number;
}

export interface RouteAggregateItem {
  route: string;
  method: string;
  path: string;
  count: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxLatencyMs: number;
  errorCount: number;
  isCritical: boolean;
}

export interface SystemPerfData {
  totalRequests?: number;
  avgLatencyMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  p99Ms?: number;
  maxLatencyMs?: number;
  errorCount?: number;
  routeAggregates?: RouteAggregateItem[];
  systemStats?: {
    uptime: number;
    memoryHeapUsed: number;
    memoryHeapTotal: number;
    databaseConnected: boolean;
    totalTrackedRequests: number;
  };
  aggregates?: BenchmarkAggregate[];
  recentLogs?: BenchmarkLog[];
  hourlyChartData?: Array<{
    timeLabel: string;
    avgLatency: number;
    maxLatency: number;
    avgDbLatency?: number;
    requests: number;
  }>;
}

export interface HourlyDataPoint {
  hour: number;
  label: string;
  scans: number;
  departments: Record<string, number>;
}

export interface DepartmentChartItem {
  department: string;
  free: number;
  paid: number;
  total: number;
}

export interface TrendDataPoint {
  rawDate: string;
  dateLabel: string;
  [deptName: string]: string | number;
}

export interface SessionDataItem {
  session: string;
  "Meal Check-ins": number;
}

export const TREND_COLORS = [
  "#0f766e", // teal-700
  "#0284c7", // sky-600
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#71717a", // zinc-500
];

export function formatUptime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export function getMealSession(timeStr?: string): string {
  if (!timeStr) return "Lunch Session";
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (isNaN(hour)) return "Lunch Session";
  
  if (hour >= 6 && hour < 10) return "Breakfast Session";
  if (hour >= 11 && hour < 15) return "Lunch Session";
  if (hour >= 17 && hour < 21) return "Dinner Session";
  return "Late Night / Night Roster";
}

export function processHourlyData(transactions: Transaction[]): HourlyDataPoint[] {
  const data: HourlyDataPoint[] = Array.from({ length: 24 }, (_, hour) => {
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${displayHour} ${ampm}`;
    return {
      hour,
      label,
      scans: 0,
      departments: {}
    };
  });

  transactions.forEach((t) => {
    if (!t.meal_time || t.status !== "completed") return;
    const parts = t.meal_time.split(":");
    const h = parseInt(parts[0], 10);
    if (!isNaN(h) && h >= 0 && h < 24) {
      data[h].scans += 1;
      const dept = t.department_name && t.department_name !== "N/A" ? t.department_name : "Unassigned";
      data[h].departments[dept] = (data[h].departments[dept] || 0) + 1;
    }
  });

  return data;
}

export function processDepartmentChartData(transactions: Transaction[]): DepartmentChartItem[] {
  const deptMap: Record<string, { free: number; paid: number; total: number }> = {};

  transactions.forEach((t) => {
    if (t.status !== "completed") return;
    const deptName = t.department_name && t.department_name !== "N/A" ? t.department_name : "Unassigned";
    if (!deptMap[deptName]) {
      deptMap[deptName] = { free: 0, paid: 0, total: 0 };
    }
    if (t.is_free) {
      deptMap[deptName].free += 1;
    } else {
      deptMap[deptName].paid += 1;
    }
    deptMap[deptName].total += 1;
  });

  return Object.keys(deptMap)
    .map((name) => ({
      department: name,
      free: deptMap[name].free,
      paid: deptMap[name].paid,
      total: deptMap[name].total
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

export function processDailyTrendData(transactions: Transaction[]): { trendChartData: TrendDataPoint[]; activeDeptsList: string[] } {
  const dailyDeptTrendMap: Record<string, Record<string, number>> = {};
  const deptsSet = new Set<string>();

  transactions.forEach((t) => {
    if (t.status !== "completed") return;
    const dateStr = t.meal_date || "Unknown Date";
    const dept = t.department_name && t.department_name !== "N/A" ? t.department_name : "Unassigned";
    deptsSet.add(dept);
    if (!dailyDeptTrendMap[dateStr]) {
      dailyDeptTrendMap[dateStr] = {};
    }
    dailyDeptTrendMap[dateStr][dept] = (dailyDeptTrendMap[dateStr][dept] || 0) + 1;
  });

  const sortedDates = Object.keys(dailyDeptTrendMap).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const recentDates = sortedDates.slice(-7);
  const activeDepts = Array.from(deptsSet);

  const chartData = recentDates.map((dateStr) => {
    let formattedLabel = dateStr;
    try {
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) {
        formattedLabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    } catch (_e) {}

    const dataPoint: TrendDataPoint = {
      rawDate: dateStr,
      dateLabel: formattedLabel,
    };

    activeDepts.forEach((dept) => {
      dataPoint[dept] = dailyDeptTrendMap[dateStr][dept] || 0;
    });

    return dataPoint;
  });

  return { trendChartData: chartData, activeDeptsList: activeDepts };
}

export function processSessionChartData(transactions: Transaction[]): SessionDataItem[] {
  const sessionCounts: Record<string, number> = {
    "Breakfast Session": 0,
    "Lunch Session": 0,
    "Dinner Session": 0,
    "Late Night / Night Roster": 0,
  };

  transactions.forEach((t) => {
    if (t.status !== "completed") return;
    const session = getMealSession(t.meal_time);
    sessionCounts[session] = (sessionCounts[session] || 0) + 1;
  });

  return Object.entries(sessionCounts).map(([session, checkins]) => ({
    session: session.replace(" Session", ""),
    "Meal Check-ins": checkins,
  }));
}

export interface HourlyVolumePricingPoint {
  time: string;
  volume: number;
  avgPrice: number;
}

export function getTransactionHour(t: Transaction): number {
  if (t.meal_time) {
    const clean = t.meal_time.trim().toLowerCase();
    const isPm = clean.includes("pm");
    const isAm = clean.includes("am");
    const parts = clean.replace(/[^\d:]/g, "").split(":");
    let h = parseInt(parts[0] || "0", 10);
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    if (!isNaN(h) && h >= 0 && h <= 23) return h;
  }
  if (t.created_at) {
    const d = new Date(t.created_at);
    if (!isNaN(d.getTime())) return d.getHours();
  }
  return -1;
}

export function parseTransactionDate(t: Transaction): Date | null {
  if (t.created_at) {
    const d = new Date(t.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  if (t.meal_date) {
    const h = getTransactionHour(t);
    const hourStr = h >= 0 ? String(h).padStart(2, "0") : "00";
    let minStr = "00";
    if (t.meal_time) {
      const parts = t.meal_time.replace(/[^\d:]/g, "").split(":");
      if (parts[1]) minStr = parts[1].padStart(2, "0");
    }
    const d = new Date(`${t.meal_date}T${hourStr}:${minStr}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Computes live hourly transaction volume and average meal pricing for the last 24 hours
 * dynamically from actual transaction logs.
 */
export function processHourlyVolumeAndPricing(
  transactions: Transaction[],
  targetDate?: string,
  options?: { rolling24Hours?: boolean; useAllTransactions?: boolean }
): HourlyVolumePricingPoint[] {
  const now = new Date();
  const currentHour = now.getHours();

  // Mode 1: Rolling 24 Hours Window (last 24 elapsed hours ending at currentHour)
  if (options?.rolling24Hours) {
    const points: HourlyVolumePricingPoint[] = [];
    const oneHourMs = 3600 * 1000;
    const nowMs = now.getTime();
    const twentyFourHoursAgoMs = nowMs - 24 * oneHourMs;

    // Build 24 sequential hourly slots chronologically from 23 hours ago to current hour
    const slotData = Array.from({ length: 24 }, (_, i) => {
      const hoursAgo = 23 - i;
      const slotDate = new Date(nowMs - hoursAgo * oneHourMs);
      const hour = slotDate.getHours();
      return {
        label: `${String(hour).padStart(2, "0")}:00`,
        hoursAgo,
        volume: 0,
        paidSum: 0,
        paidCount: 0,
      };
    });

    const completed = transactions.filter(t => !t.status || t.status === "completed");
    completed.forEach((t) => {
      const tDate = parseTransactionDate(t);
      if (!tDate) return;
      const tMs = tDate.getTime();
      // Must fall within the last 24 hours (with 1-minute grace period for clock variance)
      if (tMs >= twentyFourHoursAgoMs && tMs <= nowMs + 60000) {
        const hoursAgo = Math.floor((nowMs - tMs) / oneHourMs);
        if (hoursAgo >= 0 && hoursAgo < 24) {
          const slotIndex = 23 - hoursAgo;
          if (slotData[slotIndex]) {
            slotData[slotIndex].volume += 1;
            const amount = Number(t.meal_amount) || 0;
            if (!t.is_free && amount > 0) {
              slotData[slotIndex].paidSum += amount;
              slotData[slotIndex].paidCount += 1;
            }
          }
        }
      }
    });

    return slotData.map(s => ({
      time: s.label,
      volume: s.volume,
      avgPrice: s.paidCount > 0 ? Math.round((s.paidSum / s.paidCount) * 100) / 100 : 0,
    }));
  }

  // Mode 2: Fixed 24-hour day schedule (00:00 - 23:00)
  const hourSlots = Array.from({ length: 24 }, (_, i) => i);
  const todayStr = targetDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  let dayTxs: Transaction[];
  if (options?.useAllTransactions) {
    dayTxs = transactions.filter(t => !t.status || t.status === "completed");
  } else {
    dayTxs = transactions.filter((t) => {
      if (t.status && t.status !== "completed") return false;
      const date = t.meal_date || (t.created_at ? t.created_at.substring(0, 10) : "");
      return date === todayStr;
    });

    // Only fallback if no explicit targetDate was requested and it's default initial exploration
    if (!targetDate && dayTxs.length === 0 && transactions.length > 0) {
      const dates = transactions
        .filter(t => t.status === "completed")
        .map(t => t.meal_date || (t.created_at ? t.created_at.substring(0, 10) : ""))
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        const latestDate = dates[dates.length - 1];
        dayTxs = transactions.filter((t) => {
          if (t.status && t.status !== "completed") return false;
          const date = t.meal_date || (t.created_at ? t.created_at.substring(0, 10) : "");
          return date === latestDate;
        });
      }
    }
  }

  // Initialize hourly buckets for 00:00 to 23:00
  const buckets: Record<number, { volume: number; paidSum: number; paidCount: number }> = {};
  for (let h = 0; h < 24; h++) {
    buckets[h] = { volume: 0, paidSum: 0, paidCount: 0 };
  }

  dayTxs.forEach((t) => {
    const hour = getTransactionHour(t);
    if (hour >= 0 && hour <= 23 && buckets[hour]) {
      buckets[hour].volume += 1;
      const amount = Number(t.meal_amount) || 0;
      if (!t.is_free && amount > 0) {
        buckets[hour].paidSum += amount;
        buckets[hour].paidCount += 1;
      }
    }
  });

  return hourSlots.map((h) => {
    const timeLabel = `${String(h).padStart(2, "0")}:00`;
    const b = buckets[h] || { volume: 0, paidSum: 0, paidCount: 0 };
    const avgPrice = b.paidCount > 0 ? Math.round((b.paidSum / b.paidCount) * 100) / 100 : 0;
    return {
      time: timeLabel,
      volume: b.volume,
      avgPrice,
    };
  });
}
