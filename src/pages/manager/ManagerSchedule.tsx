import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Person, EmployeeSchedule } from "../../types.js";
import { Calendar, Save, Sun, Moon, ToggleLeft, RefreshCw, Lock, AlertCircle, Sparkles } from "lucide-react";

interface ScheduleMap {
  [key: string]: "day" | "night" | "off"; // key format: personId_YYYY-MM-DD
}

export default function ManagerSchedule() {
  const { apiFetch } = useAuth();
  
  const [employees, setEmployees] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Grid dates list (today and next 6 days)
  const [dates, setDates] = useState<{ iso: string; dayName: string; shortDate: string }[]>([]);

  // Selected bimonthly periods configuration states
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedPeriod, setSelectedPeriod] = useState<"26_10" | "11_25">(() => {
    const day = new Date().getDate();
    return (day >= 11 && day <= 25) ? "11_25" : "26_10";
  });

  // Current true schedules in database
  const [realSchedules, setRealSchedules] = useState<EmployeeSchedule[]>([]);

  // Local draft changes: map of personId_workDate -> shiftType
  const [draftMap, setDraftMap] = useState<ScheduleMap>({});
  const [saving, setSaving] = useState(false);

  const calculateDates = () => {
    const list = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    if (selectedPeriod === "11_25") {
      // 11th to 25th of the selected month
      for (let day = 11; day <= 25; day++) {
        const dt = new Date(selectedYear, selectedMonth, day, 12, 0, 0);
        const iso = dt.toISOString().split("T")[0];
        const dayName = days[dt.getDay()];
        const shortDate = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        list.push({ iso, dayName, shortDate });
      }
    } else {
      // 26th of previous month to 10th of selected month
      let prevYear = selectedYear;
      let prevMonth = selectedMonth - 1;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      
      const startDt = new Date(prevYear, prevMonth, 26, 12, 0, 0);
      const endDt = new Date(selectedYear, selectedMonth, 10, 12, 0, 0);
      
      const current = new Date(startDt);
      while (current <= endDt) {
        const iso = current.toISOString().split("T")[0];
        const dayName = days[current.getDay()];
        const shortDate = current.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        list.push({ iso, dayName, shortDate });
        current.setDate(current.getDate() + 1);
      }
    }
    setDates(list);
  };

  const loadScheduleGrid = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const staffList = await apiFetch("/api/manager/employees");
      const schedList = await apiFetch("/api/manager/employee-schedules");
      
      // Normalize dates to YYYY-MM-DD format (resolving timezone and ISO format differences)
      const normalizedSchedules = (schedList || []).map((s: any) => ({
        ...s,
        work_date: s.work_date ? s.work_date.substring(0, 10) : ""
      }));

      setEmployees(staffList);
      setRealSchedules(normalizedSchedules);
      
      // Initialize draft map with existing values
      const initialMap: ScheduleMap = {};
      staffList.forEach((e: Person) => {
        normalizedSchedules.forEach((s: EmployeeSchedule) => {
          if (s.person_id === e.id) {
            initialMap[`${e.id}_${s.work_date}`] = s.shift_type;
          }
        });
      });
      setDraftMap(initialMap);
    } catch (err: any) {
      setError(err.message || "Failed to load schedules grid");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateDates();
  }, [selectedYear, selectedMonth, selectedPeriod]);

  useEffect(() => {
    loadScheduleGrid();
  }, []);

  const handleCellToggle = (personId: number, dateIso: string) => {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // Past date lock validation
    if (dateIso < todayStr) {
      setError("Schedule Lockout: You are forbidden from modifying historical rostering dates.");
      return;
    }

    const key = `${personId}_${dateIso}`;
    const curr = draftMap[key] || "off";
    let next: "day" | "night" | "off" = "off";

    if (curr === "off") {
      next = "day";
    } else if (curr === "day") {
      next = "night";
    } else {
      next = "off";
    }

    setDraftMap((prev) => ({
      ...prev,
      [key]: next,
    }));
    setSuccess(null);
    setError(null);
  };

  const checkHasChanges = (): boolean => {
    // Compare draftMap to realSchedules List
    let changed = false;
    employees.forEach((p) => {
      dates.forEach((d) => {
        const key = `${p.id}_${d.iso}`;
        const draftVal = draftMap[key] || "off";
        
        const matchingReal = realSchedules.find((s) => s.person_id === p.id && s.work_date === d.iso);
        const realVal = matchingReal ? matchingReal.shift_type : "off";
        
        if (draftVal !== realVal) {
          changed = true;
        }
      });
    });
    return changed;
  };

  const getChangedCount = (): number => {
    let count = 0;
    employees.forEach((p) => {
      dates.forEach((d) => {
        const key = `${p.id}_${d.iso}`;
        const draftVal = draftMap[key] || "off";
        const matchingReal = realSchedules.find((s) => s.person_id === p.id && s.work_date === d.iso);
        const realVal = matchingReal ? matchingReal.shift_type : "off";
        if (draftVal !== realVal) count++;
      });
    });
    return count;
  };

  const handleCommitBatch = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    const compiledUpdates = [];
    const todayStr = new Date().toISOString().split("T")[0];

    for (const p of employees) {
      for (const d of dates) {
        if (d.iso < todayStr) continue; // Skip historical locks

        const key = `${p.id}_${d.iso}`;
        const draftVal = draftMap[key] || "off";
        
        const matchingReal = realSchedules.find((s) => s.person_id === p.id && s.work_date === d.iso);
        const realVal = matchingReal ? matchingReal.shift_type : "off";

        if (draftVal !== realVal) {
          compiledUpdates.push({
            person_id: p.id,
            work_date: d.iso,
            shift_type: draftVal === "off" ? undefined : draftVal,
            action: draftVal === "off" ? "remove" : "add",
          });
        }
      }
    }

    if (compiledUpdates.length === 0) {
      setSaving(false);
      return;
    }

    try {
      await apiFetch("/api/manager/batch-schedules", {
        method: "POST",
        body: JSON.stringify({ updates: compiledUpdates }),
      });
      setSuccess(`Transaction Successful. Committed ${compiledUpdates.length} shift updates to Database.`) ;
      loadScheduleGrid();
    } catch (err: any) {
      setError(err.message || "Failed to commit shift adjustments.");
    } finally {
      setSaving(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const hasChanges = checkHasChanges();
  const changedCount = getChangedCount();

  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const years = [2025, 2026, 2027];

  return (
    <div id="manager-schedule-page">
      <PageHeader
        title="Schedule Management"
        subtitle="Schedule work days, shifts types, and verify free meal benefits eligibility"
        actions={
          <button
            onClick={loadScheduleGrid}
            className="p-2 border border-zinc-205 rounded-xl hover:bg-zinc-100 transition-colors"
            title="Refresh Schedules"
          >
            <RefreshCw className="w-4 h-4 text-zinc-500" />
          </button>
        }
      />

      {/* 15-Day Cycle Period Selector */}
      <div id="cycle-period-selector" className="bg-white border border-zinc-200 rounded-3xl p-4 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-550 text-xs font-bold leading-none uppercase tracking-wider font-mono">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-zinc-205 rounded-xl bg-zinc-50 text-xs font-bold font-sans text-zinc-800 outline-none focus:border-teal-600 focus:bg-white"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-550 text-xs font-bold leading-none uppercase tracking-wider font-mono">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-zinc-205 rounded-xl bg-zinc-50 text-xs font-bold font-sans text-zinc-800 outline-none focus:border-teal-600 focus:bg-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-100/70 p-1 rounded-2xl border border-zinc-200">
          <button
            onClick={() => setSelectedPeriod("26_10")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              selectedPeriod === "26_10"
                ? "bg-teal-850 text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            📆 26th to 10th
          </button>
          <button
            onClick={() => setSelectedPeriod("11_25")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all relative ${
              selectedPeriod === "11_25"
                ? "bg-teal-850 text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            📆 11th to 25th
          </button>
        </div>
      </div>

      {/* Database alerts indicators */}
      {error && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-250 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 animate-bounce" />
          <span>{success}</span>
        </div>
      )}

      {/* Transaction Control Banner */}
      {hasChanges && (
        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs select-none animate-pulse">
              {changedCount}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-teal-900 leading-none">Unsaved Roster Draft Elements Exist</p>
              <p className="text-[10px] text-teal-700 mt-1">You have staged {changedCount} adjustments. Review and click "Commit Batch" to execute.</p>
            </div>
          </div>
          <button
            onClick={handleCommitBatch}
            disabled={saving}
            className="h-10 bg-teal-850 hover:bg-teal-950 disabled:bg-teal-300 text-white font-bold text-xs px-4 rounded-xl flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Processing transaction..." : "Commit Batch Shifts"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto min-w-[750px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-250 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-6 py-4 w-60">Employee</th>
                  {dates.map((d) => {
                    const isToday = d.iso === todayStr;
                    return (
                      <th
                        key={d.iso}
                        className={`px-4 py-4 text-center ${
                          isToday ? "bg-teal-50/50 text-teal-850 font-bold border-x border-teal-100" : ""
                        }`}
                      >
                        <span className="block text-zinc-405 text-[9px] font-mono leading-none">{d.dayName}</span>
                        <span className="block mt-1 font-extrabold text-zinc-900 leading-none">{d.shortDate}</span>
                        {isToday && (
                          <span className="inline-block px-1.5 py-0.2 bg-teal-600 text-white rounded text-[8px] uppercase tracking-wider font-extrabold font-mono mt-1 w-max">
                            Today
                          </span>
                        )}
                        {d.iso < todayStr && (
                          <span className="inline-block px-1.5 py-0.2 bg-zinc-400 text-white rounded text-[8px] uppercase tracking-wider font-extrabold font-mono mt-1 w-max">
                            Locked
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={dates.length + 1} className="px-6 py-12 text-center text-zinc-400 font-bold">
                      No staff members assigned to this division.
                    </td>
                  </tr>
                ) : (
                  employees.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-zinc-900 block">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="text-[10px] text-zinc-450 block font-mono">{p.position || "Resident"}</span>
                      </td>

                      {dates.map((d) => {
                        const key = `${p.id}_${d.iso}`;
                        const shift = draftMap[key] || "off";
                        
                        const mathReal = realSchedules.find((s) => s.person_id === p.id && s.work_date === d.iso);
                        const realVal = mathReal ? mathReal.shift_type : "off";
                        const isDraft = shift !== realVal;

                        const isPast = d.iso < todayStr;

                        return (
                          <td
                            key={d.iso}
                            className={`p-2.5 text-center transition-colors ${
                              d.iso === todayStr ? "bg-teal-50/10 border-x border-teal-100/40" : ""
                            }`}
                          >
                            <button
                              disabled={isPast}
                              onClick={() => handleCellToggle(p.id, d.iso)}
                              className={`w-full py-4 px-2 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 min-h-[70px] outline-none ${
                                isPast
                                  ? "bg-zinc-50 border-zinc-200 text-zinc-350 cursor-not-allowed"
                                  : shift === "day"
                                  ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100/60"
                                  : shift === "night"
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-950 hover:bg-indigo-100/60"
                                  : "bg-white border-zinc-205 border-dashed hover:border-teal-400 hover:bg-teal-50/10"
                              } ${isDraft ? "ring-2 ring-teal-500 animate-pulse text-zinc-900" : ""}`}
                            >
                              {isPast ? (
                                <Lock className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                              ) : shift === "day" ? (
                                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                              ) : shift === "night" ? (
                                <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-zinc-300 shrink-0" />
                              )}

                              <span className="text-[10px] uppercase font-bold tracking-wider font-mono">
                                {isPast ? (shift === "off" ? "Off" : shift) : shift}
                              </span>

                              {isDraft && !isPast && (
                                <span className="text-[8px] bg-teal-600 text-white rounded font-mono px-1 font-bold">
                                  DRAFT
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legends Block footer */}
      <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-zinc-650 bg-zinc-101 border border-zinc-200 p-4 rounded-2xl">
        <span className="font-bold">Grid Legend:</span>
        <div className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Day Shift (Free lunch eligibility hours: 11:00 AM - 2:00 PM)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Night Shift (Free lunch eligibility hours: 10:00 PM - 6:00 AM)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ToggleLeft className="w-3.5 h-3.5 text-zinc-400" />
          <span>Off-Duty (No lunch allowance allocation)</span>
        </div>
      </div>
    </div>
  );
}
