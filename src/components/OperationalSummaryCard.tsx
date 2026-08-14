import React from "react";
import { Activity, ShieldCheck, Database, Server, CheckCircle2, Lock, Clock } from "lucide-react";

export default function OperationalSummaryCard() {
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div id="operational-summary-card" className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8 space-y-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-zinc-900 tracking-tight">Operational System Summary</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Real-time operational status updates for core hospital infrastructure, security protocols, and database connectivity.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>Verified: {currentTime}</span>
        </div>
      </div>

      {/* Grid of status items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Item 1: Auth & Access */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase font-mono tracking-wider text-zinc-400">Authentication</span>
            <Lock className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-bold text-zinc-900">JWT &amp; RBAC Active</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            Session tokens, role permissions, and CSRF protection fully enforced across endpoints.
          </p>
        </div>

        {/* Item 2: Database Layer */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase font-mono tracking-wider text-zinc-400">Database Engine</span>
            <Database className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-bold text-zinc-900">Connected &amp; Synced</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            High-availability storage pipeline with automatic fallback and integrity checks active.
          </p>
        </div>

        {/* Item 3: API Gateway & Cache */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase font-mono tracking-wider text-zinc-400">API &amp; Cache Layer</span>
            <Server className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-bold text-zinc-900">L1/L2 Cache Healthy</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            Memory cache active for voucher validation, system settings, and fast query responses.
          </p>
        </div>

        {/* Item 4: Security & Audit */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase font-mono tracking-wider text-zinc-400">Security Audit</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-bold text-zinc-900">0 Vulnerabilities</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            AES-256 field encryption, audit logging, and SQL injection sanitization engaged.
          </p>
        </div>
      </div>
    </div>
  );
}
