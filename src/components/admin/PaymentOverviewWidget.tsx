import React from "react";
import { Coins, TrendingUp } from "lucide-react";

export default function PaymentOverviewWidget({ paidAmountToday }: { paidAmountToday: number }) {
  // Simple calculation for projection: 
  // Assuming 150.0 per meal is the standard price.
  // This is a placeholder as full payroll projections require more data.
  const projectedDailyRevenue = 50000; // Example static projection
  const currentRevenue = paidAmountToday;
  
  const percentage = projectedDailyRevenue > 0 ? (currentRevenue / projectedDailyRevenue) * 100 : 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block mb-1">
            Payment Overview
          </span>
          <h3 className="text-xl font-black text-zinc-950">
            ₱{currentRevenue.toFixed(2)}
          </h3>
          <p className="text-[10px] text-zinc-500">Actual vs. Projected: ₱{projectedDailyRevenue.toFixed(2)}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
          <Coins className="w-4 h-4" />
        </div>
      </div>
      
      <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-amber-500 h-full transition-all duration-500" 
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] font-mono font-bold text-zinc-500">
        <span>0%</span>
        <span>{percentage.toFixed(1)}% Progress</span>
      </div>
    </div>
  );
}
