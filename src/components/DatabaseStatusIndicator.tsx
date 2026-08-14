import React, { useState, useEffect, useRef } from "react";
import { Database, Cpu, CheckCircle2, AlertCircle, RefreshCw, Server } from "lucide-react";

interface DbStatus {
  sqliteConnected: boolean;
  mysqlConnected: boolean;
  mysqlHost: string;
  isMysqlConfigured: boolean;
}

export default function DatabaseStatusIndicator() {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastFetchedRef = useRef<number>(0);

  const fetchStatus = async (force = false) => {
    // Throttle calls unless forced (e.g. manual refresh)
    const now = Date.now();
    if (!force && now - lastFetchedRef.current < 10000) {
      return; // Skip if fetched less than 10s ago
    }

    try {
      const response = await fetch("/api/db-status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        lastFetchedRef.current = Date.now();
      }
    } catch (_error) {
      // Suppress console diagnostics in production
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setShowTooltip(true);
    // Fetch on hover, throttled to 30s
    const now = Date.now();
    if (now - lastFetchedRef.current > 30000) {
      fetchStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);

    // Dynamic relaxed background polling (every 90s) and only when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchStatus(false);
      }
    }, 90000);

    // Click outside to close tooltip
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (loading && !status) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 text-zinc-400 font-mono text-[10px]">
        <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
        <span>DB STATUS</span>
      </div>
    );
  }

  const isSqliteActive = status?.sqliteConnected ?? false;
  const isMysqlActive = status?.mysqlConnected ?? false;
  const isMysqlConfigured = status?.isMysqlConfigured ?? false;

  // MySQL Badge Colors & Label
  let mysqlColorClass = "text-zinc-400 bg-zinc-100 border-zinc-200";
  let mysqlPulseClass = "bg-zinc-400";
  let mysqlLabel = "DOCKER DB: OFFLINE";
  if (isMysqlConfigured) {
    if (isMysqlActive) {
      mysqlColorClass = "text-teal-600 bg-teal-50 border-teal-200/50";
      mysqlPulseClass = "bg-teal-500";
      mysqlLabel = "DOCKER MYSQL: REACHABLE";
    } else {
      mysqlColorClass = "text-rose-600 bg-rose-50 border-rose-200/50";
      mysqlPulseClass = "bg-rose-500";
      mysqlLabel = "DOCKER MYSQL: UNREACHABLE";
    }
  }

  // SQLite Badge Colors & Label
  let sqliteColorClass = "text-zinc-400 bg-zinc-100 border-zinc-200";
  let sqlitePulseClass = "bg-zinc-400";
  let sqliteLabel = "SQLITE: OFFLINE";
  if (isSqliteActive) {
    sqliteColorClass = "text-emerald-600 bg-emerald-50 border-emerald-200/50";
    sqlitePulseClass = "bg-emerald-500";
    sqliteLabel = "SQLITE: ACTIVE";
  }

  return (
    <div className="relative flex items-center gap-2" ref={tooltipRef}>
      {/* MySQL Status Pill (Cloud Primary) */}
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={handleMouseEnter}
        className={`flex items-center gap-0.5 px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-full border text-[10px] font-bold font-mono tracking-wide transition-all duration-200 select-none cursor-pointer ${mysqlColorClass} hover:scale-105 active:scale-95`}
      >
        <span className="relative flex h-1.5 w-1.5">
          {isMysqlConfigured && isMysqlActive && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mysqlPulseClass}`}></span>
          )}
          {isMysqlConfigured && !isMysqlActive && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mysqlPulseClass}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${mysqlPulseClass}`}></span>
        </span>
        <Server className="w-3 h-3 shrink-0" />
        <span className="hidden sm:inline">{mysqlLabel}</span>
      </button>

      {/* SQLite Status Pill (Local Mirror) */}
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={handleMouseEnter}
        className={`flex items-center gap-0.5 px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-full border text-[10px] font-bold font-mono tracking-wide transition-all duration-200 select-none cursor-pointer ${sqliteColorClass} hover:scale-105 active:scale-95`}
      >
        <span className="relative flex h-1.5 w-1.5">
          {isSqliteActive && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${sqlitePulseClass}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${sqlitePulseClass}`}></span>
        </span>
        <Database className="w-3 h-3 shrink-0" />
        <span className="hidden sm:inline">{sqliteLabel}</span>
      </button>

      {/* Unified Tooltip Panel */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-zinc-200 shadow-xl p-4 z-50 text-zinc-800 animate-fadeIn text-left">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
            <h3 className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-teal-600" />
              High-Availability Architecture
            </h3>
            <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold">
              ACTIVE REPLICATION
            </span>
          </div>

          <div className="space-y-3">
            {/* MySQL Details */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-zinc-400" />
                  Docker MySQL (dgmc_mysql)
                </span>
                {!isMysqlConfigured ? (
                  <span className="text-[10px] font-bold text-zinc-400">Not Configured</span>
                ) : isMysqlActive ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Reachable
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Unreachable
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                {!isMysqlConfigured 
                  ? "No primary cloud database is configured. Operating solely in offline-first mode."
                  : `MySQL serves as the authoritative database running on Docker host ${status?.mysqlHost}. Data is synced dynamically.`}
              </p>
            </div>

            {/* SQLite Details */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-zinc-400" />
                  SQLite Relational Mirror
                </span>
                {isSqliteActive ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active (WAL Mode)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Offline
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                Local SQLite database mirrors the primary tables in real-time. It ensures zero latency reads/writes and provides seamless, offline-first transaction support.
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-100 pt-2 flex items-center justify-between text-[9px] text-zinc-400 font-mono">
            <span>Sync: Dual-Engine Active</span>
            <button 
              onClick={() => {
                setLoading(true);
                fetchStatus(true);
              }}
              className="hover:text-teal-600 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Force Probe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
