import { logger } from "./logger.js";
import os from "os";

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

// Prometheus metrics accumulators
let promRequestsTotal = 0;
let promTotalLatencySum = 0;
let promDbLatencySum = 0;
let promJoinLatencySum = 0;
let promUnmatchedDepartmentsTotal = 0;

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

  // Update Prometheus Accumulators
  promRequestsTotal++;
  promTotalLatencySum += metric.totalLatencyMs;
  promDbLatencySum += metric.dbLatencyMs;
  promJoinLatencySum += metric.joinLatencyMs;
  promUnmatchedDepartmentsTotal += metric.unmatchedDepartments;

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
 * Retrieves the primary IPv4 address of the host machine
 */
function getHostIp(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return '127.0.0.1';
}

const HOST_IP = getHostIp();

/**
 * Generates Prometheus-compatible metrics text
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [];
  const label = `{host="${HOST_IP}"}`;
  
  // Basic API Metrics
  lines.push(`# HELP dgmc_api_http_requests_total Total number of HTTP requests recorded by performance tracker`);
  lines.push(`# TYPE dgmc_api_http_requests_total counter`);
  lines.push(`dgmc_api_http_requests_total${label} ${promRequestsTotal}`);

  lines.push(`# HELP dgmc_api_http_request_duration_ms_sum Total request latency in milliseconds`);
  lines.push(`# TYPE dgmc_api_http_request_duration_ms_sum counter`);
  lines.push(`dgmc_api_http_request_duration_ms_sum${label} ${promTotalLatencySum.toFixed(2)}`);

  lines.push(`# HELP dgmc_api_db_latency_ms_sum Database latency in milliseconds`);
  lines.push(`# TYPE dgmc_api_db_latency_ms_sum counter`);
  lines.push(`dgmc_api_db_latency_ms_sum${label} ${promDbLatencySum.toFixed(2)}`);

  lines.push(`# HELP dgmc_api_join_latency_ms_sum In-memory join logic latency in milliseconds`);
  lines.push(`# TYPE dgmc_api_join_latency_ms_sum counter`);
  lines.push(`dgmc_api_join_latency_ms_sum${label} ${promJoinLatencySum.toFixed(2)}`);

  lines.push(`# HELP dgmc_api_unmatched_departments_total Total number of unmatched department joins`);
  lines.push(`# TYPE dgmc_api_unmatched_departments_total counter`);
  lines.push(`dgmc_api_unmatched_departments_total${label} ${promUnmatchedDepartmentsTotal}`);
  
  // System metrics
  lines.push(`# HELP node_memory_rss_bytes Node.js Resident Set Size (RSS) memory usage`);
  lines.push(`# TYPE node_memory_rss_bytes gauge`);
  lines.push(`node_memory_rss_bytes${label} ${process.memoryUsage().rss}`);
  
  lines.push(`# HELP node_memory_heap_used_bytes Node.js heap memory used`);
  lines.push(`# TYPE node_memory_heap_used_bytes gauge`);
  lines.push(`node_memory_heap_used_bytes${label} ${process.memoryUsage().heapUsed}`);

  lines.push(`# HELP node_memory_heap_total_bytes Node.js heap memory total`);
  lines.push(`# TYPE node_memory_heap_total_bytes gauge`);
  lines.push(`node_memory_heap_total_bytes${label} ${process.memoryUsage().heapTotal}`);
  
  lines.push(`# HELP system_memory_total_bytes Total system memory`);
  lines.push(`# TYPE system_memory_total_bytes gauge`);
  lines.push(`system_memory_total_bytes${label} ${os.totalmem()}`);
  
  lines.push(`# HELP system_memory_free_bytes Free system memory`);
  lines.push(`# TYPE system_memory_free_bytes gauge`);
  lines.push(`system_memory_free_bytes${label} ${os.freemem()}`);

  const loadAvg = os.loadavg();
  lines.push(`# HELP system_cpu_load_average_1m System CPU load average over 1 minute`);
  lines.push(`# TYPE system_cpu_load_average_1m gauge`);
  lines.push(`system_cpu_load_average_1m${label} ${loadAvg[0].toFixed(2)}`);

  lines.push(`# HELP system_cpu_load_average_5m System CPU load average over 5 minutes`);
  lines.push(`# TYPE system_cpu_load_average_5m gauge`);
  lines.push(`system_cpu_load_average_5m${label} ${loadAvg[1].toFixed(2)}`);

  lines.push(`# HELP system_cpu_load_average_15m System CPU load average over 15 minutes`);
  lines.push(`# TYPE system_cpu_load_average_15m gauge`);
  lines.push(`system_cpu_load_average_15m${label} ${loadAvg[2].toFixed(2)}`);

  const cpuUsage = process.cpuUsage();
  lines.push(`# HELP node_cpu_user_microseconds Node.js user CPU time in microseconds`);
  lines.push(`# TYPE node_cpu_user_microseconds counter`);
  lines.push(`node_cpu_user_microseconds${label} ${cpuUsage.user}`);

  lines.push(`# HELP node_cpu_system_microseconds Node.js system CPU time in microseconds`);
  lines.push(`# TYPE node_cpu_system_microseconds counter`);
  lines.push(`node_cpu_system_microseconds${label} ${cpuUsage.system}`);

  lines.push(`# HELP node_uptime_seconds Node.js process uptime in seconds`);
  lines.push(`# TYPE node_uptime_seconds counter`);
  lines.push(`node_uptime_seconds${label} ${process.uptime()}`);

  try {
    // Very basic proxy for disk/DB size (helps IT know if DB is growing too fast)
    const fs = require('fs');
    if (fs.existsSync('./dgmc_meals.db')) {
      const dbStats = fs.statSync('./dgmc_meals.db');
      lines.push(`# HELP dgmc_db_file_size_bytes SQLite Database file size in bytes`);
      lines.push(`# TYPE dgmc_db_file_size_bytes gauge`);
      lines.push(`dgmc_db_file_size_bytes${label} ${dbStats.size}`);
    }
  } catch (e) {
    // Ignore if not using local SQLite or file missing
  }

  return lines.join('\n') + '\n';
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
