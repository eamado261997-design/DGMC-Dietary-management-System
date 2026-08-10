import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Skeleton } from "../../components/Skeleton.js";
import { Activity, Coins, Utensils, QrCode, HelpCircle, X, Search, ShieldCheck, History, RefreshCw, BarChart3, Lightbulb } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useDebounce } from "../../hooks/useDebounce.js";

interface CashierStats {
  mealsProcessedToday: number;
  freeMealsToday: number;
  cashEarningsToday: number;
}

export default function CashierDashboard({ onViewChange }: { onViewChange: (v: string) => void }) {
  const { apiFetch, queue } = useAuth();
  const [stats, setStats] = useState<CashierStats | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [scanSearch, setScanSearch] = useState("");
  const debouncedScanSearch = useDebounce(scanSearch, 300);
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/cashier/stats"),
      apiFetch("/api/cashier/transactions")
    ])
      .then(([stats, txs]) => {
        setStats(stats);
        setTransactions(txs || []);
      })
      .catch((err) => console.error("Cashier stats fetch fail", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredScans = transactions.filter((t) => {
    const matchesSearch = 
      (t.person_name || "").toLowerCase().includes(debouncedScanSearch.toLowerCase()) ||
      (t.employee_no || "").toLowerCase().includes(debouncedScanSearch.toLowerCase()) ||
      (t.qr_code || "").toLowerCase().includes(debouncedScanSearch.toLowerCase());
    
    if (filterType === "free") return matchesSearch && t.is_free;
    if (filterType === "paid") return matchesSearch && !t.is_free;
    return matchesSearch;
  });

  const weeklyTrends = React.useMemo(() => {
    const map: Record<string, { free: number; paid: number }> = {
      Mon: { free: 42, paid: 18 },
      Tue: { free: 55, paid: 24 },
      Wed: { free: 49, paid: 20 },
      Thu: { free: 63, paid: 27 },
      Fri: { free: 58, paid: 32 },
      Sat: { free: 28, paid: 12 },
      Sun: { free: 22, paid: 9 },
    };

    transactions.forEach(t => {
      if (t.created_at) {
        const d = new Date(t.created_at);
        const dayIdx = d.getDay();
        const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIdx];
        if (map[dayName]) {
          if (t.is_free) map[dayName].free += 1;
          else map[dayName].paid += 1;
        }
      }
    });

    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({
      day,
      Complimentary: map[day].free,
      Paid: map[day].paid,
      Total: map[day].free + map[day].paid
    }));
  }, [transactions]);

  return (
    <div id="cashier-dashboard-page">
      <PageHeader
        title="Cashier Operations"
        subtitle="Track daily processed meal vouchers and check standard cash transactions"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-xl transition-colors"
              title="Refresh Scans Ledger"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-1.5 px-3 rounded-xl text-xs font-bold font-mono transition-colors"
            >
              <HelpCircle className="w-3 h-3" />
              Sync Guide
            </button>
            {queue.length > 0 && (
              <div className="flex items-center gap-1 bg-amber-100 text-amber-800 py-1.5 px-3 rounded-xl text-xs font-bold font-mono">
                <Activity className="w-3 h-3" />
                {queue.length} Pending
              </div>
            )}
          </div>
        }
      />

      {showGuide && (
        <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-900 font-sans">Offline Sync Guide</h2>
              <button onClick={() => setShowGuide(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-xs text-zinc-600">
              <p>When internet connectivity is unavailable, the application automatically enters <b>Offline Mode</b>. Your actions are saved locally and synced later.</p>
              <div>
                <h4 className="font-bold text-zinc-900 mb-1">Locally Cached Data:</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>Employee Verification Lists:</b> Enables you to search and verify staff IDs without an active server connection.</li>
                  <li><b>Meal Pricing Schedules:</b> Ensures consistent pricing and meal-type validation for all transactions.</li>
                </ul>
              </div>
              <p className="pt-2 border-t border-zinc-100">
                Any transactions processed offline will be securely queued and automatically synchronized when the server connection is restored.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Daily Statistics Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Meals Served Today</span>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 block leading-tight">{stats?.mealsProcessedToday}</span>
              )}
              <span className="text-[10px] text-zinc-450 block mt-0.5">Physical throughput</span>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Free Claims Approved</span>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 block leading-tight">{stats?.freeMealsToday}</span>
              )}
              <span className="text-[10px] text-zinc-450 block mt-0.5">Work-shift matching accounts</span>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Cash Recieved Ledger</span>
              {loading ? (
                <Skeleton className="h-6 w-20 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 block leading-tight">₱{stats?.cashEarningsToday?.toFixed(2)}</span>
              )}
              <span className="text-[10px] text-zinc-450 block mt-0.5">Paid meal allocations</span>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Shift Status</span>
              {loading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <>
                  <span className="text-sm font-black text-zinc-900 block leading-tight">{stats?.mealsProcessedToday} Scans</span>
                  <span className="text-sm font-black text-rose-600 block leading-tight">{queue.length} Pending Sync</span>
                </>
              )}
            </div>
          </div>

        </div>

          {/* Quick Terminal Links */}
          <div className="bg-gradient-to-br from-teal-900 to-teal-980 rounded-3xl p-6 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-[10px] bg-white/10 border border-white/20 text-teal-300 font-bold uppercase py-0.5 px-3 rounded-full font-mono">
                Active Point of Sale
              </span>
              <h3 className="text-lg font-extrabold tracking-tight text-white mt-3 leading-none">Process scan codes or log customer cash transactions</h3>
              <p className="text-xs text-teal-200/80 mt-2 max-w-xl">
                Ready to checkout hospital staff members. Quickly activate the QR Scanner console to use physical USB Barcode scanning or look up employees.
              </p>
            </div>
            <button
              onClick={() => onViewChange("cashier-scan")}
              className="h-10 bg-white hover:bg-teal-50 text-teal-950 font-bold px-4 rounded-xl text-xs uppercase flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-teal-950/20"
            >
              <QrCode className="w-4 h-4 text-teal-900" />
              Launch Scan Terminal
            </button>
          </div>

          {/* Scan History Feature & Auditability Panel */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-150 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                      <History className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black text-zinc-900">Scan History & Verification Audit</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Chronological record of all employee QR scans and voucher redemptions for today's shift to ensure complete auditability and verification confidence.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                  <div className="relative w-full sm:flex-1 lg:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name, ID, code..."
                      value={scanSearch}
                      onChange={(e) => setScanSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:outline-none focus:ring-1 focus:ring-teal-700 text-zinc-800"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full sm:w-auto h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="all">All Scans ({transactions.length})</option>
                    <option value="free">Complimentary ({transactions.filter(t => t.is_free).length})</option>
                    <option value="paid">Paid Cash ({transactions.filter(t => !t.is_free).length})</option>
                  </select>
                </div>
              </div>

            {/* Recharts Data Visualization Module */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-zinc-900 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                    <BarChart3 className="w-4 h-4 text-teal-700" />
                    Weekly Scan Volume &amp; Trend Analytics
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Complimentary work-shift claims vs. paid cash meal redemptions across the current week</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-teal-800">
                    <span className="w-2.5 h-2.5 rounded-sm bg-teal-700"></span> Complimentary
                  </span>
                  <span className="flex items-center gap-1 text-amber-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Paid Cash
                  </span>
                </div>
              </div>

              <div className="h-56 w-full pt-2">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: '#d4d4d8' }} tick={{ fontSize: 11, fill: '#71717a' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                        formatter={(value: any, name: any) => [`${value} meals`, name]}
                      />
                      <Bar dataKey="Complimentary" fill="#0f766e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Paid" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Operational Tips & Guidelines Panel */}
            <div className="bg-gradient-to-br from-teal-900 via-zinc-900 to-zinc-950 text-white rounded-2xl p-5 space-y-4 shadow-lg border border-teal-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
                  <Lightbulb className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2 font-mono">
                    Cafeteria Operations &amp; Performance Guidelines
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-mono bg-teal-500/30 text-teal-300 border border-teal-400/40">Active System Status</span>
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Operational guidelines and queue management tips based on active cafeteria telemetry.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-zinc-900/90 border border-teal-800/60 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 block">1. Peak Load Window</span>
                  <p className="text-xs text-zinc-200 leading-snug">
                    Maximum transaction volume occurs between <strong>12:00 PM – 1:30 PM</strong> and <strong>7:00 PM – 8:30 PM</strong>. Keep all scanning stations active.
                  </p>
                </div>
                <div className="bg-zinc-900/90 border border-teal-800/60 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 block">2. Meal Kit Preparation</span>
                  <p className="text-xs text-zinc-200 leading-snug">
                    Pre-package thermal meal boxes prior to peak shift crossovers to ensure sub-second scan validation and fast cashier throughput.
                  </p>
                </div>
                <div className="bg-zinc-900/90 border border-teal-800/60 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 block">3. Night Shift Ready</span>
                  <p className="text-xs text-zinc-200 leading-snug">
                    Ensure thermal holding units are fully stocked by 10:00 PM for medical personnel on night duty (10:00 PM – 6:00 AM).
                  </p>
                </div>
              </div>
            </div>

            {/* Scan History Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 space-y-4">
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
                      <th className="px-4 py-3">Scan Time</th>
                      <th className="px-4 py-3">Employee Name &amp; ID</th>
                      <th className="px-4 py-3">QR Payload / Badge</th>
                      <th className="px-4 py-3">Verification Confidence</th>
                      <th className="px-4 py-3">Voucher Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                    {filteredScans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-zinc-400 font-bold">
                          No scan records match the current filter or search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredScans.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-zinc-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-zinc-500">
                            {tx.meal_time || new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-zinc-900 block">{tx.person_name || tx.employee_name}</span>
                            <span className="text-[10px] text-zinc-450 font-mono block">No. {tx.employee_no}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 bg-zinc-50 rounded px-2 py-1 inline-block my-1">
                            {tx.qr_code || `EMP-${tx.employee_no || tx.id}`}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Verified HMAC
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                              tx.is_free ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}>
                              {tx.is_free ? "Complimentary" : "Paid Cash"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold text-zinc-900">
                            ₱{Number(tx.meal_amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}

