import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, BarChart3, DollarSign, Activity } from "lucide-react";

interface TransactionSummaryProps {
  totalVolume: number;
  totalRevenue: number;
  avgMealPrice: number;
  chartData?: Array<{ time: string; volume: number; avgPrice: number }>;
  currencySymbol?: string;
}

const defaultData = [
  { time: "08:00", volume: 12, avgPrice: 150 },
  { time: "10:00", volume: 25, avgPrice: 160 },
  { time: "12:00", volume: 58, avgPrice: 155 },
  { time: "14:00", volume: 32, avgPrice: 150 },
  { time: "16:00", volume: 19, avgPrice: 165 },
  { time: "18:00", volume: 28, avgPrice: 170 },
];

export default function TransactionSummaryWidget({
  totalVolume = 174,
  totalRevenue = 27840,
  avgMealPrice = 160,
  chartData = defaultData,
  currencySymbol = "₱"
}: TransactionSummaryProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-150 flex items-center justify-center text-teal-800">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900">Transaction & Pricing Summary</h3>
            <p className="text-[11px] text-zinc-500 font-medium">Real-time daily volume and average meal pricing trends</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[10px] font-mono font-bold">
          <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          LIVE METRICS
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            Total Daily Volume
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-zinc-900 tracking-tight">{totalVolume}</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +14.2%
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Redemptions &amp; cash sales today</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            Total Gross Revenue
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-zinc-900 tracking-tight">
              {currencySymbol}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-150 px-2 py-0.5 rounded-md">
              Paid Sales
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Manual price overrides &amp; cash</p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
            Average Meal Pricing
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-teal-900 tracking-tight">
              {currencySymbol}{avgMealPrice.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Override Active
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Mean price per paid transaction</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
          <span>Hourly Volume &amp; Pricing Trend</span>
          <span className="text-[10px] font-mono text-zinc-400">Today vs. Hourly Distribution</span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#a1a1aa" fontSize={11} tickLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "none",
                  borderRadius: "12px",
                  color: "#f4f4f5",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
                }}
                formatter={(value: any, name: string) => [
                  name === "volume" ? `${value} scans` : `${currencySymbol}${Number(value).toFixed(2)}`,
                  name === "volume" ? "Transaction Volume" : "Average Price"
                ]}
              />
              <Area type="monotone" dataKey="volume" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVolume)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
