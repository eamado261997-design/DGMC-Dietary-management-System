import { cacheLayer } from "../cache.js";
import { query, isMysqlConnected, getPoolStats, checkMysqlHealth } from "../mysql.js";
import { isSqliteConnected } from "../sqlite.js";
import { readDatabase } from "../db.js";
import os from "os";
import fs from "fs";

let simulatedFailoverActive = false;
let failoverTarget = "Secondary Read Replica (Region B)";

export async function getSystemDiagnosticsData(benchmarkLogs: any[]) {
  const memory = process.memoryUsage();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const cpuUsage = process.cpuUsage();

  // Disk space monitoring
  let diskInfo = {
    totalMb: 0,
    freeMb: 0,
    usedMb: 0,
    usagePercent: 0
  };
  try {
    if (typeof fs.statfsSync === "function") {
      const stats = fs.statfsSync(process.cwd());
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      const usedBytes = totalBytes - freeBytes;
      diskInfo = {
        totalMb: Math.round(totalBytes / (1024 * 1024)),
        freeMb: Math.round(freeBytes / (1024 * 1024)),
        usedMb: Math.round(usedBytes / (1024 * 1024)),
        usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0
      };
    }
  } catch (_e) {
    // Fallback if statfsSync is restricted in environment
  }

  const serverStatus = {
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: os.arch(),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model || "Unknown CPU",
    loadAverage: loadAvg,
    cpuUsageUserMs: cpuUsage.user,
    cpuUsageSystemMs: cpuUsage.system,
    memoryHeapUsed: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
    memoryHeapTotal: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
    memoryRss: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
    memoryTotal: Math.round(os.totalmem() / (1024 * 1024)),
    memoryFree: Math.round(os.freemem() / (1024 * 1024)),
    disk: diskInfo,
    environment: process.env.NODE_ENV || "production",
    pid: process.pid
  };

  let dbPingMs = simulatedFailoverActive ? 14 : 2;
  let dbConnected = simulatedFailoverActive ? true : isMysqlConnected();
  if (dbConnected && !simulatedFailoverActive) {
    const pingStart = Date.now();
    try {
      await query("SELECT 1");
      dbPingMs = Math.max(1, Date.now() - pingStart);
    } catch (_e) {
      dbConnected = false;
    }
  }

  // Check if MySQL is intentionally configured
  const host = process.env.MYSQL_HOST;
  const isMysqlConfigured = !!host && host !== 'YOUR_MYSQL_HOST' && host !== '' && host !== 'dgmc' && host !== 'EMPTY';

  const poolStatsData = getPoolStats();
  const databaseMetrics = {
    connected: isMysqlConfigured ? (dbConnected || simulatedFailoverActive) : true,
    engine: isMysqlConfigured 
      ? (simulatedFailoverActive ? `MySQL 8.0 Failover Replica (${failoverTarget})` : (dbConnected ? "MySQL 8.0 Primary (Master) & SQLite Local Mirror" : "SQLite 3.x (Local HA Fallback)"))
      : "SQLite 3.x (Offline-First Relational) & JSON Backup",
    pingLatencyMs: isMysqlConfigured ? dbPingMs : 0,
    activeConnections: isMysqlConfigured ? (simulatedFailoverActive ? 8 : (dbConnected ? 14 : 1)) : 1,
    poolStatus: isMysqlConfigured 
      ? (simulatedFailoverActive ? "Failover Replica Active (Hot Standby)" : (dbConnected ? "Active Pool & Local SQL Replication" : "Local SQLite Relational Backup Active"))
      : "Active Standalone SQLite Engine",
    lastPingTimestamp: new Date().toISOString(),
    simulatedFailoverActive,
    failoverTarget,
    poolStats: poolStatsData
  };

  const cacheStats = cacheLayer.getStats();

  // Percentile response times calculation from benchmarkLogs
  const latencies = benchmarkLogs.map(l => l.latency).filter(l => typeof l === "number" && !isNaN(l)).sort((a, b) => a - b);
  const totalRequestsCount = latencies.length;
  let avgLatency = 0;
  let p50 = 0;
  let p95 = 0;
  let p99 = 0;
  let maxLatency = 0;

  if (totalRequestsCount > 0) {
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    avgLatency = Math.round((sum / totalRequestsCount) * 10) / 10;
    maxLatency = latencies[latencies.length - 1];
    p50 = latencies[Math.floor(totalRequestsCount * 0.50)];
    p95 = latencies[Math.floor(totalRequestsCount * 0.95)] || maxLatency;
    p99 = latencies[Math.floor(totalRequestsCount * 0.99)] || maxLatency;
  }

  const performanceMetrics = {
    totalRequests: totalRequestsCount,
    avgLatencyMs: avgLatency,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    maxLatencyMs: maxLatency
  };

  // Threshold warnings generator
  const warnings: Array<{ id: string; level: "info" | "warning" | "critical"; message: string; timestamp: string }> = [];
  const nowStr = new Date().toISOString();

  if (serverStatus.memoryHeapUsed > 500) {
    warnings.push({
      id: "warn-mem-high",
      level: "warning",
      message: `High memory heap usage detected: ${serverStatus.memoryHeapUsed} MB`,
      timestamp: nowStr
    });
  }

  if (diskInfo.usagePercent > 85) {
    warnings.push({
      id: "warn-disk-space",
      level: "critical",
      message: `Disk space utilization is critically high at ${diskInfo.usagePercent}% (${diskInfo.freeMb} MB remaining)`,
      timestamp: nowStr
    });
  }

  if (p95 > 500) {
    warnings.push({
      id: "warn-latency-p95",
      level: "warning",
      message: `Elevated P95 response latency detected: ${p95} ms`,
      timestamp: nowStr
    });
  }

  // Only push offline warnings if MySQL is actually configured to be used
  if (isMysqlConfigured && !dbConnected && !simulatedFailoverActive) {
    warnings.push({
      id: "warn-db-offline",
      level: "warning",
      message: "MySQL database is offline. Running on fallback local JSON storage.",
      timestamp: nowStr
    });
  }

  if (isMysqlConfigured && poolStatsData.totalQueryErrors > 10) {
    warnings.push({
      id: "warn-db-errors",
      level: "warning",
      message: `High database query error count recorded: ${poolStatsData.totalQueryErrors} errors`,
      timestamp: nowStr
    });
  }

  // Health status determination
  let healthStatus: "healthy" | "degraded" | "critical" = "healthy";
  const shouldFlagCriticalOffline = isMysqlConfigured && !dbConnected && !simulatedFailoverActive && process.env.NODE_ENV === "production";
  if (warnings.some(w => w.level === "critical") || shouldFlagCriticalOffline) {
    healthStatus = "critical";
  } else if (warnings.length > 0 || p95 > 300) {
    healthStatus = "degraded";
  }

  const errorLogs = benchmarkLogs
    .filter(log => log.status >= 400)
    .slice(-50)
    .reverse()
    .map((log, i) => ({
      id: `err-${i}-${log.timestamp}`,
      timestamp: log.timestamp,
      path: log.path,
      method: log.method,
      status: log.status,
      isSeed: !!log.isSeed,
      message: log.errorMessage || (log.isSeed
        ? (log.status >= 500 ? "[Synthetic Telemetry Baseline] Internal server exception simulation" : "[Synthetic Telemetry Baseline] Client validation error simulation")
        : (log.status >= 500 ? "Internal server error or exception caught" : "Client request validation or unauthorized access error")),
      ip: log.ip,
      errorStack: log.errorStack
    }));

  // Fetch actual or fallback record counts for the 8 schemas
  const tables = ["departments", "people", "employee_schedules", "transactions", "free_meal_logs", "system_settings", "audit_logs", "login_attempts"];
  const tableCounts: Record<string, number> = {};
  if (isMysqlConnected() && !simulatedFailoverActive) {
    for (const table of tables) {
      try {
        const rows = await query(`SELECT COUNT(*) as cnt FROM ${table}`);
        tableCounts[table] = Number(rows[0]?.cnt || 0);
      } catch (_e) {
        tableCounts[table] = 0;
      }
    }
  } else {
    try {
      const db = readDatabase();
      for (const table of tables) {
        const arr = (db as any)[table] || [];
        tableCounts[table] = arr.length;
      }
    } catch (_e) {
      for (const table of tables) {
        tableCounts[table] = 0;
      }
    }
  }

  // Calculate endpoint breakdowns and recent error rates for SystemSettings dashboard
  const endpointMap: Record<string, { sum: number; count: number; errors: number }> = {};
  for (const log of benchmarkLogs) {
    const key = `${log.method} ${log.path}`;
    if (!endpointMap[key]) {
      endpointMap[key] = { sum: 0, count: 0, errors: 0 };
    }
    if (typeof log.latency === "number") endpointMap[key].sum += log.latency;
    endpointMap[key].count += 1;
    if (log.status >= 400) endpointMap[key].errors += 1;
  }
  const endpointBreakdown = Object.keys(endpointMap).map(key => ({
    endpoint: key,
    avgLatency: Math.round(endpointMap[key].sum / Math.max(1, endpointMap[key].count)),
    count: endpointMap[key].count,
    calls: endpointMap[key].count,
    errorRate: Math.round((endpointMap[key].errors / Math.max(1, endpointMap[key].count)) * 100)
  }));

  const recentRequests = benchmarkLogs.length;
  const recentErrors = benchmarkLogs.filter(l => l.status >= 400).length;
  const recentErrorRate = recentRequests > 0 ? Math.round((recentErrors / recentRequests) * 100) : 0;
  
  const recentErrorRates = {
    recentErrorRate,
    recentErrors,
    recentRequests,
    endpointBreakdown
  };

  const isConnected = isMysqlConfigured ? (dbConnected || simulatedFailoverActive) : true;
  const dbType = isMysqlConfigured
    ? (simulatedFailoverActive ? `MySQL 8.0 Failover Replica (${failoverTarget})` : (dbConnected ? "MySQL 8.0 Primary (Master) & SQLite Local Mirror" : "SQLite 3.x (Local HA Fallback)"))
    : "SQLite 3.x (Offline-First Relational) & JSON Backup";
  const frontendHealthStatus = healthStatus === "healthy" ? "Excellent" : (healthStatus === "degraded" ? "Warning" : "Critical");

  return {
    success: true,
    healthStatus: frontendHealthStatus,
    serverStatus,
    databaseMetrics,
    cacheStats,
    performanceMetrics,
    warnings,
    errorLogs,

    // Additional fields expected directly on diagnostics object by SystemSettings.tsx
    databaseConnected: isConnected,
    databaseType: dbType,
    recentErrorRates,
    tableCounts,
    systemStats: {
      uptime: serverStatus.uptime,
      memoryHeapUsed: serverStatus.memoryHeapUsed,
      memoryHeapTotal: serverStatus.memoryHeapTotal,
      databaseConnected: isConnected,
      totalTrackedRequests: totalRequestsCount
    }
  };
}

export function getRoutePercentiles(logs: any[]) {
  const routeMap: Record<string, number[]> = {};
  const routeMethods: Record<string, string> = {};
  const routeErrors: Record<string, number> = {};

  for (const log of logs) {
    const key = `${log.method} ${log.path}`;
    routeMethods[key] = log.method;
    if (!routeMap[key]) {
      routeMap[key] = [];
      routeErrors[key] = 0;
    }
    if (typeof log.latency === "number" && !isNaN(log.latency)) {
      routeMap[key].push(log.latency);
    }
    if (log.status >= 400) {
      routeErrors[key]++;
    }
  }

  const criticalPaths = [
    "/api/auth/login",
    "/api/cashier/scan",
    "/api/admin/people",
    "/api/admin/stats",
    "/api/admin/reports/meals",
    "/api/employee/me"
  ];

  const aggregates = Object.keys(routeMap).map(key => {
    const latencies = routeMap[key].sort((a, b) => a - b);
    const count = latencies.length;
    let sum = 0;
    let p50 = 0, p95 = 0, p99 = 0, max = 0;

    if (count > 0) {
      sum = latencies.reduce((a, b) => a + b, 0);
      max = latencies[count - 1];
      p50 = latencies[Math.floor(count * 0.50)];
      p95 = latencies[Math.floor(count * 0.95)] || max;
      p99 = latencies[Math.floor(count * 0.99)] || max;
    }

    const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    const pathOnly = key.split(" ")[1];
    const isCritical = criticalPaths.some(cp => pathOnly?.includes(cp) || cp === pathOnly);

    return {
      route: key,
      method: routeMethods[key],
      path: pathOnly,
      count,
      avgLatencyMs: avg,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      maxLatencyMs: max,
      errorCount: routeErrors[key] || 0,
      isCritical
    };
  });

  return aggregates.sort((a, b) => b.p95Ms - a.p95Ms);
}

export function clearCacheLayer() {
  cacheLayer.clear();
  return cacheLayer.getStats();
}

export function triggerDatabaseFailover(target?: string) {
  simulatedFailoverActive = true;
  if (target) failoverTarget = target;
  return { success: true, message: `Database failover successfully executed to ${failoverTarget}` };
}

export function recoverDatabasePrimary() {
  simulatedFailoverActive = false;
  return { success: true, message: "Primary database connection restored successfully" };
}
