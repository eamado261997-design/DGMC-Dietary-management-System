import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export default function MealConsumptionChart({ consumed, scheduled }: { consumed: number, scheduled: number }) {
  const data = [
    { name: "Consumed", value: consumed },
    { name: "Remaining", value: Math.max(0, scheduled - consumed) },
  ];
  
  const COLORS = ["#0284c7", "#e4e4e7"];

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} fill="#8884d8" paddingAngle={5} dataKey="value">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
