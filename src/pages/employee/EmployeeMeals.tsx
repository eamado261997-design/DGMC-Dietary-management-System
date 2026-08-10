import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { History, Search, Calendar, ChevronRight, Activity, Receipt, BadgeAlert, Coins, Printer, AlertCircle } from "lucide-react";

interface Transaction {
  id: number;
  meal_date: string;
  meal_time: string;
  is_free: boolean;
  meal_amount: number;
  status: "completed" | "cancelled";
}

export default function EmployeeMeals() {
  const { apiFetch } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const cached = localStorage.getItem("cached_employee_meals");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(transactions.length === 0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(() => 
    localStorage.getItem("cached_employee_meals_timestamp")
  );
  const [filterType, setFilterType] = useState<"all" | "free" | "paid" | "cancelled">("all");

  // Selected period cutoff configuration states
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "26_10" | "11_25">("all");

  useEffect(() => {
    async function loadMeals() {
      try {
        const list = await apiFetch("/api/employee/meals");
        setTransactions(list);
        localStorage.setItem("cached_employee_meals", JSON.stringify(list));
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString();
        localStorage.setItem("cached_employee_meals_timestamp", nowStr);
        setCacheTimestamp(nowStr);
        setIsOfflineMode(false);
      } catch (err) {
        console.error("Failed to load personal ledger", err);
        const cached = localStorage.getItem("cached_employee_meals");
        if (cached) {
          setTransactions(JSON.parse(cached));
          setIsOfflineMode(true);
        }
      } finally {
        setLoading(false);
      }
    }
    loadMeals();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <VitalSignsLoader size="md" color="teal" className="mb-2" />
        <p className="text-xs font-mono font-bold text-teal-800 mt-2 uppercase tracking-widest">
          Loading Meal Ledger...
        </p>
      </div>
    );
  }

  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const years = [2025, 2026, 2027];

  // Logic to assert if standard meal date fits in specific period cutoff
  const isDateInPeriod = (dateStr: string) => {
    if (selectedPeriod === "all") return true;

    const [tYear, tMonth, tDay] = dateStr.split("-").map(Number);
    const txDate = new Date(tYear, tMonth - 1, tDay, 12, 0, 0);

    if (selectedPeriod === "11_25") {
      const start = new Date(selectedYear, selectedMonth, 11, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth, 25, 23, 59, 59);
      return txDate >= start && txDate <= end;
    } else {
      // 26_10: 26th of previous month to 10th of chosen month
      let prevYear = selectedYear;
      let prevMonth = selectedMonth - 1;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      const start = new Date(prevYear, prevMonth, 26, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth, 10, 23, 59, 59);
      return txDate >= start && txDate <= end;
    }
  };

  // 1. First, refine records belonging strictly to chosen 15-day period cutoff
  const periodFilteredMeals = transactions.filter((t) => isDateInPeriod(t.meal_date));

  // 2. Compute dynamic metrics & cash amounts paid during active cutoff period
  const totalPaidInPeriod = periodFilteredMeals
    .filter((t) => t.status === "completed" && !t.is_free)
    .reduce((sum, t) => sum + Number(t.meal_amount), 0);

  const totalFreeInPeriod = periodFilteredMeals
    .filter((t) => t.status === "completed" && t.is_free)
    .length;

  const totalRefundedInPeriod = periodFilteredMeals
    .filter((t) => t.status === "cancelled")
    .reduce((sum, t) => sum + Number(t.meal_amount), 0);

  const totalMealsCount = periodFilteredMeals
    .filter((t) => t.status === "completed")
    .length;

  // 3. Second, filter list based on status selector tab
  const filteredList = periodFilteredMeals.filter((t) => {
    if (filterType === "free") return t.is_free && t.status === "completed";
    if (filterType === "paid") return !t.is_free && t.status === "completed";
    if (filterType === "cancelled") return t.status === "cancelled";
    return true;
  });

  return (
    <div id="employee-meals-ledger-view" className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Official Print-Only Branding Header */}
      <div className="print-header-brand">
        <h1>Divine Grace Medical Center</h1>
        <p>Compassionate Care, Exceptional Service</p>
        <p className="doc-title">Personal Dietary Benefit Claim Ledger</p>
      </div>

      <div className="print-meta-grid">
        <div className="print-meta-item">
          <span>Date Printed: </span>
          <span>{new Date().toLocaleString()}</span>
        </div>
        <div className="print-meta-item">
          <span>Selected Period: </span>
          <span>
            {selectedPeriod === "all" ? "Full History Record" : selectedPeriod === "11_25" ? `${months[selectedMonth]} 11th to 25th, ${selectedYear}` : `${months[selectedMonth]} 26th to 10th, ${selectedYear}`}
          </span>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 flex items-center gap-2">
            <History className="w-5 h-5 text-[#003299]" />
            <span>My Dietary Benefit Ledger</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Audit log of your completed dietary benefit claims and cafeteria logs</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => window.print()}
            className="h-9 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold px-3 flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Ledger</span>
          </button>

          {/* Filter Tabs */}
          <div className="inline-flex rounded-xl bg-zinc-150 p-1">
            {(["all", "free", "paid", "cancelled"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all outline-none ${
                  filterType === type
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isOfflineMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 items-center non-printable">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Intermittent Connectivity - Offline Mode</p>
            <p className="text-zinc-650 mt-0.5">
              Showing cached meal claim ledger (last synced: {cacheTimestamp || "recently"}). Recent meal receipts may not be visible until connection is restored.
            </p>
          </div>
        </div>
      )}

      {/* 15-Day Roster & Cutoff Filter Controls */}
      <div id="meals-cutoff-panel" className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs font-bold font-mono uppercase tracking-wider">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-zinc-205 rounded-xl bg-zinc-50 text-xs font-bold font-sans text-zinc-800 outline-none focus:border-[#003299] focus:bg-white"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs font-bold font-mono uppercase tracking-wider">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-zinc-205 rounded-xl bg-zinc-50 text-xs font-bold font-sans text-zinc-800 outline-none focus:border-[#003299] focus:bg-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 15-Day Cycle Toggle */}
        <div id="meals-period-tabs" className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl border border-zinc-200 self-start md:self-auto">
          <button
            onClick={() => setSelectedPeriod("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              selectedPeriod === "all"
                ? "bg-[#003299] text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            📋 All History
          </button>
          <button
            onClick={() => setSelectedPeriod("26_10")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              selectedPeriod === "26_10"
                ? "bg-[#003299] text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            📆 26th to 10th
          </button>
          <button
            onClick={() => setSelectedPeriod("11_25")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              selectedPeriod === "11_25"
                ? "bg-[#003299] text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            📆 11th to 25th
          </button>
        </div>
      </div>

      {/* Dynamic Summary Cards for Cut-Off Period / Filter */}
      <div id="period-summary-metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Cash Paid (Out-of-Pocket)</span>
            <span className="text-lg font-black text-zinc-900 leading-tight block">₱{totalPaidInPeriod.toFixed(2)}</span>
            <span className="text-[9px] text-zinc-405 block mt-0.5">
              {selectedPeriod === "all" ? "For entire history" : "During this 15-day period"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Vouched Free Claims</span>
            <span className="text-lg font-black text-zinc-900 leading-tight block">{totalFreeInPeriod} meals</span>
            <span className="text-[9px] text-emerald-700 font-semibold block mt-0.5">
              ₱0.00 hospital subsidized
            </span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-500 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Total Roster Meals</span>
            <span className="text-lg font-black text-zinc-900 leading-tight block">{totalMealsCount} raw logs</span>
            <span className="text-[9px] text-zinc-405 block mt-0.5 font-medium">
              Completed meal records
            </span>
          </div>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center">
          <Receipt className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h4 className="text-sm font-bold text-zinc-800 uppercase tracking-tight">No Transactions Registered</h4>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            There are no recorded transactions matching the chosen filter. Use your QR Code badge to claim benefits at the checkout register!
          </p>
        </div>
      ) : (
        /* List Display Group */
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-150">
                  <th className="px-6 py-4">Receipt ID</th>
                  <th className="px-6 py-4">Date &amp; Time</th>
                  <th className="px-6 py-4">Fulfillment Mode</th>
                  <th className="px-6 py-4">Claim Pricing</th>
                  <th className="px-6 py-4 text-center">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs text-zinc-700">
                {filteredList.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-zinc-500">
                      #{String(t.id).padStart(5, "0")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-bold text-zinc-900">{t.meal_date}</span>
                        <span className="text-zinc-400">@ {t.meal_time}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {t.status === "cancelled" ? (
                        <span className="text-zinc-400 font-bold">Revoked Claim</span>
                      ) : t.is_free ? (
                        <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full font-bold text-[10px]">
                          Vouched Free Claim
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-full font-bold text-[10px]">
                          Personal Cash Payment
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-black text-zinc-900 text-sm">
                      {t.status === "cancelled" ? (
                        <span className="line-through text-zinc-400">₱{Number(t.meal_amount).toFixed(2)}</span>
                      ) : t.is_free ? (
                        <span className="text-emerald-700">₱0.00</span>
                      ) : (
                        <span>₱{Number(t.meal_amount).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {t.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Processed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                          Voided Record
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
