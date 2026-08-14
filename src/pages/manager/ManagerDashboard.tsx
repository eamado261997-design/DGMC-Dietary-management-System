import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Skeleton } from "../../components/Skeleton.js";
import MealConsumptionChart from "../../components/MealConsumptionChart.js";
import { Department, Person, EmployeeSchedule } from "../../types.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { 
  Building, 
  Users, 
  Calendar, 
  Utensils, 
  Heart, 
  Sun, 
  Moon, 
  Search, 
  CalendarDays, 
  Filter,
  Eye,
  Info
} from "lucide-react";

interface ManagerStatsType {
  departmentStaffCount: number;
  scheduledToday: number;
  consumedToday: number;
  freeMealsClaimed: number;
}

export default function ManagerDashboard({ onViewChange }: { onViewChange: (v: string) => void }) {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState<ManagerStatsType | null>(null);
  const [dept, setDept] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Person[]>([]);
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Read-only roster period configuration states (15-day cycle: 26 to 10 and 11 to 25)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedPeriod, setSelectedPeriod] = useState<"26_10" | "11_25">(() => {
    const day = new Date().getDate();
    return (day >= 11 && day <= 25) ? "11_25" : "26_10";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/manager/stats"),
      apiFetch("/api/manager/department"),
      apiFetch("/api/manager/employees"),
      apiFetch("/api/manager/employee-schedules")
    ])
      .then(([statsData, deptData, employeesList, schedulesList]) => {
        setStats(statsData);
        setDept(deptData);
        setEmployees(employeesList || []);

        // Normalize dates to YYYY-MM-DD format (resolving timezone and ISO format differences)
        const normalizedSchedules = (schedulesList || []).map((s: any) => ({
          ...s,
          work_date: s.work_date ? s.work_date.substring(0, 10) : ""
        }));
        setSchedules(normalizedSchedules);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const calculateDates = (year: number, month: number, period: "26_10" | "11_25") => {
    const list = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    if (period === "11_25") {
      // 11th to 25th of the selected month
      for (let day = 11; day <= 25; day++) {
        const dt = new Date(year, month, day, 12, 0, 0);
        const iso = dt.toISOString().split("T")[0];
        const dayName = days[dt.getDay()];
        const shortDate = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        list.push({ iso, dayName, shortDate });
      }
    } else {
      // 26th of previous month to 10th of selected month
      let prevYear = year;
      let prevMonth = month - 1;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      
      const startDt = new Date(prevYear, prevMonth, 26, 12, 0, 0);
      const endDt = new Date(year, month, 10, 12, 0, 0);
      
      const current = new Date(startDt);
      while (current <= endDt) {
        const iso = current.toISOString().split("T")[0];
        const dayName = days[current.getDay()];
        const shortDate = current.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        list.push({ iso, dayName, shortDate });
        current.setDate(current.getDate() + 1);
      }
    }
    return list;
  };

  const dates = calculateDates(selectedYear, selectedMonth, selectedPeriod);

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const query = debouncedSearchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      (emp.employee_no && emp.employee_no.toLowerCase().includes(query)) ||
      (emp.position && emp.position.toLowerCase().includes(query))
    );
  });

  const getShiftForEmployeeAndDate = (personId: number, dateIso: string) => {
    return schedules.find((s) => s.person_id === personId && s.work_date === dateIso);
  };

  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const years = [2025, 2026, 2027];

  return (
    <div id="manager-dashboard-page">
      <PageHeader
        title="Managerial Dashboard"
        subtitle={loading ? "Roster Management & Cafeteria eligibility for your division" : `Roster Management & Cafeteria eligibility for ${dept ? dept.name : "department"}`}
      />

      <div className="space-y-8">
        
        {/* Department Welcomer Banner */}
        <div id="dept-welcome-banner" className="bg-gradient-to-r from-teal-800 to-teal-950 rounded-3xl p-6 md:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between border border-teal-700/20 shadow-md">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-teal-300 font-bold uppercase bg-teal-950/50 border border-teal-800 px-2.5 py-0.5 rounded-full">
              Division Lead Terminal
            </span>
            <h2 className="text-xl font-extrabold tracking-tight text-white mt-2">
              {loading ? (
                <Skeleton className="h-6 w-48 bg-teal-750/30" />
              ) : (
                `Managing: ${dept ? dept.name : "Department Division"}`
              )}
            </h2>
            <p className="text-xs text-teal-200/80 mt-1 max-w-xl">
              As Department Supervisor, you are authorized to establish work shifts, manage scheduled rosters, track personnel counts, and review meal logs for employees belonging exclusively to your unit.
            </p>
          </div>
          <div id="department-id-badge" className="mt-4 md:mt-0 bg-white/10 border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shrink-0">
            <Building className="w-5 h-5 text-teal-300" />
            <div className="text-left">
              <span className="text-[10px] text-teal-200 uppercase block font-semibold">Hospital Division ID</span>
              {loading ? (
                <Skeleton className="h-4 w-16 bg-teal-750/30" />
              ) : (
                <span className="text-xs font-mono font-bold text-white">DEPT-00{dept?.id}</span>
              )}
            </div>
          </div>
        </div>

        {/* Manager Stats Grid */}
        <div id="manager-stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <button
            id="btn-nav-employees"
            onClick={() => onViewChange("manager-employees")}
            className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4 text-left outline-none hover:border-teal-550 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Assigned Staff</span>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.departmentStaffCount}</span>
              )}
              <span className="text-[10px] text-zinc-550 block mt-0.5">Manage details</span>
            </div>
          </button>

            <button
              id="btn-nav-schedule"
              onClick={() => onViewChange("manager-schedule")}
              className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4 text-left outline-none hover:border-teal-550 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Rostered Today</span>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.scheduledToday}</span>
              )}
              <span className="text-[10px] text-zinc-550 block mt-0.5">Staff scheduled on work</span>
            </div>
          </button>

          <div id="stat-vouchers" className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Vouchers Redeemed</span>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.freeMealsClaimed}</span>
              )}
              <span className="text-[10px] text-zinc-550 block mt-0.5">Valid free employee lunches</span>
            </div>
          </div>

          <div id="stat-meals" className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">Meals Consumed Today</span>
              {loading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <span className="text-2xl font-black text-zinc-900 leading-tight block">{stats?.consumedToday}</span>
              )}
              <span className="text-[10px] text-zinc-550 block mt-0.5">From scheduled staff</span>
            </div>
          </div>

        </div>

        {/* Consumption Chart Widget */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Meal Consumption Progress</h3>
          {loading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <MealConsumptionChart consumed={stats?.consumedToday || 0} scheduled={stats?.scheduledToday || 0} />
          )}
        </div>

          {/* Read Only Employees 15-Day Roster Grid */}
          <div id="dashboard-readonly-roster-section" className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-150 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-teal-50 text-teal-850">
                    <CalendarDays className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-zinc-900">Read-Only Employee Roster</h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  A comprehensive bimonthly view of shifts and schedules for authorized personnel in your division.
                </p>
              </div>

              {/* Roster Controls Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Year Select */}
                <select
                  id="roster-year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="px-2.5 py-1.5 border border-zinc-205 rounded-xl bg-zinc-50 text-[11px] font-bold text-zinc-700 outline-none focus:border-teal-600 focus:bg-white"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {/* Month Select */}
                <select
                  id="roster-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="px-2.5 py-1.5 border border-zinc-205 rounded-xl bg-zinc-50 text-[11px] font-bold text-zinc-700 outline-none focus:border-teal-600 focus:bg-white"
                >
                  {months.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>

                {/* Period Selector Tabs */}
                <div id="roster-period-tabs" className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  <button
                    id="btn-period-26-10"
                    onClick={() => setSelectedPeriod("26_10")}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                      selectedPeriod === "26_10"
                        ? "bg-teal-850 text-white shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    26 to 10
                  </button>
                  <button
                    id="btn-period-11-25"
                    onClick={() => setSelectedPeriod("11_25")}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all`}
                  >
                    11 to 25
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Search and Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="roster-search-input"
                  type="text"
                  placeholder="Search staff name or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 hover:bg-zinc-100/50 border border-zinc-200 focus:border-teal-600 focus:bg-white rounded-xl text-xs outline-none transition-all placeholder:text-zinc-400 font-medium"
                />
              </div>

              {/* Legend Box */}
              <div id="roster-grid-legend" className="flex flex-wrap items-center gap-3.5 text-[10px] font-bold text-zinc-500 font-mono bg-zinc-50/50 border border-zinc-150 px-3.5 py-1.5 rounded-xl">
                <span className="text-zinc-400 uppercase tracking-widest text-[9px] mr-1">Shifts Key:</span>
                <span className="flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-50" /> Dayshift (11am-2pm)
                </span>
                <span className="flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-indigo-500 fill-indigo-50" /> Nightshift (10pm-6am)
                </span>
                <span className="flex items-center gap-1.5 grayscale-50">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-300"></span> Off Duty (Not Scheduled)
                </span>
              </div>
            </div>

            {/* Roster Calendar Table */}
            <div id="table-roster-scroller" className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-8 space-y-4">
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : (
                  <table id="readonly-roster-grid-table" className="w-full border-collapse text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200">
                      <th className="p-3 text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase min-w-[170px] sticky left-0 bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        Employee Details
                      </th>
                      {dates.map((d) => (
                        <th key={d.iso} className="p-2.5 text-center text-[10px] font-mono leading-tight border-r border-zinc-150 last:border-r-0 min-w-[44px]">
                          <span className="block text-zinc-400 font-semibold">{d.dayName}</span>
                          <span className="block font-black text-zinc-90 w-full mt-0.5">{d.iso.split("-")[2]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={dates.length + 1} className="py-12 text-center text-xs text-zinc-400 font-semibold font-sans">
                          No matching personnel found in {dept ? dept.name : "this department"}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <tr key={emp.id} className="border-b last:border-0 border-zinc-150 hover:bg-zinc-50/40 transition-colors">
                          {/* Name sticky column */}
                          <td className="p-3 sticky left-0 bg-white z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <span className="block font-bold text-xs text-zinc-900">
                              {emp.first_name} {emp.last_name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-zinc-405 font-medium leading-none">
                                {emp.employee_no || "N/A"}
                              </span>
                              {emp.position && (
                                <>
                                  <span className="text-zinc-300 text-[10px]">•</span>
                                  <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded-md leading-none">
                                    {emp.position}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Roster grid values */}
                          {dates.map((d) => {
                            const shift = getShiftForEmployeeAndDate(emp.id, d.iso);
                            return (
                              <td key={d.iso} className="p-2 text-center border-r border-zinc-150 last:border-r-0">
                                <div className="flex justify-center items-center h-8">
                                  {shift ? (
                                    shift.shift_type === "day" ? (
                                      <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-750 hover:scale-105 transition-transform" title={`${emp.first_name} is rostered: Day Shift on ${d.iso}`}>
                                        <Sun className="w-3.5 h-3.5" />
                                        <span className="text-[8px] font-bold font-mono uppercase mt-0.5 px-0.5 bg-amber-200/30 rounded-xs">Day</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-750 hover:scale-105 transition-transform" title={`${emp.first_name} is rostered: Night Shift on ${d.iso}`}>
                                        <Moon className="w-3.5 h-3.5" />
                                        <span className="text-[8px] font-bold font-mono uppercase mt-0.5 px-0.5 bg-indigo-200/30 rounded-xs">Night</span>
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-zinc-300 font-semibold text-xs font-mono" title={`${emp.first_name} is off-duty on ${d.iso}`}>—</span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                )}
              </div>
            </div>
          </div>

          {/* Quick Schedule Management Helper Card */}
          <div id="quick-schedule-notice-card" className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-50 text-teal-850">
                  <Info className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-zinc-900">Configure or Change Schedules?</h3>
              </div>
              <p className="text-xs text-zinc-550 mt-1.5 leading-relaxed">
                Remember, free of charge cafeteria meal benefits are tightly bound to rostered schedules. An employee MUST be rostered on a specific date in order to pass cafeteria scanner eligibility verification. Shift edits are restricted to future or current dates only.
              </p>
            </div>
            <button
              id="btn-navigate-configure-schedules"
              onClick={() => onViewChange("manager-schedule")}
              className="h-10 bg-teal-850 hover:bg-teal-900 text-white rounded-xl text-xs font-black px-5 transition-colors shrink-0 flex items-center gap-2 shadow-xs"
            >
              <Eye className="w-4 h-4" /> Go to Schedule Manager
            </button>
          </div>

        </div>
      </div>
  );
}
