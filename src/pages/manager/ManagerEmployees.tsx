import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Person, Transaction } from "../../types.js";
import { ClipboardList, Search, User, X, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { SecureField } from "../../components/SecureField.js";
import { useDebounce } from "../../hooks/useDebounce.js";

export default function ManagerEmployees() {
  const { apiFetch } = useAuth();
  const [employees, setEmployees] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [error, setError] = useState<string | null>(null);

  // Meal Logs Detail Module
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Person | null>(null);
  const [staffMeals, setStaffMeals] = useState<Transaction[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const loadDeptEmployees = async () => {
    try {
      const list = await apiFetch("/api/manager/employees");
      setEmployees(list);
    } catch (err: any) {
      setError(err.message || "Failed to load departmental staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeptEmployees();
  }, []);

  const handleOpenMeals = async (p: Person) => {
    setSelectedStaff(p);
    setLogsOpen(true);
    setLoadingMeals(true);
    try {
      const meals = await apiFetch(`/api/manager/employee-meals/${p.id}`);
      setStaffMeals(meals);
    } catch (_err: any) {
      setStaffMeals([]);
    } finally {
      setLoadingMeals(false);
    }
  };

  const filteredStaff = employees.filter((p) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    return (
      fullName.includes(debouncedSearch.toLowerCase()) ||
      (p.employee_no && p.employee_no.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
      (p.position && p.position.toLowerCase().includes(debouncedSearch.toLowerCase()))
    );
  });

  return (
    <div id="manager-staff-page">
      <PageHeader
        title="Managed Personnel"
        subtitle="Roster of employees assigned to your medical division. Click any staff member to audit past meal redemptions."
      />

      {/* search box */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-4 mb-6">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search department staff by name, code, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:ring-1 focus:ring-teal-700 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Employee No</th>
                  <th className="px-6 py-4">Position / Title</th>
                  <th className="px-6 py-4">Hired Date</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-bold">
                      No staff members found.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold">
                          {p.first_name?.[0] || p.username?.[0] || 'P'}{p.last_name?.[0] || ''}
                        </div>
                        <div>
                          <span className="font-bold text-zinc-900 block">
                            {p.first_name} {p.last_name}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono block">usr: {p.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <SecureField value={p.employee_no} />
                      </td>
                      <td className="px-6 py-4 font-bold text-teal-900">{p.position || "Staff Practitioner"}</td>
                      <td className="px-6 py-4 text-zinc-500 font-mono">
                        {p.hire_date ? new Date(p.hire_date).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-zinc-400 font-sans uppercase">Email:</span>
                          <SecureField value={p.email} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-zinc-400 font-sans uppercase">Phone:</span>
                          <SecureField value={p.phone} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenMeals(p)}
                          className="h-8 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold px-3 transition-colors uppercase tracking-wider"
                        >
                          Audit Meal Claims
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Meal Claims detail modal panel overlay */}
      {logsOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl border border-zinc-200 shadow-2xl flex flex-col max-h-[80vh]">
            
            <div className="p-6 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 rounded-t-3xl">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-teal-700">Audit History Log</span>
                <h3 className="text-sm font-black text-zinc-900 inline-flex items-center gap-1.5 flex-wrap">
                  Claims of {selectedStaff.first_name} {selectedStaff.last_name} (<SecureField value={selectedStaff.employee_no} />)
                </h3>
              </div>
              <button
                onClick={() => setLogsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {loadingMeals ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : staffMeals.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <span className="text-zinc-400 text-xs font-bold font-sans">
                    No cafeteria registrations recorded for this employee profile yet.
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
                    Recent Cafeteria Access Claims List
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-200">
                    {staffMeals.map((meal) => (
                      <div key={meal.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-zinc-800">{meal.meal_date}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{meal.meal_time}</span>
                          </div>
                          <span
                            className={`inline-block text-[9px] font-bold px-2 py-0.2 rounded border uppercase mt-1 ${
                              meal.is_free
                                ? "bg-emerald-50 text-emerald-800 border-emerald-150"
                                : "bg-teal-50 text-teal-800 border-teal-150"
                            }`}
                          >
                            {meal.is_free ? "Redeemed Shift Voucher" : "Direct Cash Transaction"}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-black text-zinc-900 block">
                            {meal.is_free ? "₱0.00" : `₱${Number(meal.meal_amount).toFixed(2)}`}
                          </span>
                          <span
                            className={`inline-block text-[9px] font-bold uppercase mt-1 ${
                              meal.status === "completed" ? "text-emerald-650" : "text-rose-500"
                            }`}
                          >
                            {meal.status === "completed" ? "Completed" : "Cancelled"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-150 flex items-center justify-end rounded-b-3xl">
              <button
                onClick={() => setLogsOpen(false)}
                className="h-9 px-4 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg text-xs font-bold font-sans"
              >
                Close Audit Dialog
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
