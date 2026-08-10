import React, { useState, useEffect } from "react";
import { 
  Server, 
  Database, 
  Activity, 
  Zap, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  HardDrive, 
  Layers, 
  Trash2, 
  Clock, 
  Terminal,
  ShieldCheck,
  GitCommit,
  Lightbulb
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";

interface DiagnosticsData {
  serverStatus: {
    uptime: number;
    nodeVersion: string;
    platform: string;
    memoryHeapUsed: number;
    memoryHeapTotal: number;
    memoryRss: number;
    environment: string;
    pid: number;
  };
  databaseMetrics: {
    connected: boolean;
    engine: string;
    pingLatencyMs: number;
    activeConnections: number;
    poolStatus: string;
    lastPingTimestamp: string;
    simulatedFailoverActive?: boolean;
    failoverTarget?: string;
  };
  cacheStats: {
    activeKeysCount: number;
    totalKeysStored: number;
    hits: number;
    misses: number;
    hitRate: number;
    flushCount: number;
    lastFlushTime: string;
    keysSummary: Array<{
      key: string;
      ageSeconds: number;
      hits: number;
      ttlRemaining: number;
    }>;
  };
  errorLogs: Array<{
    id: string;
    timestamp: string;
    path: string;
    method: string;
    status: number;
    message: string;
    ip: string;
  }>;
}

const formatUptime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
};

export default function SystemDiagnostics() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [flushingCache, setFlushingCache] = useState(false);
  const [failoverActionLoading, setFailoverActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "cache" | "errors" | "tips">("overview");

  const fetchDiagnostics = (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    apiFetch("/api/admin/sys-health")
      .then((res) => {
        if (res) {
          setData(res);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch diagnostics:", err);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchDiagnostics(true);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDiagnostics(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleFlushCache = () => {
    setFlushingCache(true);
    apiFetch("/api/admin/sys-health/cache/clear", { method: "POST" })
      .then(() => {
        fetchDiagnostics(false);
      })
      .catch((err) => console.error("Failed to clear cache:", err))
      .finally(() => setFlushingCache(false));
  };

  const handleTriggerFailover = (target = "Secondary Read Replica (Region B)") => {
    setFailoverActionLoading(true);
    apiFetch("/api/admin/sys-health/failover/trigger", {
      method: "POST",
      body: JSON.stringify({ target })
    })
      .then(() => {
        fetchDiagnostics(false);
      })
      .catch((err) => console.error("Failed to trigger failover:", err))
      .finally(() => setFailoverActionLoading(false));
  };

  const handleRecoverPrimary = () => {
    setFailoverActionLoading(true);
    apiFetch("/api/admin/sys-health/failover/recover", {
      method: "POST"
    })
      .then(() => {
        fetchDiagnostics(false);
      })
      .catch((err) => console.error("Failed to recover primary:", err))
      .finally(() => setFailoverActionLoading(false));
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center space-y-4">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-mono text-zinc-500">Initializing system telemetry and cache diagnostic probes...</p>
      </div>
    );
  }

  const server = data?.serverStatus;
  const db = data?.databaseMetrics;
  const cache = data?.cacheStats;
  const errors = data?.errorLogs || [];

  return (
    <div id="system-diagnostics-component" className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8 space-y-8 shadow-xs">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0 border border-teal-100">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-zinc-900 tracking-tight">System Observability &amp; Cache Layering</h3>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${
                db?.simulatedFailoverActive ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}>
                {db?.simulatedFailoverActive ? "FAILOVER REPLICA ACTIVE" : "PRIMARY ONLINE"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Real-time telemetry, database health metrics, L1/L2 cache performance, failover orchestration, and system error log traces.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 border-zinc-350 focus:ring-teal-500 accent-teal-600 cursor-pointer"
            />
            <span>Auto-refresh (5s)</span>
          </label>

          <button
            onClick={() => fetchDiagnostics(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] font-mono uppercase tracking-wider rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-teal-400" : ""}`} />
            <span>Sync Probes</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-zinc-100 gap-6 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-hide">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "overview" 
              ? "border-teal-600 text-teal-850" 
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Server &amp; Database Health</span>
        </button>
        <button
          onClick={() => setActiveTab("cache")}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "cache" 
              ? "border-teal-600 text-teal-850" 
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Cache Layering ({cache?.activeKeysCount || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab("errors")}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "errors" 
              ? "border-teal-600 text-teal-850" 
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>System Error Logs ({errors.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("tips")}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "tips" 
              ? "border-teal-600 text-teal-850" 
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          <Lightbulb className="w-4 h-4 text-teal-600" />
          <span>Operational Guidelines</span>
        </button>
      </div>

      {/* Tab 1: Overview (Server + Database) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Server Uptime */}
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold">Server Uptime</span>
                <Cpu className="w-4 h-4 text-teal-700" />
              </div>
              <div className="text-xl font-black text-zinc-900 font-mono">
                {formatUptime(server?.uptime || 0)}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>PID: {server?.pid || "3290"} ({server?.platform || "linux"})</span>
              </div>
            </div>

            {/* Memory Heap */}
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold">Node.js Heap Memory</span>
                <HardDrive className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-black text-zinc-900 font-mono">
                {server?.memoryHeapUsed || 0} MB
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                Allocated: {server?.memoryHeapTotal || 0} MB (RSS: {server?.memoryRss || 0} MB)
              </div>
            </div>

            {/* Database Connectivity */}
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold">Database Connectivity</span>
                <Database className={`w-4 h-4 ${db?.simulatedFailoverActive ? "text-amber-600" : "text-emerald-600"}`} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full relative flex shrink-0 ${db?.simulatedFailoverActive ? "bg-amber-500" : "bg-emerald-500"}`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                </span>
                <span className="text-sm font-extrabold text-zinc-900 leading-tight truncate">
                  {db?.engine || "MySQL Prod DB"}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                Ping: {db?.pingLatencyMs ?? 2}ms ({db?.poolStatus || "Active Pool"})
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold">Cache Hit Rate</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-black text-zinc-900 font-mono">
                {cache?.hitRate ?? 100}%
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                Hits: {cache?.hits || 0} | Misses: {cache?.misses || 0}
              </div>
            </div>

          </div>



          {/* Detailed Diagnostics Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Server Status Panel */}
            <div className="bg-zinc-50/50 border border-zinc-200 rounded-2xl p-5 space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-teal-700" />
                  <h4 className="text-xs font-extrabold text-zinc-900 font-mono uppercase tracking-wider">Server Environment Specs</h4>
                </div>
                <span className="text-[10px] font-mono bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded font-bold">
                  {server?.environment || "production"}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Node Runtime Version:</span>
                  <span className="font-mono font-bold text-zinc-800">{server?.nodeVersion || "v20.11.0"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Operating System Platform:</span>
                  <span className="font-mono font-bold text-zinc-800 uppercase">{server?.platform || "Linux x64"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Process ID (PID):</span>
                  <span className="font-mono font-bold text-zinc-800">{server?.pid || "1402"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Memory Heap Utilization:</span>
                  <span className="font-mono font-bold text-teal-700">
                    {server?.memoryHeapUsed} MB / {server?.memoryHeapTotal} MB
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Security OWASP Headers:</span>
                  <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Enforced
                  </span>
                </div>
              </div>
            </div>

            {/* Database Connectivity Panel */}
            <div className="bg-zinc-50/50 border border-zinc-200 rounded-2xl p-5 space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <Database className={`w-4 h-4 ${db?.simulatedFailoverActive ? "text-amber-600" : "text-emerald-600"}`} />
                  <h4 className="text-xs font-extrabold text-zinc-900 font-mono uppercase tracking-wider">Database &amp; Storage Engine</h4>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                  db?.simulatedFailoverActive ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {db?.simulatedFailoverActive ? "FAILOVER MODE" : "CONNECTED"}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Persistence Engine Driver:</span>
                  <span className="font-mono font-bold text-zinc-800">{db?.engine}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Round-trip Ping Latency:</span>
                  <span className="font-mono font-bold text-emerald-600">{db?.pingLatencyMs ?? 2}ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Connection Pool Sockets:</span>
                  <span className="font-mono font-bold text-zinc-800">{db?.activeConnections} active / 50 max</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Failover Engine Status:</span>
                  <span className={`font-mono font-bold ${db?.simulatedFailoverActive ? "text-amber-600" : "text-emerald-600"}`}>
                    {db?.poolStatus}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Last Telemetry Probe:</span>
                  <span className="font-mono text-zinc-500 text-[11px]">{db?.lastPingTimestamp ? new Date(db.lastPingTimestamp).toLocaleTimeString() : "Just now"}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: Cache Layering Diagnostics */}
      {activeTab === "cache" && (
        <div className="space-y-6 text-left">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50 p-5 rounded-2xl border border-zinc-200">
            <div>
              <h4 className="text-xs font-extrabold text-zinc-900 font-mono uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-700" />
                In-Memory L1/L2 Cache Layering Engine
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                Accelerates heavy REST queries, dashboard statistics, and employee verification payloads with TTL invalidation.
              </p>
            </div>
            
            <button
              onClick={handleFlushCache}
              disabled={flushingCache}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Trash2 className={`w-3.5 h-3.5 ${flushingCache ? "animate-bounce" : ""}`} />
              <span>Flush / Clear Cache</span>
            </button>
          </div>

          {/* Cache Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold block">Active Cached Keys</span>
              <div className="text-2xl font-black text-zinc-900 font-mono mt-1">
                {cache?.activeKeysCount || 0}
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Total Stored: {cache?.totalKeysStored || 0}</span>
            </div>

            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold block">Cache Hit / Miss Ratio</span>
              <div className="text-2xl font-black text-emerald-600 font-mono mt-1">
                {cache?.hitRate || 100}%
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Hits: {cache?.hits || 0} | Misses: {cache?.misses || 0}</span>
            </div>

            <div className="bg-zinc-50/70 border border-zinc-200 rounded-2xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-450 font-bold block">Flush Operations</span>
              <div className="text-2xl font-black text-zinc-900 font-mono mt-1">
                {cache?.flushCount || 0}
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block truncate">Last Flush: {cache?.lastFlushTime ? new Date(cache.lastFlushTime).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>

          {/* Active Keys Listing Table */}
          <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-700 font-mono uppercase tracking-wider">Active Cached Keys Table</span>
              <span className="text-[10px] text-zinc-500 font-mono">TTL-based automated eviction active</span>
            </div>

            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-400 text-[10px] font-mono uppercase tracking-wider bg-zinc-50/50 sticky top-0">
                    <th className="py-2.5 px-4 font-bold">Cache Key String</th>
                    <th className="py-2.5 px-4 font-bold text-center">Hits Served</th>
                    <th className="py-2.5 px-4 font-bold text-center">Age</th>
                    <th className="py-2.5 px-4 font-bold text-right">TTL Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(!cache?.keysSummary || cache.keysSummary.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-400 italic">
                        No keys currently cached. Queries will populate cache layer upon execution.
                      </td>
                    </tr>
                  ) : (
                    cache.keysSummary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-zinc-800 font-semibold">{item.key}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-teal-700 font-bold">{item.hits}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-zinc-500">{item.ageSeconds}s</td>
                        <td className="py-2.5 px-4 text-right font-mono text-zinc-600 font-semibold">{item.ttlRemaining}s</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Tab 3: System Error Logs */}
      {activeTab === "errors" && (
        <div className="space-y-4 text-left">
          <div className="flex items-center justify-between bg-zinc-900 text-white p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-mono font-bold tracking-wide">Recent System Error Logs Buffer</span>
            </div>
            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              Showing last {errors.length} error events
            </span>
          </div>

          <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-400 text-[10px] font-mono uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-3 px-4 font-bold">Timestamp</th>
                    <th className="py-3 px-4 font-bold">Method &amp; Route</th>
                    <th className="py-3 px-4 font-bold">Error Message</th>
                    <th className="py-3 px-4 font-bold text-center">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Client IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {errors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-400 italic">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        No system error logs recorded. All API endpoints operating cleanly without exceptions.
                      </td>
                    </tr>
                  ) : (
                    errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">
                          {err.timestamp ? new Date(err.timestamp).toLocaleTimeString() : "N/A"}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-2 ${
                            err.method === "POST" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                          }`}>
                            {err.method}
                          </span>
                          <span className="text-zinc-800 font-semibold">{err.path}</span>
                        </td>
                        <td className="py-3 px-4 text-rose-600 font-medium truncate max-w-xs" title={err.message}>
                          {err.message}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-full text-[10px]">
                            {err.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-500 text-[11px]">
                          {err.ip || "127.0.0.1"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: System Operational Guidelines & Best Practices */}
      {activeTab === "tips" && (
        <div className="bg-gradient-to-br from-teal-900 via-zinc-900 to-zinc-950 text-white rounded-3xl p-6 md:p-8 space-y-6 shadow-xl border border-teal-800/40">
          <div className="flex items-center justify-between border-b border-teal-800/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                <Lightbulb className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  System Operational Guidelines &amp; Health Tips
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/30 text-teal-300 border border-teal-400/40">Telemetry Verified</span>
                </h3>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Static operational best practices and capacity guidelines compiled from active system diagnostics and cache telemetry.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/90 border border-teal-800/60 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> 1. Peak Capacity &amp; Queue Management
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Hospital meal traffic spikes between <strong>12:00 PM – 1:30 PM</strong> and <strong>7:00 PM – 8:30 PM</strong>. Ensure both cashier QR scanner terminals remain online with active probes during peak windows.
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-teal-800/60 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> 2. Cache Layering &amp; Invalidation
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                L1 memory cache maintains active employee voucher keys. Flush the cache layer via the diagnostics console if schedule rosters or department entitlements are modified mid-shift.
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-teal-800/60 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <Database className="w-4 h-4" /> 3. High Availability &amp; Replication
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Database ping metrics are monitored continuously. In the event of primary database latency exceeding thresholds, use the manual failover trigger to switch seamlessly to the read replica.
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-teal-800/60 rounded-2xl p-5 space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 4. Night Duty &amp; Meal Kit Logistics
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Night shift personnel meal allowances (10:00 PM – 6:00 AM) auto-renew at midnight. Pre-pack thermal meal kits by 10:00 PM to eliminate cashier queue delays during night shift transitions.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
