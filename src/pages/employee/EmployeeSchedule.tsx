import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { Calendar, Clock, AlertCircle, Sun, Moon, Info, CalendarRange } from "lucide-react";

interface Schedule {
  id: number;
  work_date: string;
  shift_type: "day" | "night";
}

export default function EmployeeSchedule() {
  const { apiFetch } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const cached = localStorage.getItem("cached_employee_schedules");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(schedules.length === 0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(() => 
    localStorage.getItem("cached_employee_schedules_timestamp")
  );

  useEffect(() => {
    async function loadSchedules() {
      try {
        const list = await apiFetch("/api/employee/schedules");
        // Sort chronologically
        list.sort((a: any, b: any) => a.work_date.localeCompare(b.work_date));
        setSchedules(list);
        localStorage.setItem("cached_employee_schedules", JSON.stringify(list));
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString();
        localStorage.setItem("cached_employee_schedules_timestamp", nowStr);
        setCacheTimestamp(nowStr);
        setIsOfflineMode(false);
      } catch (_err) {
        const cached = localStorage.getItem("cached_employee_schedules");
        if (cached) {
          const list = JSON.parse(cached);
          setSchedules(list);
          setIsOfflineMode(true);
        }
      } finally {
        setLoading(false);
      }
    }
    loadSchedules();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <VitalSignsLoader size="md" color="teal" className="mb-2" />
        <p className="text-xs font-mono font-bold text-teal-800 mt-2 uppercase tracking-widest">
          Syncing Duty Calendars...
        </p>
      </div>
    );
  }

  // Find today's date string in YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const todayShift = schedules.find((s) => s.work_date === todayStr);

  const upcomingSchedules = schedules.filter((s) => s.work_date >= todayStr);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Header Info */}
      <div className="border-b border-zinc-200 pb-5">
        <h2 className="text-xl font-extrabold text-zinc-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#003299]" />
          <span>My Medical Roster Schedules</span>
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Review your official registered department shift schedules, which govern cafeteria eligibility windows
        </p>
      </div>

      {isOfflineMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 items-center non-printable">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Intermittent Connectivity - Offline Mode</p>
            <p className="text-zinc-650 mt-0.5">
              Showing cached roster schedule (last synced: {cacheTimestamp || "recently"}). Recent adjustments to your roster may not be visible until connection is restored.
            </p>
          </div>
        </div>
      )}

      {/* Grid Layout splits Today and Future schedule */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side Column: Active Today Panel */}
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-400">Status Today</h3>
          
          {todayShift ? (
            <div className="bg-gradient-to-br from-teal-900 to-teal-980 text-white rounded-3xl p-6 border border-teal-850 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-teal-300 mb-4 border border-white/5">
                {todayShift.shift_type === "day" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <span className="text-[9px] uppercase font-mono tracking-widest text-teal-300 font-extrabold">Active Duty Shift</span>
              <h4 className="text-xl font-black mt-1 capitalize">{todayShift.shift_type} Duty</h4>
              
              <div className="mt-4 space-y-2 text-xs text-teal-200">
                <div className="flex justify-between">
                  <span>Shift Date:</span>
                  <span className="font-bold text-white font-mono">{todayShift.work_date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Meal Window:</span>
                  <span className="font-bold text-white font-mono">
                    {todayShift.shift_type === "day" ? "11 AM - 2 PM" : "10 PM - 6 AM"}
                  </span>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] text-teal-300 leading-normal">
                Present your QR credential badge to claim your designated free benefit lunch coupon during these hours.
              </div>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-3xl p-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-450 mx-auto mb-4">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-400 font-bold block">Active Duty Shift</span>
              <h4 className="text-md font-extrabold text-zinc-900 mt-1">Off Duty Today</h4>
              <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                You are not on the scheduled rosters for today. Cafeteria meals will require normal cash payment.
              </p>
            </div>
          )}

          {/* Reference guidelines panel */}
          <div className="bg-blue-50/50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-[#003299] shrink-0 mt-0.5" />
            <div className="text-[10px] leading-relaxed">
              <p className="font-bold uppercase text-[#003299]">Standard Subsidy Windows</p>
              <ul className="list-disc pl-4 mt-1 space-y-1 text-zinc-650">
                <li><span className="font-bold">Day Shift:</span> Check-in allowed between 11:00 AM &amp; 2:00 PM.</li>
                <li><span className="font-bold">Night Shift:</span> Check-in allowed between 10:00 PM &amp; 06:00 AM.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Side Column: Chronological List of Schedules (Future) */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-400">Roster Calendars ({upcomingSchedules.length} periods active)</h3>

          {upcomingSchedules.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center">
              <CalendarRange className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <h4 className="text-sm font-bold text-zinc-800 uppercase tracking-tight">No Calendars Scheduled</h4>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
                No future shifts are registered in your work schedule history. Contact your department manager to commit your roster schedule.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs divide-y divide-zinc-100">
              {upcomingSchedules.map((s) => {
                const isToday = s.work_date === todayStr;
                return (
                  <div key={s.id} className={`p-4 flex items-center justify-between transition-colors hover:bg-zinc-50/50 ${isToday ? "bg-teal-50/30 font-bold" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        s.shift_type === "day" 
                          ? "bg-amber-50 text-amber-600 border-amber-100" 
                          : "bg-indigo-50 text-indigo-600 border-indigo-100"
                      }`}>
                        {s.shift_type === "day" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                          <span>{s.work_date}</span>
                          {isToday && (
                            <span className="bg-teal-600 text-white font-mono text-[8px] uppercase tracking-wider px-1.5 rounded-md font-bold py-0.2">
                              Today
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-500 capitalize mt-0.5">{s.shift_type} Shift Assignment</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-[10px] font-bold text-zinc-700">
                        {s.shift_type === "day" ? "11 AM - 2 PM" : "10 PM - 6 AM"}
                      </span>
                      <p className="text-[9px] text-emerald-700 font-bold mt-0.5">Voucher Benefit Eligible</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
