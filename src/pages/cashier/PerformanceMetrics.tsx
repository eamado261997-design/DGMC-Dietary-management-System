import React, { useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  CheckCircle2, 
  Clock, 
  Activity, 
  Zap, 
  Terminal, 
  TrendingUp, 
  AlertTriangle 
} from "lucide-react";

export interface ScanEvent {
  id: string;
  timestamp: string;
  success: boolean;
  responseTime: number;
}

export interface HourlyData {
  hour: string;
  scans: number;
  avgResponseTime: number;
}

interface PerformanceMetricsProps {
  scans: ScanEvent[];
  hourlyData: HourlyData[];
}

export default function PerformanceMetrics({ scans, hourlyData }: PerformanceMetricsProps) {
  const [activeChartTab, setActiveChartTab] = useState<"volume" | "latency">("volume");

  // Calculate stats from the total scans (including historical base + live scans)
  const totalScans = scans.length;
  const successfulScans = scans.filter(s => s.success).length;
  const averageLatency = totalScans > 0 
    ? Math.round(scans.reduce((acc, s) => acc + s.responseTime, 0) / totalScans) 
    : 0;
  
  const successRate = totalScans > 0 
    ? ((successfulScans / totalScans) * 100).toFixed(1) 
    : "100";

  // Get scanner efficiency description
  const getEfficiencyRating = (rate: number, latency: number) => {
    if (rate >= 95 && latency <= 150) {
      return { rating: "Excellent", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
    if (rate >= 85 && latency <= 250) {
      return { rating: "Optimal", color: "text-teal-700 bg-teal-50 border-teal-200" };
    }
    return { rating: "Degraded", color: "text-amber-700 bg-amber-50 border-amber-200" };
  };

  const ratingStatus = getEfficiencyRating(parseFloat(successRate), averageLatency);

  return (
    <div id="scanner-performance-metrics" className="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 space-y-8 shadow-xs">
      
      {/* Title & Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <Activity className="w-5 h-5" />
            </span>
            <h3 className="text-base font-black text-zinc-900 tracking-tight">Scanner Terminal Diagnostics</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time latency metrics and throughput logs capturing physical DS9308 device scan performance.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-full text-zinc-650 shrink-0 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
          <span>DIAGNOSTICS ONLINE</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1: Successful Scans */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left flex items-start gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Successful Scans Today</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="text-2xl font-black text-zinc-900">{successfulScans}</h4>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                100% Verified
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Total throughput on terminal</p>
          </div>
        </div>

        {/* Metric 2: Average Response Latency */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left flex items-start gap-4">
          <div className="p-3 bg-teal-100 text-teal-850 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Avg Response Latency</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="text-2xl font-black text-zinc-900">{averageLatency}ms</h4>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                averageLatency <= 150 
                  ? "text-emerald-600 bg-emerald-50 border border-emerald-200" 
                  : averageLatency <= 250 
                    ? "text-teal-700 bg-teal-50 border-teal-200" 
                    : "text-amber-700 bg-amber-50 border-amber-200"
              }`}>
                {averageLatency <= 150 ? "Excellent" : averageLatency <= 250 ? "Optimal" : "Slow"}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Full API request-response roundtrip</p>
          </div>
        </div>

        {/* Metric 3: Scanner Efficiency */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Scanner Efficiency Rating</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="text-2xl font-black text-zinc-900">{successRate}%</h4>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ratingStatus.color}`}>
                {ratingStatus.rating}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Voucher eligibility accuracy score</p>
          </div>
        </div>

      </div>

      {/* Hourly Chart Controls & Visualization */}
      <div className="bg-zinc-50/50 border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-6">
        
        {/* Toggle bar / Legend */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="text-xs font-bold text-zinc-900">Scanner Efficiency Metrics (Hourly Log)</h4>
            <p className="text-[11px] text-zinc-500">Hourly throughput load and database lookup latencies</p>
          </div>
          <div className="flex bg-zinc-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveChartTab("volume")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                activeChartTab === "volume" 
                  ? "bg-white text-teal-850 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Scan Volume
            </button>
            <button
              onClick={() => setActiveChartTab("latency")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                activeChartTab === "latency" 
                  ? "bg-white text-teal-850 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Response Latency
            </button>
          </div>
        </div>

        {/* Recharts Bar Chart Frame */}
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hourlyData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="hour" 
                tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold", fontFamily: "monospace" }}
                axisLine={{ stroke: "#e4e4e7" }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                label={{ 
                  value: activeChartTab === "volume" ? "Number of Scans" : "Latency (ms)", 
                  angle: -90, 
                  position: "insideLeft",
                  style: { textAnchor: "middle", fill: "#a1a1aa", fontSize: 9, fontWeight: "bold" },
                  offset: 10
                }}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: "#18181b", 
                  borderColor: "#27272a", 
                  borderRadius: "12px", 
                  padding: "10px 14px" 
                }}
                labelStyle={{ color: "#a1a1aa", fontWeight: "bold", fontSize: "10px", fontFamily: "monospace" }}
                itemStyle={{ color: "#2dd4bf", fontSize: "12px", fontWeight: "bold" }}
                cursor={{ fill: "rgba(20, 184, 166, 0.04)" }}
                formatter={(value: any) => [
                  activeChartTab === "volume" ? `${value} scans` : `${value} ms`,
                  activeChartTab === "volume" ? "Log Volume" : "Roundtrip Latency"
                ]}
              />
              <Bar 
                dataKey={activeChartTab === "volume" ? "scans" : "avgResponseTime"} 
                radius={[6, 6, 0, 0]}
                maxBarSize={45}
              >
                {hourlyData.map((entry, index) => {
                  // Beautiful conditional color schemes!
                  let barColor = "#0d9488"; // default teal-600
                  if (activeChartTab === "volume") {
                    barColor = "#0f766e"; // teal-750 for scan volume
                  } else {
                    // response latency: green if fast, amber if medium, rose if slow
                    const val = entry.avgResponseTime;
                    barColor = val <= 130 ? "#0d9488" : val <= 150 ? "#14b8a6" : "#f59e0b";
                  }
                  return <Cell key={`cell-${index}`} fill={barColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Terminal Real-Time Stream Log Output footer */}
      <div className="border-t border-zinc-150 pt-5 text-left">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 font-bold mb-3">
          <Terminal className="w-3.5 h-3.5 text-teal-700" />
          <span>REAL-TIME HARDWARE STACK TRACE STREAM</span>
        </div>
        <div className="bg-zinc-950 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-zinc-350 shadow-inner max-h-[140px] overflow-y-auto space-y-1">
          {scans.slice(-3).reverse().map((s, idx) => (
            <div key={`${s.id}-${idx}`} className="flex items-start justify-between">
              <span className="text-zinc-500">[{s.timestamp}]</span>
              <span className="flex-1 ml-3 truncate">
                Voucher check ID <span className="text-zinc-400 font-bold">#{s.id.slice(0, 8)}</span>
                {s.success ? (
                  <span className="text-emerald-400 ml-1.5">SUCCESS_AUTHORIZED</span>
                ) : (
                  <span className="text-rose-400 ml-1.5">SCAN_FAILED_INELIGIBLE</span>
                )}
              </span>
              <span className="text-teal-400 font-bold">+{s.responseTime}ms</span>
            </div>
          ))}
          {scans.length === 0 && (
            <div className="text-zinc-500 italic">No live hardware scan diagnostics triggered since load. Standby active.</div>
          )}
          <div className="text-[10px] text-zinc-550 pt-1 border-t border-zinc-900 flex justify-between">
            <span>Zebra DS9308 USB Driver version 4.2.0-secure</span>
            <span>Channel ID: f331d419-gcm</span>
          </div>
        </div>
      </div>

    </div>
  );
}
