import React from "react";
import { Activity, Clock, Zap, BarChart3, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from "recharts";
import { SystemPerfData } from "../../utils/analytics.js";

interface DiagnosticChartProps {
  data: SystemPerfData | null;
  loading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const DiagnosticTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const avgLatency = payload.find(p => p.dataKey === "avgLatency")?.value ?? 0;
    const maxLatency = payload.find(p => p.dataKey === "maxLatency")?.value ?? 0;
    const avgDbLatency = payload.find(p => p.dataKey === "avgDbLatency")?.value ?? 0;
    const requests = payload.find(p => p.dataKey === "requests")?.value ?? 0;

    return (
      <div className="bg-zinc-900 text-white rounded-2xl p-4 shadow-xl border border-zinc-850 text-xs font-sans min-w-[240px]">
        <div className="font-bold text-zinc-100 text-[13px] border-b border-zinc-800 pb-2 mb-2 flex justify-between items-center">
          <span>Interval: {label}</span>
          <span className="px-2 py-0.5 bg-teal-950 text-teal-300 rounded-full text-[10px] uppercase font-mono font-bold">
            Telemetry
          </span>
        </div>
        <div className="space-y-2">
          {/* Requests Row */}
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />
              <span>Throughput:</span>
            </span>
            <span className="font-mono text-sky-400 font-extrabold text-[13px]">
              {requests} req{requests !== 1 ? 's' : ''}
            </span>
          </div>
          
          {/* Latency Rows */}
          <div className="space-y-1.5 border-t border-zinc-800 pt-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2.5 h-1.5 bg-teal-500 inline-block rounded-full" />
                <span>Avg API Latency:</span>
              </span>
              <span className="font-mono text-teal-400 font-extrabold text-[13px]">
                {avgLatency} ms
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2.5 h-1 bg-amber-500 inline-block rounded-full" />
                <span>MySQL Query Latency:</span>
              </span>
              <span className="font-mono text-amber-400 font-extrabold text-[13px]">
                {avgDbLatency} ms
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2.5 h-0.5 bg-rose-500 inline-block" />
                <span>Max API Latency:</span>
              </span>
              <span className="font-mono text-rose-400 font-bold text-[11px]">
                {maxLatency} ms
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function DiagnosticChart({ data, loading = false }: DiagnosticChartProps) {
  const chartData = data?.hourlyChartData || [];

  if (loading && chartData.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <BarChart3 className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-100 rounded-md w-1/3 animate-pulse" />
            <div className="h-3 bg-zinc-100 rounded-md w-1/4 animate-pulse" />
          </div>
        </div>
        <div className="h-64 bg-zinc-50/50 rounded-2xl flex items-center justify-center border border-zinc-100">
          <div className="text-center space-y-2">
            <div className="w-6 h-6 border-2 border-teal-650 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[11px] font-mono text-zinc-400">Aggregating 1-hour timeseries telemetry...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalRequestsInHour = chartData.reduce((sum, item) => sum + item.requests, 0);
  const avgLatencyInHour = chartData.length > 0
    ? Math.round(chartData.reduce((sum, item) => sum + (item.requests > 0 ? item.avgLatency : 0), 0) / Math.max(1, chartData.filter(item => item.requests > 0).length))
    : 0;
  const avgDbLatencyInHour = chartData.length > 0
    ? Math.round(chartData.reduce((sum, item) => sum + (item.requests > 0 ? (item.avgDbLatency || 0) : 0), 0) / Math.max(1, chartData.filter(item => item.requests > 0).length))
    : 0;

  return (
    <div id="diagnostic-chart-panel" className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
      {/* Header and Summary stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0 border border-teal-100">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight">System Performance Timeline</h3>
            <p className="text-[10px] text-zinc-500 font-medium">Dual-axis latency profiling and throughput frequency over the last hour</p>
          </div>
        </div>

        {/* Live Hourly KPIs */}
        <div className="flex flex-wrap gap-3 self-end md:self-auto font-mono text-[11px]">
          <div className="bg-zinc-50 border border-zinc-150 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-zinc-500 font-semibold">1H Volume:</span>
            <span className="text-zinc-800 font-black">{totalRequestsInHour} requests</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-150 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-zinc-500 font-semibold">1H Avg Response:</span>
            <span className="text-teal-700 font-black">{avgLatencyInHour} ms</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-150 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-zinc-500 font-semibold">1H Avg MySQL:</span>
            <span className="text-amber-700 font-black">{avgDbLatencyInHour} ms</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative h-72 w-full overflow-hidden">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-200 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-zinc-400 mb-2" />
            <h4 className="text-xs font-bold text-zinc-700">No Telemetry Recorded</h4>
            <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">Benchmark logs are empty. Telemetry will begin rendering once operations execute.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: -10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              
              <XAxis 
                dataKey="timeLabel" 
                stroke="#71717a" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false}
                interval={2} 
              />
              
              {/* Left Y-Axis for Latency */}
              <YAxis 
                yAxisId="left"
                stroke="#0f766e" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                allowDecimals={false}
                label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: '9px', fill: '#0f766e', fontWeight: 'bold' } }}
              />

              {/* Right Y-Axis for Request Frequency */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#0284c7" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                allowDecimals={false}
                label={{ value: 'Requests / min', angle: 90, position: 'insideRight', offset: -5, style: { fontSize: '9px', fill: '#0284c7', fontWeight: 'bold' } }}
              />
              
              <Tooltip content={<DiagnosticTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} />
              
              {/* Requests (sky bar chart) on the right axis */}
              <Bar 
                yAxisId="right"
                dataKey="requests" 
                name="Request Frequency" 
                fill="#0284c7" 
                radius={[2, 2, 0, 0]}
                barSize={12}
                opacity={0.85}
              />

              {/* Latency Area (teal) on the left axis */}
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="avgLatency" 
                name="Average API Latency (ms)" 
                stroke="#0f766e" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#latencyGradient)" 
              />

              {/* MySQL Query Latency Line (amber) on the left axis */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgDbLatency"
                name="Avg MySQL Query Latency (ms)"
                stroke="#d97706"
                strokeWidth={2}
                dot={{ r: 1.5, fill: "#d97706" }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
