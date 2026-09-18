import React, { useState, useEffect } from "react";
import { X, RefreshCw, BookOpen, ShieldCheck, Clock, Award, Building, CheckCircle2, AlertCircle, ArrowRight, UserCheck, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { Person, Department } from "../types.js";

interface LifecycleDocProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  employees?: Person[];
}

export default function EmployeeLifecycleDocsModal({
  isOpen,
  onClose,
  departments,
  employees = [],
}: LifecycleDocProps) {
  const { apiFetch } = useAuth();
  const [docsData, setDocsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | "">("");
  const [empStatusInfo, setEmpStatusInfo] = useState<any>(null);
  const [loadingEmpStatus, setLoadingEmpStatus] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/lifecycle-docs");
      setDocsData(data);
    } catch (err) {
      console.error("Failed to load lifecycle docs:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkEmployeeEntitlements = async (empId: number) => {
    if (!empId) return;
    setLoadingEmpStatus(true);
    try {
      const info = await apiFetch(`/api/admin/people/${empId}/lifecycle-status`);
      setEmpStatusInfo(info);
    } catch (err) {
      console.error("Failed to check employee status:", err);
      setEmpStatusInfo(null);
    } finally {
      setLoadingEmpStatus(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Employee Lifecycle &amp; Entitlement Transition Policy
              </h2>
              <p className="text-xs text-zinc-500">
                Authoritative rules engine for Inactive ⟷ Active status changes &amp; meal credit re-initialization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-zinc-700">

          {/* Key Principle Alert */}
          <div className="p-4 bg-teal-50/60 border border-teal-200/80 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-800 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-teal-950 text-xs">
                Automatic Entitlement Re-initialization
              </h4>
              <p className="text-[11px] text-teal-900 leading-relaxed">
                When an employee is restored from <strong>Inactive</strong> to <strong>Active</strong>, the server automatically flushes dormant session locks, references the employee's assigned hospital division, and re-initializes their baseline daily free meal credits and duty roster eligibility.
              </p>
            </div>
          </div>

          {/* Status Transitions Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 font-mono">
              Status State Machine &amp; Transition Workflow
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Inactive -> Active */}
              <div className="border border-emerald-200 bg-emerald-50/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/70 border border-emerald-300/60 text-emerald-900 font-bold text-[11px]">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Inactive ➔ Active (Reactivation)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-800 font-bold">Priority Re-sync</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mb-3">
                    Triggered when an admin or manager activates an employee profile.
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-zinc-700">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span><strong>Access Restored:</strong> Credentials and QR code scanner acceptance activated.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span><strong>Credit Reset:</strong> Expired locks cleared; daily quota reset based on department rules.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span><strong>Roster Arming:</strong> Selectable for duty schedules and dietary serving windows.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span><strong>Audit Logged:</strong> Immutable record created with policy snapshot.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Active -> Inactive */}
              <div className="border border-zinc-200 bg-zinc-50/50 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100/70 border border-rose-300/60 text-rose-900 font-bold text-[11px]">
                      <Lock className="w-3.5 h-3.5 text-rose-700" />
                      Active ➔ Inactive (Deactivation)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">Audit Protected</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mb-3">
                    Triggered when an employee leaves, takes leave, or is deactivated by admin.
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-zinc-700">
                    <li className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span><strong>Access Revoked:</strong> QR code verification rejected at cafeteria POS.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span><strong>Entitlements Held:</strong> Unconsumed daily meal vouchers suspended.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span><strong>Schedule Cleared:</strong> Future unserved shift roster allocations cancelled.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span><strong>Ledger Retained:</strong> Historical claims &amp; deductions permanently preserved.</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          </div>

          {/* Department Rules Hierarchy */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 font-mono">
              Hospital Division &amp; Department Rules Engine
            </h3>
            <div className="border border-zinc-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Rule Identifier</th>
                    <th className="px-4 py-3">Rule Name &amp; Description</th>
                    <th className="px-4 py-3">Default Enforced Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-[11px]">
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-teal-800">DEPT_QUOTA_DEFAULT</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      Standard Daily Free Meal Allocation
                      <span className="block text-[10px] text-zinc-500 font-normal">
                        Allocated to active employees scheduled on standard day or night shifts.
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-800">1 Free Meal per Scheduled Duty</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-teal-800">DEPT_ROSTER_SYNC</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      Duty Schedule Verification
                      <span className="block text-[10px] text-zinc-500 font-normal">
                        Entitlements activate upon manager shift roster assignment for today's date.
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-800">Active Roster Entry Required</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-teal-800">DEPT_WINDOW_VALIDATION</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      Meal Serving Window Compliance
                      <span className="block text-[10px] text-zinc-500 font-normal">
                        Enforced during Day (11:00-14:00) and Night (22:00-02:00) meal periods.
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-800">15-Min Operational Grace Period</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-teal-800">DEPT_SALARY_FALLBACK</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      Non-Duty / Extra Meal Fallback
                      <span className="block text-[10px] text-zinc-500 font-normal">
                        If quota is exceeded or employee is off-duty, cafeteria purchases charge to salary deduction.
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-800">Automatic Payroll Deduction</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Entitlement Inspector */}
          {employees.length > 0 && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-teal-800" />
                  <span className="font-bold text-zinc-900 text-xs">
                    Live Entitlement Inspector
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Real-time Policy Diagnostic
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedEmpId}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : "";
                    setSelectedEmpId(val);
                    if (val) checkEmployeeEntitlements(Number(val));
                  }}
                  className="flex-1 h-9 bg-white border border-zinc-300 rounded-xl px-3 text-xs text-zinc-800 font-medium"
                >
                  <option value="">-- Select an employee to inspect live entitlements --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_no || "No ID"}) — {emp.is_active ? "Active" : "Inactive"}
                    </option>
                  ))}
                </select>

                {selectedEmpId && (
                  <button
                    onClick={() => checkEmployeeEntitlements(Number(selectedEmpId))}
                    disabled={loadingEmpStatus}
                    className="h-9 px-3 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-xl font-bold text-zinc-700 flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingEmpStatus ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                )}
              </div>

              {empStatusInfo && (
                <div className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <span className="font-bold text-zinc-900">
                      Department: {empStatusInfo.departmentName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      empStatusInfo.newStatus === "active" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}>
                      Status: {empStatusInfo.newStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Daily Free Quota</span>
                      <span className="font-mono font-bold text-zinc-900">{empStatusInfo.currentEligibility.freeMealQuotaToday} meal(s)</span>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Claimed Today</span>
                      <span className="font-mono font-bold text-teal-800">{empStatusInfo.currentEligibility.claimedToday} claimed</span>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Remaining Today</span>
                      <span className="font-mono font-bold text-emerald-700">{empStatusInfo.currentEligibility.remainingToday} available</span>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Today's Shift</span>
                      <span className="font-bold text-zinc-800">
                        {empStatusInfo.currentEligibility.hasActiveScheduleToday ? "Scheduled" : "No Shift (Off Duty)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono">
            DMS Lifecycle Engine v2.4.0 • System Enforced
          </div>
          <button
            onClick={onClose}
            className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs transition-colors"
          >
            Close Documentation
          </button>
        </div>

      </div>
    </div>
  );
}
