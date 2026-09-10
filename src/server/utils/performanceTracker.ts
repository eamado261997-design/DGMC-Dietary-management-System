import { logger } from "./logger.js";

export interface EmployeePerfMetric {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  dbType: "mysql" | "sqlite" | "json";
  totalLatencyMs: number;
  dbLatencyMs: number;
  joinLatencyMs: number;
  recordsProcessed: number;
  matchedDepartments: number;
  unmatchedDepartments: number;
  warnings: string[];
}

const MAX_PERF_LOGS = 200;
export const employeePerfLogs: EmployeePerfMetric[] = [];

/**
 * High precision millisecond timer wrapper
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => {
    const elapsed = performance.now() - start;
    return Math.round(elapsed * 100) / 100; // 2 decimal places
  };
}

/**
 * Record and log an employee lookup performance metric
 */
export function recordEmployeePerfMetric(metric: Omit<EmployeePerfMetric, "id" | "timestamp">): EmployeePerfMetric {
  const fullMetric: EmployeePerfMetric = {
    id: `perf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...metric
  };

  employeePerfLogs.unshift(fullMetric);
  if (employeePerfLogs.length > MAX_PERF_LOGS) {
    employeePerfLogs.pop();
  }

  // Determine primary contributor / bottleneck
  const bottleneck = fullMetric.dbLatencyMs > fullMetric.joinLatencyMs ? "DATABASE QUERY" : "JOIN LOGIC";
  const dbRatio = Math.round((fullMetric.dbLatencyMs / Math.max(0.01, fullMetric.totalLatencyMs)) * 100);
  const joinRatio = Math.round((fullMetric.joinLatencyMs / Math.max(0.01, fullMetric.totalLatencyMs)) * 100);

  const logMessage = `[PERF TRACE] ${metric.method} ${metric.endpoint} (${metric.dbType}) | Total: ${metric.totalLatencyMs}ms [DB: ${metric.dbLatencyMs}ms (${dbRatio}%), Join: ${metric.joinLatencyMs}ms (${joinRatio}%)] | Records: ${metric.recordsProcessed} (Matched Depts: ${metric.matchedDepartments}/${metric.recordsProcessed}, Unmatched: ${metric.unmatchedDepartments})`;

  if (metric.warnings.length > 0) {
    logger.warn(`${logMessage} | Warnings: ${metric.warnings.join("; ")}`);
  } else {
    logger.info(logMessage);
  }

  return fullMetric;
}

/**
 * Formats standard HTTP Server-Timing & diagnostic headers for response
 */
export function getPerfHeaders(metric: EmployeePerfMetric): Record<string, string> {
  const serverTiming = [
    `db;dur=${metric.dbLatencyMs};desc="DB Query"`,
    `join;dur=${metric.joinLatencyMs};desc="Dept Join Logic"`,
    `total;dur=${metric.totalLatencyMs};desc="Total Lookup"`
  ].join(", ");

  return {
    "Server-Timing": serverTiming,
    "X-Lookup-DB-Latency-Ms": metric.dbLatencyMs.toString(),
    "X-Lookup-Join-Latency-Ms": metric.joinLatencyMs.toString(),
    "X-Lookup-Total-Ms": metric.totalLatencyMs.toString(),
    "X-Department-Join-Status": `Matched ${metric.matchedDepartments}/${metric.recordsProcessed} (${metric.unmatchedDepartments} fallback)`
  };
}

/**
 * Compute aggregate summary statistics for employee lookups
 */
export function getEmployeePerfSummary() {
  if (employeePerfLogs.length === 0) {
    return {
      totalLookupsTracked: 0,
      avgTotalLatencyMs: 0,
      avgDbLatencyMs: 0,
      avgJoinLatencyMs: 0,
      maxTotalLatencyMs: 0,
      maxDbLatencyMs: 0,
      maxJoinLatencyMs: 0,
      avgDbPercentage: 0,
      avgJoinPercentage: 0,
      totalUnmatchedJoins: 0,
      diagnosis: "No employee lookup queries recorded yet in this session."
    };
  }

  const count = employeePerfLogs.length;
  const sumTotal = employeePerfLogs.reduce((acc, l) => acc + l.totalLatencyMs, 0);
  const sumDb = employeePerfLogs.reduce((acc, l) => acc + l.dbLatencyMs, 0);
  const sumJoin = employeePerfLogs.reduce((acc, l) => acc + l.joinLatencyMs, 0);
  const unmatched = employeePerfLogs.reduce((acc, l) => acc + l.unmatchedDepartments, 0);

  const avgTotal = Math.round((sumTotal / count) * 100) / 100;
  const avgDb = Math.round((sumDb / count) * 100) / 100;
  const avgJoin = Math.round((sumJoin / count) * 100) / 100;

  const maxTotal = Math.max(...employeePerfLogs.map(l => l.totalLatencyMs));
  const maxDb = Math.max(...employeePerfLogs.map(l => l.dbLatencyMs));
  const maxJoin = Math.max(...employeePerfLogs.map(l => l.joinLatencyMs));

  const avgDbPercentage = Math.round((avgDb / Math.max(0.01, avgTotal)) * 100);
  const avgJoinPercentage = Math.round((avgJoin / Math.max(0.01, avgTotal)) * 100);

  let diagnosis = "Optimal: Both database query latency and in-memory department join computation are sub-millisecond.";
  if (unmatched > 0) {
    diagnosis = `⚠️ Integrity Warning: ${unmatched} employee records have department_id values that do not match any active department in the database.`;
  } else if (avgDb > 100) {
    diagnosis = "⚠️ High Database Latency: Database queries are taking over 100ms on average.";
  } else if (avgJoin > 50) {
    diagnosis = "⚠️ Join Bottleneck: In-memory department mapping or decryption is taking over 50ms.";
  }

  return {
    totalLookupsTracked: count,
    avgTotalLatencyMs: avgTotal,
    avgDbLatencyMs: avgDb,
    avgJoinLatencyMs: avgJoin,
    maxTotalLatencyMs: maxTotal,
    maxDbLatencyMs: maxDb,
    maxJoinLatencyMs: maxJoin,
    avgDbPercentage,
    avgJoinPercentage,
    totalUnmatchedJoins: unmatched,
    diagnosis,
    recentTraces: employeePerfLogs.slice(0, 30)
  };
}
