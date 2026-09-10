import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Utensils, CheckCircle, Clock } from "lucide-react";

export default function MealConsumptionChart({ consumed, scheduled }: { consumed: number, scheduled: number }) {
  const remaining = Math.max(0, scheduled - consumed);
  const percent = scheduled > 0 ? Math.min(100, Math.round((consumed / scheduled) * 100)) : 0;

  const data = [
    { name: "Consumed", value: consumed },
    { name: "Remaining", value: remaining },
  ];
  
  const COLORS = ["#0d9488", "#e4e4e7"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-44 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={65} fill="#8884d8" paddingAngle={6} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "none",
                  borderRadius: "12px",
                  color: "#f4f4f5",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-black text-zinc-900">{percent}%</span>
            <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">Claimed</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-150 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase block">Consumed</span>
                <span className="text-sm font-black text-zinc-900">{consumed} meals</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-150">
              {percent}%
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-150 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase block">Remaining</span>
                <span className="text-sm font-black text-zinc-900">{remaining} scheduled</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200">
              {100 - percent}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 pt-2">
        <div className="flex justify-between text-xs font-bold text-zinc-700">
          <span>Daily Quota Utilization</span>
          <span className="font-mono text-teal-800">{consumed} / {scheduled} Total Scheduled</span>
        </div>
        <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden p-0.5 border border-zinc-200">
          <div 
            className="h-full bg-teal-700 rounded-full transition-all duration-500" 
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
