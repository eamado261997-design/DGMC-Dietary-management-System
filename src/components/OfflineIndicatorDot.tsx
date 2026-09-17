import React, { useState } from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus.js";
import { useAuth } from "../context/AuthContext.js";
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function OfflineIndicatorDot() {
  const isOnline = useNetworkStatus();
  const { queue, isSyncing } = useAuth();
  const [showTooltip, setShowTooltip] = useState(false);

  const pendingCount = queue?.length || 0;
  const isDisconnected = !isOnline;
  const isDisconnectedAndQueued = isDisconnected && pendingCount > 0;

  // Render Green Dot when online with no pending queue
  if (isOnline && pendingCount === 0) {
    return (
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setShowTooltip(!showTooltip)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-mono font-bold transition-all hover:bg-emerald-100 cursor-pointer select-none"
          title="Online - All changes synced"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="hidden md:inline">Online</span>
        </button>

        {showTooltip && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-xl p-3 z-50 text-left text-zinc-800 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Network Connected</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-normal">
              You are connected to the network. All transactions and actions sync automatically in real-time.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render Yellow / Amber indicator dot when disconnected or when changes are queued
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold border transition-all cursor-pointer select-none ${
          isDisconnectedAndQueued || pendingCount > 0
            ? "bg-amber-400 text-amber-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.7)] animate-pulse"
            : "bg-amber-100 text-amber-900 border-amber-300"
        }`}
        title={
          pendingCount > 0
            ? `Offline - ${pendingCount} change(s) queued for sync`
            : "Offline mode - network disconnected"
        }
      >
        {/* Yellow / Amber Indicator Dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-90"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 shadow-xs"></span>
        </span>
        <WifiOff className="w-3 h-3 shrink-0" />
        <span className="font-bold uppercase tracking-wider">
          {pendingCount > 0 ? `${pendingCount} Queued` : "Offline"}
        </span>
      </button>

      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-amber-950 text-amber-50 border border-amber-700/80 rounded-2xl shadow-2xl p-4 z-50 text-left animate-fade-in">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {pendingCount > 0 ? "Changes Queued for Synchronization" : "Network Disconnected"}
            </span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            {pendingCount > 0
              ? `You are currently offline. ${pendingCount} attempted change(s) have been captured locally and queued for automatic synchronization when connectivity is restored.`
              : "You are disconnected from the network. Any actions or modifications will be queued for automatic sync upon reconnection."}
          </p>

          {pendingCount > 0 && (
            <div className="mt-3 pt-2.5 border-t border-amber-800/80 flex items-center justify-between text-[10px] font-mono text-amber-300">
              <span>Pending Sync Queue: {pendingCount}</span>
              {isSyncing && (
                <span className="flex items-center gap-1 text-amber-200 animate-pulse font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
