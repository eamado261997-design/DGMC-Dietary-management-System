import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Department } from "../../types.js";
import { Printer, FileDown, Calendar, Search, Filter, RefreshCw, BarChart, GraduationCap, DollarSign, HeartHandshake, ShieldAlert, Activity } from "lucide-react";
import { Skeleton } from "../../components/Skeleton.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import PrintableHeader from "../../components/PrintableHeader.js";

export default function AdminReports() {
  const { apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"meals" | "employees" | "financial" | "api-performance">("meals");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Meal Logs
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFree, setIsFree] = useState("");
  const [deptId, setDeptId] = useState("");

  // Datasets
  const [mealLogs, setMealLogs] = useState<any[]>([]);
  const [employeeSummaries, setEmployeeSummaries] = useState<any[]>([]);
  const [financialSummaries, setFinancialSummaries] = useState<any[]>([]);
  const [perfData, setPerfData] = useState<any>(null);

  // Search filter for EmployeesTab
  const [empSearch, setEmpSearch] = useState("");
  const debouncedEmpSearch = useDebounce(empSearch, 300);

  const loadFilterConfigs = async () => {
    try {
      const depts = await apiFetch("/api/departments");
      setDepartments(depts);
    } catch (_e) {
      // Suppress error in production
    }
  };

  const fetchMealsReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append("startDate", startDate);
      if (endDate) query.append("endDate", endDate);
      if (isFree) query.append("isFree", isFree);
      if (deptId) query.append("departmentId", deptId);

      const list = await apiFetch(`/api/admin/reports/meals?${query.toString()}`);
      setMealLogs(list);
    } catch (_err) {
      // Suppress error in production
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeesReport = async () => {
    setLoading(true);
    try {
      const list = await apiFetch("/api/admin/reports/employees");
      setEmployeeSummaries(list);
    } catch (_err) {
      // Suppress error in production
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialReport = async () => {
    setLoading(true);
    try {
      const list = await apiFetch("/api/admin/reports/financial");
      setFinancialSummaries(list);
    } catch (_err) {
      // Suppress error in production
    } finally {
      setLoading(false);
    }
  };

  const fetchPerfReport = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/sys-perf");
      setPerfData(data);
    } catch (_err) {
      // Suppress error in production
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterConfigs();
    const today = new Date();
    const lastMonth = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days window
    setStartDate(lastMonth.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (activeTab === "meals") {
      fetchMealsReport();
    } else if (activeTab === "employees") {
      fetchEmployeesReport();
    } else if (activeTab === "financial") {
      fetchFinancialReport();
    } else if (activeTab === "api-performance") {
      fetchPerfReport();
    }
  }, [activeTab, startDate, endDate, isFree, deptId]);

  const handleExport = async (type: string) => {
    if (type === "api-performance") {
      if (!perfData || !perfData.routeAggregates) {
        alert("No performance data available to export.");
        return;
      }
      const headers = ["Route", "Method", "Count", "Avg (ms)", "P50 (ms)", "P95 (ms)", "P99 (ms)", "Max (ms)", "Errors", "Critical"];
      const rows = perfData.routeAggregates.map((r: any) => [
        `"${r.path}"`,
        r.method,
        r.count,
        r.avgLatencyMs,
        r.p50Ms,
        r.p95Ms,
        r.p99Ms,
        r.maxLatencyMs,
        r.errorCount,
        r.isCritical ? "Yes" : "No"
      ]);
      const csvContent = [headers.join(","), ...rows.map((row: any[]) => row.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `dgmc_api_performance_percentiles_${new Date().toISOString().split("T")[0]}.csv`);
      link.click();
      return;
    }

    try {
      let url = `/api/admin/reports/export/${type}`;
      if (type === "meals") {
        const query = new URLSearchParams();
        if (startDate) query.append("startDate", startDate);
        if (endDate) query.append("endDate", endDate);
        if (isFree) query.append("isFree", isFree);
        if (deptId) query.append("departmentId", deptId);
        url += `?${query.toString()}`;
      }
      const data = await apiFetch(url);
      if (data && data.csv) {
        // Triggers browser download directly with UTF-8 BOM for perfect Excel formatting
        const blob = new Blob(["\uFEFF" + data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dgmc_cafeteria_${type}_report_${new Date().toISOString().split("T")[0]}.csv`);
        link.click();
      }
    } catch (err) {
      alert("Export failed: " + err);
    }
  };

  const filteredEmpSummaries = employeeSummaries.filter(emp =>
    emp.name.toLowerCase().includes(debouncedEmpSearch.toLowerCase()) ||
    (emp.employee_no && emp.employee_no.toLowerCase().includes(debouncedEmpSearch.toLowerCase()))
  );

  const getCafeteriaStats = () => {
    if (activeTab === "meals") {
      const total = mealLogs.length;
      const completed = mealLogs.filter(log => log.status === "completed");
      const free = completed.filter(log => log.is_free).length;
      const paid = completed.filter(log => !log.is_free).length;
      const revenue = completed.reduce((sum, log) => sum + Number(log.meal_amount || 0), 0);
      return {
        title: "Current Meal Transactions Summary",
        metrics: [
          { label: "Total Transactions", value: `${total} logs`, color: "text-zinc-900" },
          { label: "Free Allocations", value: `${free} meals`, color: "text-emerald-700" },
          { label: "Paid Purchases", value: `${paid} meals`, color: "text-teal-850" },
          { label: "Total Revenue Generated", value: `₱${revenue.toFixed(2)}`, color: "text-zinc-950 font-black" }
        ]
      };
    } else if (activeTab === "employees") {
      const total = filteredEmpSummaries.length;
      const activeEmps = filteredEmpSummaries.filter(e => e.is_active).length;
      const freeClaimed = filteredEmpSummaries.reduce((sum, e) => sum + (e.freeMealsClaimed || 0), 0);
      const paidPurchased = filteredEmpSummaries.reduce((sum, e) => sum + (e.paidMealsPurchased || 0), 0);
      const totalSpent = filteredEmpSummaries.reduce((sum, e) => sum + Number(e.totalPaidAmount || 0), 0);
      return {
        title: "Employee Meal Redemption Summary",
        metrics: [
          { label: "Roster Size", value: `${total} staff`, color: "text-zinc-900" },
          { label: "Active Employees", value: `${activeEmps} active`, color: "text-emerald-700" },
          { label: "Free Claims", value: `${freeClaimed} meals`, color: "text-teal-850" },
          { label: "Paid Purchases", value: `${paidPurchased} meals`, color: "text-zinc-700" },
          { label: "Total Employee Spent", value: `₱${totalSpent.toFixed(2)}`, color: "text-zinc-950 font-black" }
        ]
      };
    } else if (activeTab === "financial") {
      const days = financialSummaries.length;
      const free = financialSummaries.reduce((sum, f) => sum + (f.freeCount || 0), 0);
      const paid = financialSummaries.reduce((sum, f) => sum + (f.paidCount || 0), 0);
      const totalRevenue = financialSummaries.reduce((sum, f) => sum + Number(f.totalPaidAmount || 0), 0);
      return {
        title: "Cafeteria Earnings Aggregate Summary",
        metrics: [
          { label: "Operating Days", value: `${days} days`, color: "text-zinc-900" },
          { label: "Total Free Distributed", value: `${free} meals`, color: "text-emerald-700" },
          { label: "Total Paid Sold", value: `${paid} meals`, color: "text-teal-850" },
          { label: "Cumulative Cafeteria Revenue", value: `₱${totalRevenue.toFixed(2)}`, color: "text-zinc-950 font-black" }
        ]
      };
    } else if (activeTab === "api-performance") {
      const totalRoutes = perfData?.routeAggregates?.length || 0;
      const totalReqs = perfData?.totalRequests || 0;
      const avgLatency = perfData?.avgLatencyMs || 0;
      const p95 = perfData?.p95Ms || 0;
      const p99 = perfData?.p99Ms || 0;
      return {
        title: "API Performance & Latency Summary",
        metrics: [
          { label: "Tracked Routes", value: `${totalRoutes} routes`, color: "text-zinc-900" },
          { label: "Total Requests", value: `${totalReqs} calls`, color: "text-emerald-700" },
          { label: "Avg Latency", value: `${avgLatency} ms`, color: "text-teal-850" },
          { label: "P95 Latency", value: `${p95} ms`, color: "text-amber-700" },
          { label: "P99 Latency", value: `${p99} ms`, color: "text-rose-700" }
        ]
      };
    }
    return null;
  };

  return (
    <div id="admin-reports-page">
      <PrintableHeader 
        title={
          activeTab === "meals" ? "Meal Transactions Ledger Report" :
          activeTab === "employees" ? "Redeemed Employee Summaries Report" :
          activeTab === "financial" ? "Cafeteria Earnings Log Audit" :
          "API Latency & P95/P99 Percentiles Report"
        }
        meta={[
          { label: "Date Generated", value: new Date().toLocaleString() },
          { label: "Scope Parameter", value: (
            activeTab === "meals" ? `Transactions Logged (${startDate || "All"} to ${endDate || "All"})` :
            activeTab === "employees" ? "Active/Disabled Employee Summaries" :
            activeTab === "financial" ? "Cafeteria Earnings Aggregate" :
            "Critical Routes Response Time Percentiles Telemetry"
          )}
        ]}
      />

      {/* Dedicated Executive Summary for Cafeteria Statistics */}
      {getCafeteriaStats() && (
        <div className="mb-6 bg-zinc-50 border border-zinc-250 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider font-mono">
              {getCafeteriaStats()?.title}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono no-print">
              Live Query Diagnostics
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {getCafeteriaStats()?.metrics.map((metric, idx) => (
              <div key={idx} className="bg-white px-4 py-3 rounded-xl border border-zinc-200 shadow-xs">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">
                  {metric.label}
                </span>
                <span className={`text-sm sm:text-base font-mono font-bold ${metric.color}`}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="no-print">
        <PageHeader
          title="Operations Auditing & Reports"
          subtitle="Produce statistical breakdowns, filter records, and export official CSV tables"
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="h-10 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold px-4 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Report
              </button>
              <button
                onClick={() => handleExport(activeTab)}
                className="h-10 bg-zinc-800 hover:bg-zinc-900 border border-zinc-200 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                Export to Excel
              </button>
            </div>
          }
        />
      </div>

      {/* Reports navigation Tab headers */}
      <div className="flex border-b border-zinc-200 mb-6 gap-2 overflow-x-auto whitespace-nowrap scrollbar-none no-print">
        <button
          onClick={() => setActiveTab("meals")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
            activeTab === "meals" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          Meal Transactions Ledger
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
            activeTab === "employees" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          Redeemed Employee Summaries
        </button>
        <button
          onClick={() => setActiveTab("financial")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
            activeTab === "financial" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          Cafeteria Earnings Log
        </button>
        <button
          onClick={() => setActiveTab("api-performance")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "api-performance" ? "border-teal-700 text-teal-850 font-extrabold bg-teal-50/20" : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          API Latency &amp; P95/P99
        </button>
      </div>

      {/* Filters Module block */}
      {activeTab === "meals" && (
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 mb-6 space-y-4 no-print">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
            <Filter className="w-4 h-4 text-teal-700" />
            <span>Refine Ledger Query</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider">Allocation Type</label>
              <select
                value={isFree}
                onChange={(e) => setIsFree(e.target.value)}
                className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none text-zinc-600 font-bold"
              >
                <option value="">All Transactions</option>
                <option value="true">Free Redemptions Only</option>
                <option value="false">Paid Cash Redemptions Only</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider">Target Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none text-zinc-600 font-bold"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === "employees" && (
        <div className="bg-white border border-zinc-200 rounded-3xl p-4 mb-6 flex items-center justify-between no-print">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search summary roster..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-700 outline-none"
            />
          </div>
          <button
            onClick={() => handleExport("employees")}
            className="h-10 bg-zinc-800 hover:bg-zinc-900 border border-zinc-200 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export Staff Summaries
          </button>
        </div>
      )}

      {activeTab === "financial" && (
        <div className="bg-white border border-zinc-200 rounded-3xl p-4 mb-6 flex items-center justify-between no-print">
          <span className="text-xs text-zinc-550 italic">Full comprehensive cafeteria receipts aggregate</span>
          <button
            onClick={() => handleExport("financial")}
            className="h-10 bg-zinc-800 hover:bg-zinc-900 border border-zinc-200 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export Ledger Performance
          </button>
        </div>
      )}

      {/* Export Button for meals ledger is placed directly beside header in the meals panel */}
      {activeTab === "meals" && (
        <div className="flex items-center justify-between mb-4 no-print">
          <span className="text-xs text-zinc-550">
            Discovered <span className="font-extrabold text-teal-850">{mealLogs.length}</span> transaction receipts complying with parameters.
          </span>
          <button
            onClick={() => handleExport("meals")}
            className="h-9 bg-zinc-800 hover:bg-zinc-900 border border-zinc-200 text-white rounded-xl text-xs font-bold px-3.5 flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export Selected Logs (CSV)
          </button>
        </div>
      )}

      {/* Report Data display Container */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    {activeTab === "meals" && [...Array(8)].map((_, j) => <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>)}
                    {activeTab === "employees" && [...Array(7)].map((_, j) => <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>)}
                    {activeTab === "financial" && [...Array(4)].map((_, j) => <td key={j} className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            {activeTab === "meals" && (
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                    <th className="px-6 py-4">Receipt ID</th>
                    <th className="px-6 py-4">Meal Date/Time</th>
                    <th className="px-6 py-4">Staff Member</th>
                    <th className="px-6 py-4">Division</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Charged</th>
                    <th className="px-6 py-4">Transaction Cashier</th>
                    <th className="px-6 py-4">Receipt Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                  {mealLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        No transactions registered matching current settings
                      </td>
                    </tr>
                  ) : (
                    mealLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-zinc-400"># {log.id}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-zinc-850 block">{log.meal_date}</span>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">{log.meal_time}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-zinc-900 block">{log.employee_name}</span>
                          <span className="text-[10px] text-zinc-500 block font-mono">No. {log.employee_no}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-800">{log.department_name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              log.is_free
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-teal-50 text-teal-800 border-teal-200"
                            }`}
                          >
                            {log.is_free ? "FREE ALLOCATION" : "PAID DINNER"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-extrabold text-zinc-900">
                          ₱{Number(log.meal_amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 font-bold">{log.cashier_name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              log.status === "completed"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                                : "bg-rose-50 text-rose-800 border-rose-150"
                            }`}
                          >
                            {log.status === "completed" ? "Completed" : "Cancelled"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "employees" && (
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                    <th className="px-6 py-4">Employee ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Department / Position</th>
                    <th className="px-6 py-4">Vouchers Claimed</th>
                    <th className="px-6 py-4">Meals Paid</th>
                    <th className="px-6 py-4">Total Money Spent</th>
                    <th className="px-6 py-4">Registry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                  {filteredEmpSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        No employees summaries discovered
                      </td>
                    </tr>
                  ) : (
                    filteredEmpSummaries.map((emp, idx) => {
                      const isActive = emp.is_active === 1 || emp.is_active === true || emp.is_active === "1";
                      return (
                        <tr key={emp.employee_no || idx} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-zinc-800">{emp.employee_no || "N/A"}</td>
                          <td className="px-6 py-4 font-bold text-zinc-950">{emp.name}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-zinc-850 block">{emp.department_name}</span>
                            <span className="text-[10px] text-zinc-400 block">{emp.position}</span>
                          </td>
                          <td className="px-6 py-4 font-mono font-extrabold text-emerald-700">
                            {emp.freeMealsClaimed || 0} claims
                          </td>
                          <td className="px-6 py-4 font-mono font-extrabold text-teal-800">
                            {emp.paidMealsPurchased || 0} paid
                          </td>
                          <td className="px-6 py-4 font-mono font-black text-zinc-900">
                            ₱{Number(emp.totalPaidAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                isActive ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "financial" && (
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                    <th className="px-6 py-4">Roster Date</th>
                    <th className="px-6 py-4">Free Vouchers Distributed</th>
                    <th className="px-6 py-4">Paid Cash Vouchers sold</th>
                    <th className="px-6 py-4">Total Amount Generated (Pesos)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                  {financialSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        No financial audits recorded.
                      </td>
                    </tr>
                  ) : (
                    financialSummaries.map((fin) => (
                      <tr key={fin.date} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-teal-900">{fin.date}</td>
                        <td className="px-6 py-4 font-bold text-emerald-700 font-mono">{fin.freeCount} meals distributed</td>
                        <td className="px-6 py-4 font-bold text-teal-700 font-mono">{fin.paidCount} meals purchased</td>
                        <td className="px-6 py-4 font-mono font-black text-zinc-950 text-sm">
                          ₱{Number(fin.totalPaidAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "api-performance" && (
              <div>
                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-6 bg-zinc-50 border-b border-zinc-200">
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Requests</span>
                    <span className="text-lg font-mono font-black text-zinc-900">{perfData?.totalRequests || 0}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Avg Latency</span>
                    <span className="text-lg font-mono font-black text-teal-800">{perfData?.avgLatencyMs || 0} ms</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">P50 Latency</span>
                    <span className="text-lg font-mono font-black text-emerald-700">{perfData?.p50Ms || 0} ms</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">P95 Percentile</span>
                    <span className="text-lg font-mono font-black text-amber-700">{perfData?.p95Ms || 0} ms</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">P99 Percentile</span>
                    <span className="text-lg font-mono font-black text-rose-700">{perfData?.p99Ms || 0} ms</span>
                  </div>
                </div>

                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                      <th className="px-6 py-4">Endpoint Route</th>
                      <th className="px-6 py-4">Method</th>
                      <th className="px-6 py-4">Requests</th>
                      <th className="px-6 py-4">Avg Latency</th>
                      <th className="px-6 py-4">P50</th>
                      <th className="px-6 py-4">P95 Percentile</th>
                      <th className="px-6 py-4">P99 Percentile</th>
                      <th className="px-6 py-4">Max</th>
                      <th className="px-6 py-4">Errors</th>
                      <th className="px-6 py-4">Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                    {!perfData?.routeAggregates || perfData.routeAggregates.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-zinc-400 font-bold">
                          No API benchmark telemetry recorded yet. Trigger requests to populate.
                        </td>
                      </tr>
                    ) : (
                      perfData.routeAggregates.map((row: any) => (
                        <tr key={row.route} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-zinc-950">{row.path}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              row.method === "GET" ? "bg-sky-50 text-sky-700 border border-sky-200" :
                              row.method === "POST" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}>
                              {row.method}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold">{row.count}</td>
                          <td className="px-6 py-4 font-mono text-zinc-700">{row.avgLatencyMs} ms</td>
                          <td className="px-6 py-4 font-mono font-semibold text-zinc-800">{row.p50Ms} ms</td>
                          <td className="px-6 py-4 font-mono font-bold text-amber-700 bg-amber-50/30">{row.p95Ms} ms</td>
                          <td className="px-6 py-4 font-mono font-extrabold text-rose-700 bg-rose-50/30">{row.p99Ms} ms</td>
                          <td className="px-6 py-4 font-mono text-zinc-500">{row.maxLatencyMs} ms</td>
                          <td className="px-6 py-4 font-mono font-bold text-rose-600">{row.errorCount}</td>
                          <td className="px-6 py-4">
                            {row.isCritical ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                Critical Route
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600">
                                Standard API
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
