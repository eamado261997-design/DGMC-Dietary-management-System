import React from "react";
import { Lock as LockIcon, Check } from "lucide-react";

const ROLES = ["admin", "manager", "cashier", "employee"];
const FEATURES = [
  { name: "System Diagnostics", path: "/api/admin/sys-health" },
  { name: "User Management", path: "/api/admin/people" },
  { name: "System Settings", path: "/api/settings" },
  { name: "Audit Logs", path: "/api/audit-logs" },
  { name: "Cashier Scan", path: "/api/cashier/scan" },
  { name: "Departments", path: "/api/departments" },
];

const RBAC_MAPPING: Record<string, string[]> = {
  admin: FEATURES.map(f => f.name),
  manager: ["User Management", "Cashier Scan", "Departments"],
  cashier: ["Cashier Scan"],
  employee: [],
};

export default function RBACVisualizer() {
  return (
    <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <LockIcon className="text-teal-600 w-6 h-6" />
        <h2 className="text-xl font-bold text-zinc-900">RBAC Configuration Mapping</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="py-3 px-4 font-semibold text-zinc-900">Feature</th>
              {ROLES.map(role => (
                <th key={role} className="py-3 px-4 text-center capitalize text-zinc-900">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map(feature => (
              <tr key={feature.name} className="border-b border-zinc-100">
                <td className="py-3 px-4 text-zinc-800 font-medium">{feature.name}</td>
                {ROLES.map(role => (
                  <td key={role} className="py-3 px-4 text-center">
                    {RBAC_MAPPING[role].includes(feature.name) ? (
                      <Check className="text-teal-600 w-5 h-5 mx-auto" />
                    ) : (
                      <span className="text-zinc-300">-</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
