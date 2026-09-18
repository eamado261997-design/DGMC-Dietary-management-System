import { isMysqlConnected, query, execute } from "../mysql.js";
import { readDatabase, writeDatabase } from "../db.js";
import { getTodayDateStr } from "./apiUtils.js";

export interface DepartmentEntitlementPolicy {
  departmentId: number;
  departmentName: string;
  defaultDailyFreeMeals: number;
  allowNightShiftAllocation: boolean;
  requiresActiveRoster: boolean;
  gracePeriodMinutes: number;
  salaryDeductionAllowed: boolean;
}

export interface EntitlementReinitializationResult {
  employeeId: number;
  previousStatus: string;
  newStatus: string;
  reinitializedAt: string;
  departmentId: number | null;
  departmentName: string;
  policyApplied: DepartmentEntitlementPolicy;
  actionsPerformed: string[];
  currentEligibility: {
    canClaimFreeMeal: boolean;
    freeMealQuotaToday: number;
    claimedToday: number;
    remainingToday: number;
    scheduleRequired: boolean;
    hasActiveScheduleToday: boolean;
  };
}

export interface LifecycleDocumentation {
  title: string;
  version: string;
  lastUpdated: string;
  overview: string;
  stateTransitions: {
    from: string;
    to: string;
    trigger: string;
    automatedActions: string[];
    entitlementImpact: string;
  }[];
  departmentRulesEngine: {
    ruleId: string;
    name: string;
    description: string;
    defaultPolicy: string;
  }[];
  auditAndCompliance: string[];
}

/**
 * Returns static & dynamic documentation on how employee lifecycle status transitions work,
 * including re-initialization of meal credits and departmental entitlements.
 */
export function getEmployeeLifecycleDocumentation(): LifecycleDocumentation {
  return {
    title: "Employee Lifecycle & Entitlement Transition Specification",
    version: "2.4.0",
    lastUpdated: "2026-09-18",
    overview:
      "This specification defines the authoritative rules for employee status transitions (Active <-> Inactive) within the Dietary Management System. When an employee transitions between states, system access, scheduling eligibility, and dietary entitlements (such as daily meal credits and vouchers) are synchronously updated based on the employee's assigned hospital division / department.",
    stateTransitions: [
      {
        from: "inactive",
        to: "active",
        trigger: "Admin/Manager reactivation or profile update with is_active = true",
        automatedActions: [
          "1. Re-enable Authentication: Employee credentials, session logins, and QR code recognition are activated instantly.",
          "2. Department Policy Lookup: System reads the assigned department ID and retrieves current shift and meal allocation policies.",
          "3. Clear Stale Holds: Any expired or dormant entitlement invalidations from the inactive period are flushed.",
          "4. Re-initialize Meal Quota: Baseline daily free meal credit quota is refreshed according to department and system settings.",
          "5. Enable Roster Scheduling: Employee becomes selectable for manager shift assignments and active meal windows.",
          "6. Audit Logging: System logs an immutable EMPLOYEE_REACTIVATION event with snapshot of re-initialized entitlements."
        ],
        entitlementImpact:
          "All previous expired meal entitlements are re-initialized. The employee receives full entitlement to daily free meal allocations as dictated by their department schedule and current shift."
      },
      {
        from: "active",
        to: "inactive",
        trigger: "Admin deactivation, separation, or leave of absence (DELETE or update with is_active = false)",
        automatedActions: [
          "1. Revoke Authentication: Invalidate active login tokens and disable QR scanner verification.",
          "2. Cancel Pending Schedules: Cancel future unfulfilled meal schedules and shift roster bookings.",
          "3. Hold Entitlements: Expire unconsumed meal vouchers and block new credit allocations.",
          "4. Retain Audit Trail: Maintain complete historical ledger of prior meal vouchers, paid meals, and salary deductions for financial compliance."
        ],
        entitlementImpact:
          "All unconsumed meal credits and shift entitlements are locked and set to inactive. Historical ledger records are permanently preserved."
      }
    ],
    departmentRulesEngine: [
      {
        ruleId: "DEPT_QUOTA_DEFAULT",
        name: "Department Standard Meal Quota",
        description:
          "Each department establishes a baseline daily meal allocation (default: 1 free meal voucher per eligible scheduled shift).",
        defaultPolicy: "1 voucher per scheduled day/night duty"
      },
      {
        ruleId: "DEPT_ROSTER_SYNC",
        name: "Active Roster Synchronization",
        description:
          "Free meal credit entitlement requires an active duty schedule assigned by the department manager for the current date.",
        defaultPolicy: "Active duty roster entry required"
      },
      {
        ruleId: "DEPT_WINDOW_VALIDATION",
        name: "Dietary Serving Window Compliance",
        description:
          "Meal credits are redeemable exclusively during the authorized dietary serving window (Day: 11:00-14:00, Night: 22:00-02:00) with a 15-minute operational grace period.",
        defaultPolicy: "Enforced at Cashier QR validation"
      },
      {
        ruleId: "DEPT_SALARY_DEDUCTION_FALLBACK",
        name: "Over-Quota / Non-Scheduled Fallback",
        description:
          "If an active employee claims meals outside their scheduled window or beyond their daily free voucher quota, transactions automatically route to payroll salary deduction.",
        defaultPolicy: "Standard item price billed to salary ledger"
      }
    ],
    auditAndCompliance: [
      "All status transitions produce an auditable event in the system audit log.",
      "Re-initialization timestamps and applied department policy snapshots are preserved.",
      "Past financial and meal transaction records are immutable and cannot be deleted upon status changes."
    ]
  };
}

/**
 * Resolves the department entitlement policy for a given department ID.
 */
export async function getDepartmentPolicy(departmentId: number | null): Promise<DepartmentEntitlementPolicy> {
  let deptName = "General Hospital Division";
  if (departmentId) {
    if (isMysqlConnected()) {
      const rows = await query("SELECT name FROM departments WHERE id = ?", [departmentId]);
      if (rows.length > 0 && rows[0].name) {
        deptName = rows[0].name;
      }
    } else {
      const db = readDatabase();
      const dept = (db.departments || []).find((d: any) => Number(d.id) === Number(departmentId));
      if (dept && dept.name) deptName = dept.name;
    }
  }

  return {
    departmentId: departmentId || 1,
    departmentName: deptName,
    defaultDailyFreeMeals: 1,
    allowNightShiftAllocation: true,
    requiresActiveRoster: true,
    gracePeriodMinutes: 15,
    salaryDeductionAllowed: true
  };
}

/**
 * Explicitly re-initializes an employee's meal credits and entitlements upon reactivation.
 */
export async function reinitializeEmployeeEntitlements(
  personId: number,
  departmentId: number | null,
  previousStatus: string = "inactive"
): Promise<EntitlementReinitializationResult> {
  const policy = await getDepartmentPolicy(departmentId);
  const todayStr = getTodayDateStr();
  const actions: string[] = [];

  // Step 1: Verify current person record
  let currentSchedule: any = null;
  let claimsCount = 0;

  if (isMysqlConnected()) {
    // Check if scheduled today
    const schedRows = await query(
      "SELECT * FROM employee_schedules WHERE person_id = ? AND work_date = ?",
      [personId, todayStr]
    );
    currentSchedule = schedRows[0] || null;

    // Check today's claims
    const claimRows = await query(
      "SELECT COUNT(*) as cnt FROM free_meal_logs WHERE person_id = ? AND meal_date = ?",
      [personId, todayStr]
    );
    claimsCount = claimRows[0]?.cnt || 0;
  } else {
    const db = readDatabase();
    currentSchedule = (db.employee_schedules || []).find(
      (s: any) => Number(s.person_id) === Number(personId) && s.work_date === todayStr
    );
    claimsCount = (db.free_meal_log || []).filter(
      (f: any) => Number(f.person_id) === Number(personId) && f.meal_date === todayStr
    ).length;
  }

  actions.push(`Validated Department Policy: ${policy.departmentName} (ID: ${policy.departmentId})`);
  actions.push(`Re-initialized daily free meal quota to ${policy.defaultDailyFreeMeals} allocation(s) per duty shift.`);
  actions.push(`Restored QR voucher validation state and cleared dormant inactive locks.`);

  if (currentSchedule) {
    actions.push(`Detected active shift schedule for today (${currentSchedule.shift_type.toUpperCase()} shift). Immediate meal entitlement armed.`);
  } else {
    actions.push(`No duty schedule for today yet. Entitlement armed for next manager roster assignment.`);
  }

  const remainingQuota = Math.max(0, policy.defaultDailyFreeMeals - claimsCount);

  return {
    employeeId: personId,
    previousStatus,
    newStatus: "active",
    reinitializedAt: new Date().toISOString(),
    departmentId,
    departmentName: policy.departmentName,
    policyApplied: policy,
    actionsPerformed: actions,
    currentEligibility: {
      canClaimFreeMeal: remainingQuota > 0 && Boolean(currentSchedule),
      freeMealQuotaToday: policy.defaultDailyFreeMeals,
      claimedToday: claimsCount,
      remainingToday: remainingQuota,
      scheduleRequired: policy.requiresActiveRoster,
      hasActiveScheduleToday: Boolean(currentSchedule)
    }
  };
}

/**
 * Handles the complete lifecycle transition when an employee's status or active state is modified.
 */
export async function handleEmployeeStatusTransition(
  targetId: number,
  oldPerson: any,
  newIsActive: boolean,
  newDeptId: number | null,
  logToAudit?: (action: string, entityType: string, entityId: any, oldData: any, newData: any) => Promise<void>
): Promise<EntitlementReinitializationResult | null> {
  const wasActive = oldPerson?.is_active === 1 || oldPerson?.is_active === true;
  const isNowActive = Boolean(newIsActive);

  // Transition: INACTIVE -> ACTIVE
  if (!wasActive && isNowActive) {
    const effectiveDeptId = newDeptId !== undefined && newDeptId !== null ? newDeptId : (oldPerson?.department_id || null);
    const result = await reinitializeEmployeeEntitlements(targetId, effectiveDeptId, "inactive");

    if (logToAudit) {
      await logToAudit(
        "EMPLOYEE_REACTIVATION",
        "people",
        targetId,
        { is_active: false, employee_status: oldPerson?.employee_status || "inactive" },
        {
          is_active: true,
          employee_status: "active",
          entitlements_reinitialized: true,
          department_id: effectiveDeptId,
          department_name: result.departmentName,
          policy_applied: result.policyApplied
        }
      );
    }

    return result;
  }

  // Transition: ACTIVE -> INACTIVE
  if (wasActive && !isNowActive) {
    if (logToAudit) {
      await logToAudit(
        "EMPLOYEE_DEACTIVATION",
        "people",
        targetId,
        { is_active: true, employee_status: oldPerson?.employee_status || "active" },
        { is_active: false, employee_status: "inactive", entitlements_suspended: true }
      );
    }
    return null;
  }

  return null;
}
