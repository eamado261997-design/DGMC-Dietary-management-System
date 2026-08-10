import React from "react";
import { Activity, Gauge, Zap, Clock, ShieldAlert, CheckCircle2, AlertTriangle, ArrowUpRight, RefreshCw, Server } from "lucide-react";
import { SystemPerfData, RouteAggregateItem } from "../../utils/analytics.js";

interface LatencyPercentilePanelProps {
  data: SystemPerfData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function LatencyPercentilePanel({ data, loading = false, onRefresh }: LatencyPercentilePanelProps) {
  const p95 = data?.p95Ms ?? 0;
  const p99 = data?.p99Ms ?? 0;
  const p50 = data?.p50Ms ?? 0;
  const avg = data?.avgLatencyMs ?? 0;
  const max = data?.maxLatencyMs ?? 0;
  const totalReqs = data?.totalRequests ?? 0;
  const errorCount = data?.errorCount ?? 0;
  const routeAggregates = data?.routeAggregates || [];

  // Status evaluations
  const getP95Status = (val: number) => {
    if (val === 0) return { label: "No Telemetry", color: "text-zinc-400 bg-zinc-800 border-zinc-700", status: "neutral" };
    if (val <= 100) return { label: "Optimal (<100ms)", color: "text-emerald-400 bg-emerald-950/80 border-emerald-600/40", status: "good" };
    if (val <= 250) return { label: "Acceptable (<250ms)", color: "text-amber-400 bg-amber-950/80 border-amber-600/40", status: "warn" };
    return { label: "High Latency (>250ms)", color: "text-rose-400 bg-rose-950/80 border-rose-600/40", status: "bad" };
  };

  const getP99Status = (val: number) => {
    if (val === 0) return { label: "No Telemetry", color: "text-zinc-400 bg-zinc-800 border-zinc-700", status: "neutral" };
    if (val <= 200) return { label: "Healthy Tail (<200ms)", color: "text-emerald-400 bg-emerald-950/80 border-emerald-600/40", status: "good" };
    if (val <= 500) return { label: "Elevated Tail (<500ms)", color: "text-amber-400 bg-amber-950/80 border-amber-600/40", status: "warn" };
    return { label: "Severe Spike (>500ms)", color: "text-rose-400 bg-rose-950/80 border-rose-600/40", status: "bad" };
  };

  const p95Status = getP95Status(p95);
  const p99Status = getP99Status(p99);

  return (
    <div id="latency-percentile-panel" className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 md:p-8 text-white shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-teal-500/20 to-rose-500/20 p-0.5 flex items-center justify-center border border-zinc-700">
            <div className="w-full h-full bg-zinc-900 rounded-[14px] flex items-center justify-center text-amber-400">
              <Gauge className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold tracking-tight text-zinc-100">
                API Latency Percentiles Engine
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-teal-950 text-teal-300 border border-teal-800/60">
                Live SLI Monitor
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              High-contrast response duration analytics (P50 Median, P95 Target, P99 Tail Ceiling)
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 text-xs font-bold text-zinc-200 transition-all shadow-sm hover:border-zinc-600 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${loading ? "animate-spin" : ""}`} />
            <span>Sync Latency Telemetry</span>
          </button>
        )}
      </div>

      {/* High-Contrast KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* P95 Latency Card (Amber/Gold High Contrast) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/70 via-zinc-900 to-zinc-950 border-2 border-amber-500/50 rounded-2xl p-5 shadow-xl shadow-amber-950/30 group hover:border-amber-400 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Gauge className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-300">
                P95 Percentile
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${p95Status.color}`}>
              {p95Status.label}
            </span>
          </div>

          <div className="my-2 relative z-10 flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono tracking-tight text-amber-300 drop-shadow-sm">
              {p95}
            </span>
            <span className="text-sm font-extrabold font-mono text-amber-200/70">ms</span>
          </div>

          <p className="text-[11px] text-zinc-300/90 leading-snug relative z-10 mt-2 border-t border-amber-500/20 pt-2.5">
            95% of client API requests execute faster than <span className="font-mono font-bold text-amber-300">{p95}ms</span>.
          </p>
        </div>

        {/* P99 Latency Card (Rose/Purple High Contrast) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-950/70 via-zinc-900 to-zinc-950 border-2 border-rose-500/50 rounded-2xl p-5 shadow-xl shadow-rose-950/30 group hover:border-rose-400 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-rose-300">
                P99 Tail Ceiling
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${p99Status.color}`}>
              {p99Status.label}
            </span>
          </div>

          <div className="my-2 relative z-10 flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono tracking-tight text-rose-300 drop-shadow-sm">
              {p99}
            </span>
            <span className="text-sm font-extrabold font-mono text-rose-200/70">ms</span>
          </div>

          <p className="text-[11px] text-zinc-300/90 leading-snug relative z-10 mt-2 border-t border-rose-500/20 pt-2.5">
            99% of requests respond within <span className="font-mono font-bold text-rose-300">{p99}ms</span> (worst 1% tail latency bound).
          </p>
        </div>

        {/* P50 Median Latency Card (Emerald/Teal High Contrast) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950/60 via-zinc-900 to-zinc-950 border border-emerald-500/30 rounded-2xl p-5 shadow-lg group hover:border-emerald-400/60 transition-all">
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Clock className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                P50 Median
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md text-emerald-300 bg-emerald-950/80 border border-emerald-800/60">
              50th Percentile
            </span>
          </div>

          <div className="my-2 relative z-10 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono tracking-tight text-emerald-300">
              {p50}
            </span>
            <span className="text-sm font-bold font-mono text-emerald-200/70">ms</span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug relative z-10 mt-2 border-t border-zinc-800 pt-2.5">
            Typical median round-trip experience across <span className="font-mono font-bold text-zinc-200">{totalReqs}</span> sampled requests.
          </p>
        </div>

        {/* Avg & Max Latency Card (Sky/Cyan High Contrast) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-950/60 via-zinc-900 to-zinc-950 border border-sky-500/30 rounded-2xl p-5 shadow-lg group hover:border-sky-400/60 transition-all">
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
                <Zap className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-300">
                Average / Max Peak
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md text-sky-300 bg-sky-950/80 border border-sky-800/60">
              Max: {max}ms
            </span>
          </div>

          <div className="my-2 relative z-10 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono tracking-tight text-sky-300">
              {avg}
            </span>
            <span className="text-sm font-bold font-mono text-sky-200/70">ms avg</span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug relative z-10 mt-2 border-t border-zinc-800 pt-2.5">
            Mean execution time. Peak single transaction duration: <span className="font-mono font-bold text-sky-300">{max}ms</span>.
          </p>
        </div>

      </div>

      {/* Critical Routes Breakdown Table */}
      {routeAggregates.length > 0 && (
        <div className="space-y-3 border-t border-zinc-850 pt-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Route Percentiles Telemetry Matrix
            </h4>
            <span className="text-[10px] text-zinc-400 font-mono">
              Sorted by P95 latency (highest to lowest)
            </span>
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-2xl bg-zinc-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px] font-mono uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">API Route</th>
                  <th className="py-3 px-3 font-bold text-center">Method</th>
                  <th className="py-3 px-3 font-bold text-center">Calls</th>
                  <th className="py-3 px-3 font-bold text-center text-emerald-400">P50</th>
                  <th className="py-3 px-3 font-bold text-center text-amber-400 bg-amber-950/30">P95</th>
                  <th className="py-3 px-3 font-bold text-center text-rose-400 bg-rose-950/30">P99</th>
                  <th className="py-3 px-3 font-bold text-center">Max</th>
                  <th className="py-3 px-3 font-bold text-center">Errors</th>
                  <th className="py-3 px-4 font-bold text-right">Route Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 text-zinc-200 font-mono">
                {routeAggregates.map((row: RouteAggregateItem, idx: number) => {
                  const isCritical = row.isCritical;
                  return (
                    <tr key={idx} className="hover:bg-zinc-850/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-zinc-100 font-mono text-[11px]">
                        {row.path || row.route}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          row.method === "GET" ? "bg-sky-950 text-sky-300 border border-sky-800/60" :
                          row.method === "POST" ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60" :
                          "bg-purple-950 text-purple-300 border border-purple-800/60"
                        }`}>
                          {row.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-zinc-300 font-semibold">
                        {row.count}
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">
                        {row.p50Ms}ms
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-300 font-black bg-amber-950/20">
                        {row.p95Ms}ms
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-300 font-black bg-rose-950/20">
                        {row.p99Ms}ms
                      </td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">
                        {row.maxLatencyMs}ms
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={row.errorCount > 0 ? "text-rose-400 font-bold animate-pulse" : "text-zinc-500"}>
                          {row.errorCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                            <Zap className="w-2.5 h-2.5" />
                            Critical SLI Route
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                            Standard API
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
