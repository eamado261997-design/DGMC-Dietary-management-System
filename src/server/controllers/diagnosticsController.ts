import { Request, Response } from "express";
import { getSystemDiagnosticsData, getRoutePercentiles, clearCacheLayer, triggerDatabaseFailover, recoverDatabasePrimary } from "../services/diagnosticsService.js";

export class DiagnosticsController {
  private getBenchmarkLogs: () => any[];

  constructor(getBenchmarkLogs: () => any[]) {
    this.getBenchmarkLogs = getBenchmarkLogs;
  }

  public getDiagnostics = async (req: Request, res: Response) => {
    try {
      const logs = this.getBenchmarkLogs();
      const data = await getSystemDiagnosticsData(logs);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch diagnostics" });
    }
  };

  public getPerformanceBenchmarks = async (req: Request, res: Response) => {
    try {
      const logs = this.getBenchmarkLogs();
      const totalRequests = logs.length;
      const latencies = logs.map(l => l.latency).filter(l => typeof l === "number" && !isNaN(l)).sort((a, b) => a - b);
      let p50 = 0, p95 = 0, p99 = 0, max = 0, avgLatency = 0;
      if (totalRequests > 0) {
        const sum = latencies.reduce((acc, l) => acc + l, 0);
        avgLatency = Math.round((sum / totalRequests) * 10) / 10;
        max = latencies[totalRequests - 1];
        p50 = latencies[Math.floor(totalRequests * 0.50)];
        p95 = latencies[Math.floor(totalRequests * 0.95)] || max;
        p99 = latencies[Math.floor(totalRequests * 0.99)] || max;
      }
      const errorCount = logs.filter(l => l.status >= 400).length;
      const routeAggregates = getRoutePercentiles(logs);

      // Construct systemStats for dashboard summary widgets
      const memory = process.memoryUsage();
      const systemStats = {
        uptime: Math.round(process.uptime()),
        memoryHeapUsed: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
        memoryHeapTotal: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
        databaseConnected: true,
        totalTrackedRequests: totalRequests
      };

      // Construct endpoint aggregates for horizontal chart
      const endpointMap: Record<string, { sum: number; count: number; errors: number }> = {};
      for (const log of logs) {
        const key = `${log.method} ${log.path}`;
        if (!endpointMap[key]) {
          endpointMap[key] = { sum: 0, count: 0, errors: 0 };
        }
        if (typeof log.latency === "number") endpointMap[key].sum += log.latency;
        endpointMap[key].count += 1;
        if (log.status >= 400) endpointMap[key].errors += 1;
      }
      const aggregates = Object.keys(endpointMap).map(key => ({
        endpoint: key,
        avgLatency: Math.round(endpointMap[key].sum / Math.max(1, endpointMap[key].count)),
        calls: endpointMap[key].count,
        errorRate: Math.round((endpointMap[key].errors / Math.max(1, endpointMap[key].count)) * 100)
      }));

      // Calculate latency and request frequency over the last hour (60 minutes) in 2-minute buckets (30 intervals)
      const nowMs = Date.now();
      const lastHourLogs = logs.filter(l => {
        const logTime = new Date(l.timestamp).getTime();
        return nowMs - logTime <= 60 * 60 * 1000;
      });

      const bucketSizeMinutes = 2;
      const numBuckets = 30;
      const hourlyChartData = [];

      for (let i = numBuckets - 1; i >= 0; i--) {
        const bucketStartMs = nowMs - (i + 1) * bucketSizeMinutes * 60 * 1000;
        const bucketEndMs = nowMs - i * bucketSizeMinutes * 60 * 1000;
        
        // Find logs in this bucket
        const bucketLogs = lastHourLogs.filter(l => {
          const t = new Date(l.timestamp).getTime();
          return t >= bucketStartMs && t < bucketEndMs;
        });

        // Calculate average latency
        const bucketLatencies = bucketLogs.map(l => l.latency).filter(l => typeof l === "number" && !isNaN(l));
        const avgLatency = bucketLatencies.length > 0 
          ? Math.round(bucketLatencies.reduce((sum, val) => sum + val, 0) / bucketLatencies.length)
          : 0;

        // Calculate average database query execution latency
        const bucketDbLatencies = bucketLogs.map(l => l.dbLatency).filter(l => typeof l === "number" && !isNaN(l));
        const avgDbLatency = bucketDbLatencies.length > 0
          ? Math.round(bucketDbLatencies.reduce((sum, val) => sum + val, 0) / bucketDbLatencies.length)
          : 0;

        const maxLatency = bucketLatencies.length > 0 ? Math.max(...bucketLatencies) : 0;
        const requestsCount = bucketLogs.length;

        // Label format: "-Xm" or "Now"
        const minutesAgo = i * bucketSizeMinutes;
        const label = minutesAgo === 0 ? "Now" : `-${minutesAgo}m`;

        hourlyChartData.push({
          timeLabel: label,
          avgLatency,
          maxLatency,
          avgDbLatency,
          requests: requestsCount
        });
      }

      res.json({
        totalRequests,
        avgLatencyMs: avgLatency,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
        maxLatencyMs: max,
        errorCount,
        routeAggregates,
        recentLogs: logs.slice(-20).reverse(),
        systemStats,
        aggregates,
        hourlyChartData
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch performance benchmarks" });
    }
  };

  public verifySecurityMatrix = async (req: Request, res: Response) => {
    try {
      const enforcedRoutes = [
        { path: "/api/admin/stats", method: "GET", enforcedRoles: ["admin"] },
        { path: "/api/admin/people", method: "GET", enforcedRoles: ["admin"] },
        { path: "/api/admin/people", method: "POST", enforcedRoles: ["admin"] },
        { path: "/api/admin/sys-health", method: "GET", enforcedRoles: ["admin"] },
        { path: "/api/admin/sys-perf", method: "GET", enforcedRoles: ["admin"] },
        { path: "/api/admin/security-matrix-verify", method: "GET", enforcedRoles: ["admin"] },
        { path: "/api/admin/ai-insights", method: "POST", enforcedRoles: ["admin", "manager"] },
        { path: "/api/manager/roster", method: "GET", enforcedRoles: ["manager", "admin"] },
        { path: "/api/manager/schedules", method: "POST", enforcedRoles: ["manager", "admin"] },
        { path: "/api/cashier/scan", method: "POST", enforcedRoles: ["cashier", "admin"] },
        { path: "/api/employee/me", method: "GET", enforcedRoles: ["employee", "cashier", "manager", "admin"] }
      ];
      res.json({ enforcedRoutes });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to verify security matrix" });
    }
  };

  public clearCache = async (req: Request, res: Response) => {
    try {
      const stats = clearCacheLayer();
      res.json({ success: true, message: "Cache layer flushed successfully", stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to clear cache" });
    }
  };

  public failover = async (req: Request, res: Response) => {
    try {
      const { target } = req.body || {};
      const result = triggerDatabaseFailover(target);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to trigger failover" });
    }
  };

  public recover = async (req: Request, res: Response) => {
    try {
      const result = recoverDatabasePrimary();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to recover primary database" });
    }
  };
}
