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
