import { jsonResponse, ApiResponse } from "../utils/apiUtils.js";
import { readDatabase, writeDatabase, hashPassword } from "../db.js";
import { isMysqlConnected, query, execute } from "../mysql.js";
import { DEFAULT_MIN_PASSWORD_LENGTH } from "../../utils/password.js";
import { validatePasswordComplexity } from "../../utils/password.js";
import { Person } from "../../types.js";
import { startTimer, recordEmployeePerfMetric, getPerfHeaders } from "../utils/performanceTracker.js";

function isProtectedUser(user: any): boolean {
  if (!user) return false;
  return (
    user.id === 1 ||
    String(user.username).toLowerCase() === "admin" ||
    String(user.role) === "admin" ||
    user.is_protected === 1 ||
    user.is_protected === true ||
    user.protected === 1 ||
    user.protected === true
  );
}

export async function handleEmployeeRoutes(
  method: string,
  path: string,
  body: any,
  headers: any,
  authUser: Person | null,
  queryParams: any,
  requireRole: (roles: string[]) => boolean,
  logToAudit: (action: string, entityType: string, entityId: any, oldData: any, newData: any) => Promise<void>,
  getSettingValue: (key: string, defaultVal: string) => Promise<string>
): Promise<ApiResponse | null> {
  // Reset Password (Admin / Dietary Admin)
  const resetPassMatch = path.match(/^\/api\/admin\/people\/(\d+)\/reset-password$/);
  if (resetPassMatch && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const targetId = parseInt(resetPassMatch[1], 10);
    const { newPassword } = body || {};
    
    if (!newPassword || newPassword.trim() === "") {
        return jsonResponse(400, { error: "New password is required" });
    }
    const minPassLenStr = await getSettingValue("min_password_length", String(DEFAULT_MIN_PASSWORD_LENGTH));
    const minPassLen = parseInt(minPassLenStr, 10) || DEFAULT_MIN_PASSWORD_LENGTH;
    const passValidationError = validatePasswordComplexity(newPassword, minPassLen);
    if (passValidationError) {
      return jsonResponse(400, { error: passValidationError });
    }

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      if (rows.length === 0) return jsonResponse(404, { error: "Person record not found" });
      const targetP = rows[0];
      if ((isProtectedUser(targetP) || targetId === 1) && authUser?.role !== "admin") {
        return jsonResponse(403, { error: "Protected System Administrator account is untouchable and password cannot be reset by Dietary Admin or other non-admin accounts." });
      }
      
      const nowStr = new Date().toISOString();
      await execute("UPDATE people SET password = ?, updated_at = ? WHERE id = ?", [hashPassword(newPassword), nowStr, targetId]);
      await logToAudit("PASSWORD_RESET", "people", targetId, null, "Admin force-reset password");
      return jsonResponse(200, { message: "Password reset successfully" });
    } else {
      const db = readDatabase();
      const dbUser = db.people.find(p => p.id === targetId);
      if (!dbUser) return jsonResponse(404, { error: "Person record not found" });
      if ((isProtectedUser(dbUser) || targetId === 1) && authUser?.role !== "admin") {
        return jsonResponse(403, { error: "Protected System Administrator account is untouchable and password cannot be reset by Dietary Admin or other non-admin accounts." });
      }

      dbUser.password = hashPassword(newPassword);
      dbUser.updated_at = new Date().toISOString();
      writeDatabase(db);
      await logToAudit("PASSWORD_RESET", "people", targetId, null, "Admin force-reset password");
      return jsonResponse(200, { message: "Password reset successfully" });
    }
  }

  // Admin Single Person operations (PUT, DELETE)
  const personMatch = path.match(/^\/api\/admin\/people\/(\d+)$/);
  if (personMatch && method === "PUT") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const targetId = parseInt(personMatch[1], 10);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      const p = rows[0];
      if (!p) return jsonResponse(404, { error: "Person record not found" });

      if ((isProtectedUser(p) || targetId === 1) && authUser?.role !== "admin") {
        return jsonResponse(403, { error: "Protected System Administrator account is untouchable and cannot be modified by Dietary Admin or other accounts." });
      }

      const {
        username, password, role, first_name, last_name, email, phone, is_active,
        employee_no, position, department_id, qr_code, employee_status, hire_date, managed_department_id
      } = body || {};

      if ((role === "admin" || body.is_protected === true || body.is_protected === 1 || body.protected === true || body.protected === 1) && authUser?.role !== "admin") {
        return jsonResponse(403, { error: "Only System Administrator can assign, manage, or create protected/admin accounts." });
      }

      if (department_id !== undefined && department_id !== null) {
        const deptIdNum = parseInt(department_id, 10);
        if (isNaN(deptIdNum)) return jsonResponse(400, { error: "Invalid Hospital Division ID / department_id format." });
        const dRows = await query("SELECT id FROM departments WHERE id = ?", [deptIdNum]);
        if (dRows.length === 0) {
          return jsonResponse(400, { error: `Data Integrity Violation: Assigned Hospital Division ID (department_id: ${deptIdNum}) does not match any valid department record in the registry.` });
        }
      }

      if (password && password.trim() !== "") {
        const minPassLenStr = await getSettingValue("min_password_length", String(DEFAULT_MIN_PASSWORD_LENGTH));
        const minPassLen = parseInt(minPassLenStr, 10) || DEFAULT_MIN_PASSWORD_LENGTH;
        const passValidationError = validatePasswordComplexity(password, minPassLen);
        if (passValidationError) return jsonResponse(400, { error: passValidationError });
      }

      if (username && username.trim().toLowerCase() !== p.username.toLowerCase()) {
        const exists = await query("SELECT id FROM people WHERE LOWER(username) = ?", [username.trim().toLowerCase()]);
        if (exists.length > 0) return jsonResponse(400, { error: "Username already taken" });
      }

      if (employee_no && employee_no.trim() !== p.employee_no) {
        const exists = await query("SELECT id FROM people WHERE employee_no = ?", [employee_no.trim()]);
        if (exists.length > 0) return jsonResponse(400, { error: "Employee Number already exists" });
      }

      if (qr_code && qr_code.trim() !== p.qr_code) {
        const exists = await query("SELECT id FROM people WHERE qr_code = ?", [qr_code.trim()]);
        if (exists.length > 0) return jsonResponse(400, { error: "QR code already registered" });
      }

      const oldPersonCopy = { ...p };
      delete oldPersonCopy.password;

      const updated_at = new Date().toISOString();
      const finalPass = (password && password.trim() !== "") ? hashPassword(password) : p.password;

      await execute(
        `UPDATE people SET
          username = ?, password = ?, role = ?, first_name = ?, last_name = ?,
          email = ?, phone = ?, is_active = ?, employee_no = ?, position = ?,
          department_id = ?, qr_code = ?, employee_status = ?, hire_date = ?,
          managed_department_id = ?, updated_at = ?
         WHERE id = ?`,
        [
          username ? username.trim() : p.username,
          finalPass,
          role || p.role,
          first_name ? first_name.trim() : p.first_name,
          last_name ? last_name.trim() : p.last_name,
          email !== undefined ? (email ? email.trim() : null) : p.email,
          phone !== undefined ? (phone ? phone.trim() : null) : p.phone,
          is_active !== undefined ? (is_active ? 1 : 0) : p.is_active,
          employee_no !== undefined ? (employee_no ? employee_no.trim() : null) : p.employee_no,
          position !== undefined ? (position ? position.trim() : null) : p.position,
          department_id !== undefined ? (department_id ? parseInt(department_id, 10) : null) : p.department_id,
          qr_code !== undefined ? (qr_code ? qr_code.trim() : null) : p.qr_code,
          employee_status !== undefined ? employee_status : p.employee_status,
          hire_date !== undefined ? (hire_date || null) : p.hire_date,
          managed_department_id !== undefined ? (managed_department_id ? parseInt(managed_department_id, 10) : null) : p.managed_department_id,
          updated_at,
          targetId
        ]
      );

      const updatedRows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      const updatedPerson = updatedRows[0];
      delete updatedPerson.password;
      updatedPerson.is_active = updatedPerson.is_active === 1 || updatedPerson.is_active === true;
      updatedPerson.department_id = updatedPerson.department_id !== null && updatedPerson.department_id !== undefined ? Number(updatedPerson.department_id) : null;
      updatedPerson.managed_department_id = updatedPerson.managed_department_id !== null && updatedPerson.managed_department_id !== undefined ? Number(updatedPerson.managed_department_id) : null;
      const roleChanged = role && role !== p.role;
      if (roleChanged) {
        await logToAudit("ROLE_CHANGE", "people", targetId, p.role, role);
      }
      await logToAudit("EMPLOYEE_UPDATE", "people", targetId, oldPersonCopy, updatedPerson);
      return jsonResponse(200, updatedPerson);
    } else {
      const db = readDatabase();
      const p = db.people.find(item => item.id === targetId);
      if (!p) return jsonResponse(404, { error: "Person record not found" });

      if ((isProtectedUser(p) || targetId === 1) && authUser?.role !== "admin") {
        return jsonResponse(403, { error: "Protected System Administrator account is untouchable and cannot be modified by Dietary Admin or other accounts." });
      }

      const {
        username, password, role, first_name, last_name, email, phone, is_active,
        employee_no, position, department_id, qr_code, employee_status, hire_date, managed_department_id
      } = body || {};

      if ((role === "admin" || body.is_protected === true || body.is_protected === 1 || body.protected === true || body.protected === 1) && authUser?.role !== "admin") {
        return jsonResponse(403, { error: "Only System Administrator can assign, manage, or create protected/admin accounts." });
      }

      if (department_id !== undefined && department_id !== null) {
        const deptIdNum = parseInt(department_id, 10);
        if (isNaN(deptIdNum)) return jsonResponse(400, { error: "Invalid Hospital Division ID / department_id format." });
        const deptExists = (db.departments || []).some(d => Number(d.id) === deptIdNum);
        if (!deptExists) {
          return jsonResponse(400, { error: `Data Integrity Violation: Assigned Hospital Division ID (department_id: ${deptIdNum}) does not match any valid department record in the registry.` });
        }
      }

      if (password && password.trim() !== "") {
        const minPassLenStr = await getSettingValue("min_password_length", String(DEFAULT_MIN_PASSWORD_LENGTH));
        const minPassLen = parseInt(minPassLenStr, 10) || DEFAULT_MIN_PASSWORD_LENGTH;
        const passValidationError = validatePasswordComplexity(password, minPassLen);
        if (passValidationError) return jsonResponse(400, { error: passValidationError });
      }

      if (username && username.trim().toLowerCase() !== p.username.toLowerCase()) {
        const exists = db.people.some(item => item.username.toLowerCase() === username.trim().toLowerCase());
        if (exists) return jsonResponse(400, { error: "Username already taken" });
        p.username = username.trim();
      }

      if (employee_no && employee_no.trim() !== p.employee_no) {
        const exists = db.people.some(item => item.employee_no === employee_no.trim());
        if (exists) return jsonResponse(400, { error: "Employee Number already exists" });
        p.employee_no = employee_no.trim();
      }

      if (qr_code && qr_code.trim() !== p.qr_code) {
        const exists = db.people.some(item => item.qr_code === qr_code.trim());
        if (exists) return jsonResponse(400, { error: "QR code already registered" });
        p.qr_code = qr_code.trim();
      }

      if (password && password.trim() !== "") {
        p.password = hashPassword(password);
      }

      const oldPersonCopy = { ...p };
      delete oldPersonCopy.password;

      if (role) {
        p.role = role;
        if (role === "admin") {
          p.is_protected = true;
          p.protected = true;
        }
      }
      if (first_name) p.first_name = first_name.trim();
      if (last_name) p.last_name = last_name.trim();
      if (email !== undefined) p.email = email ? email.trim() : null;
      if (phone !== undefined) p.phone = phone ? phone.trim() : null;
      if (is_active !== undefined) p.is_active = is_active;
      if (position !== undefined) p.position = position ? position.trim() : null;
      if (department_id !== undefined) p.department_id = department_id ? parseInt(department_id, 10) : null;
      if (employee_status !== undefined) p.employee_status = employee_status;
      if (hire_date !== undefined) p.hire_date = hire_date || null;
      if (managed_department_id !== undefined) p.managed_department_id = managed_department_id ? parseInt(managed_department_id, 10) : null;

      if (authUser?.role === "admin") {
        if (body.is_protected !== undefined) p.is_protected = body.is_protected === true || body.is_protected === 1;
        if (body.protected !== undefined) p.protected = body.protected === true || body.protected === 1;
      }

      p.updated_at = new Date().toISOString();
      writeDatabase(db);

      const safeP = { ...p };
      delete safeP.password;
      const roleChanged = role && role !== oldPersonCopy.role;
      if (roleChanged) {
        await logToAudit("ROLE_CHANGE", "people", targetId, oldPersonCopy.role, role);
      }
      await logToAudit("EMPLOYEE_UPDATE", "people", targetId, oldPersonCopy, safeP);
      return jsonResponse(200, safeP);
    }
  }

  if (personMatch && method === "DELETE") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const targetId = parseInt(personMatch[1], 10);

    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM people WHERE id = ?", [targetId]);
      if (rows.length === 0) return jsonResponse(404, { error: "Person not found" });
      const targetP = rows[0];
      if (targetId === 1 || isProtectedUser(targetP)) {
        if (authUser?.role !== "admin") {
          return jsonResponse(403, { error: "Protected System Administrator account is untouchable and cannot be deleted by Dietary Admin or other accounts." });
        }
        if (targetId === 1) {
          return jsonResponse(403, { error: "Primary System Administrator account (ID: 1) is protected and can never be deleted." });
        }
      }

      const hasTransactionsRows = await query(
        "SELECT id FROM transactions WHERE person_id = ? OR cashier_person_id = ? LIMIT 1",
        [targetId, targetId]
      );

      if (hasTransactionsRows.length > 0) {
        await execute("UPDATE people SET is_active = 0, employee_status = 'inactive' WHERE id = ?", [targetId]);
        const todayStr = new Date().toISOString().split('T')[0];
        await execute("DELETE FROM employee_schedules WHERE person_id = ? AND work_date >= ?", [targetId, todayStr]);
        await logToAudit("EMPLOYEE_DEACTIVATE", "people", targetId, null, "Account deactivated gracefully due to active transaction receipts. Future schedules purged.");
        return jsonResponse(200, { message: "Person has active transaction receipts. Gracefully deactivated account and purged future schedules to preserve database integrity." });
      }

      await execute("DELETE FROM people WHERE id = ?", [targetId]);
      await execute("DELETE FROM employee_schedules WHERE person_id = ?", [targetId]);
      await execute("DELETE FROM free_meal_logs WHERE person_id = ?", [targetId]);
      await logToAudit("EMPLOYEE_DELETE", "people", targetId, null, "Employee record deleted permanently from database.");
      return jsonResponse(200, { message: "Person deleted successfully" });
    } else {
      const db = readDatabase();
      const index = db.people.findIndex(item => item.id === targetId);
      if (index === -1) return jsonResponse(404, { error: "Person not found" });
      const targetP = db.people[index];

      if (targetId === 1 || isProtectedUser(targetP)) {
        if (authUser?.role !== "admin") {
          return jsonResponse(403, { error: "Protected System Administrator account is untouchable and cannot be deleted by Dietary Admin or other accounts." });
        }
        if (targetId === 1) {
          return jsonResponse(403, { error: "Primary System Administrator account (ID: 1) is protected and can never be deleted." });
        }
      }

      const hasTransactions = db.transactions.some(t => t.person_id === targetId || t.cashier_person_id === targetId);
      if (hasTransactions) {
        db.people[index].is_active = false;
        db.people[index].employee_status = "inactive";
        const todayStr = new Date().toISOString().split('T')[0];
        db.employee_schedules = db.employee_schedules.filter(s => !(s.person_id === targetId && s.work_date >= todayStr));
        writeDatabase(db);
        await logToAudit("EMPLOYEE_DEACTIVATE", "people", targetId, null, "Account deactivated gracefully due to active transaction receipts. Future schedules purged.");
        return jsonResponse(200, { message: "Person has active transaction receipts. Gracefully deactivated account and purged future schedules to preserve database integrity." });
      }

      db.people.splice(index, 1);
      db.employee_schedules = db.employee_schedules.filter(s => s.person_id !== targetId);
      db.free_meal_log = db.free_meal_log.filter(f => f.person_id !== targetId);
      
      writeDatabase(db);
      await logToAudit("EMPLOYEE_DELETE", "people", targetId, null, "Employee record deleted permanently from database.");
      return jsonResponse(200, { message: "Person deleted successfully" });
    }
  }

  // Admin People Collection (GET list, POST create)
  if (path === "/api/admin/people" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin", "manager"])) return jsonResponse(403, { error: "Admin or Manager privilege required" });
    const { role_filter, department_id } = queryParams;

    const totalTimer = startTimer();
    let dbLatencyMs = 0;
    let joinLatencyMs = 0;
    let recordsProcessed = 0;
    let matchedDepartments = 0;
    let unmatchedDepartments = 0;
    const warnings: string[] = [];

    if (isMysqlConnected()) {
      const dbTimer = startTimer();
      let q = "SELECT p.*, d.name AS department_name FROM people p LEFT JOIN departments d ON p.department_id = d.id WHERE 1=1";
      const params: any[] = [];
      if (role_filter) { q += " AND p.role = ?"; params.push(role_filter); }
      if (department_id) { q += " AND p.department_id = ?"; params.push(department_id); }
      q += " ORDER BY p.id DESC";
      const rows = await query(q, params);
      dbLatencyMs = dbTimer();

      const joinTimer = startTimer();
      recordsProcessed = rows.length;
      rows.forEach(r => {
        delete r.password;
        if (r.department_name && r.department_name !== "N/A") {
          matchedDepartments++;
        } else if (r.department_id) {
          unmatchedDepartments++;
          warnings.push(`User ${r.id} (${r.username}) has department_id ${r.department_id} but no matching department row in MySQL`);
        }
      });
      joinLatencyMs = joinTimer();

      const totalLatencyMs = totalTimer();
      const metric = recordEmployeePerfMetric({
        endpoint: "/api/admin/people",
        method: "GET",
        dbType: "mysql",
        totalLatencyMs,
        dbLatencyMs,
        joinLatencyMs,
        recordsProcessed,
        matchedDepartments,
        unmatchedDepartments,
        warnings
      });

      return jsonResponse(200, rows, undefined, getPerfHeaders(metric));
    } else {
      const dbTimer = startTimer();
      const db = readDatabase();
      let list = [...(db.people || [])];
      dbLatencyMs = dbTimer();

      const joinTimer = startTimer();
      if (role_filter) list = list.filter(p => p.role === role_filter);
      if (department_id) list = list.filter(p => p.department_id?.toString() === department_id);

      recordsProcessed = list.length;
      const mapped = list.map(p => {
        const dept = p.department_id ? db.departments?.find(d => Number(d.id) === Number(p.department_id)) : null;
        if (dept) {
          matchedDepartments++;
        } else if (p.department_id) {
          unmatchedDepartments++;
          warnings.push(`User ${p.id} (${p.username}) has department_id ${p.department_id} but no matching department in db.departments`);
        }
        const cp = { ...p };
        delete cp.password;
        return { ...cp, department_name: dept ? dept.name : "N/A" };
      });
      joinLatencyMs = joinTimer();

      const totalLatencyMs = totalTimer();
      const metric = recordEmployeePerfMetric({
        endpoint: "/api/admin/people",
        method: "GET",
        dbType: "sqlite",
        totalLatencyMs,
        dbLatencyMs,
        joinLatencyMs,
        recordsProcessed,
        matchedDepartments,
        unmatchedDepartments,
        warnings
      });

      return jsonResponse(200, mapped.reverse(), undefined, getPerfHeaders(metric));
    }
  }

  if (path === "/api/admin/people" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const {
      username, password, role, first_name, last_name, email, phone, employee_no,
      position, department_id, qr_code, employee_status, hire_date, is_active, managed_department_id
    } = body || {};

    console.log("DEBUG: handleCreateEmployee (backend) - body payload:", JSON.stringify(body, null, 2));

    console.log("DEBUG: POST /api/admin/people payload:", JSON.stringify(body, null, 2));

    if ((role === "admin" || body.is_protected === true || body.is_protected === 1 || body.protected === true || body.protected === 1) && authUser?.role !== "admin") {
      return jsonResponse(403, { error: "Only System Administrator can assign, manage, or create protected/admin accounts." });
    }

    if (!username || !username.trim()) return jsonResponse(400, { error: "Username is required" });
    if (!first_name || !first_name.trim()) return jsonResponse(400, { error: "First name is required" });
    if (!last_name || !last_name.trim()) return jsonResponse(400, { error: "Last name is required" });

    const deptId = department_id ? parseInt(department_id, 10) : 1;
    // Removed error return for null department_id, defaulting to 1 instead.

    const passToHash = password && password.trim() !== "" ? password : "TempPassword123!";
    const minPassLenStr = await getSettingValue("min_password_length", String(DEFAULT_MIN_PASSWORD_LENGTH));
    const minPassLen = parseInt(minPassLenStr, 10) || DEFAULT_MIN_PASSWORD_LENGTH;
    const passError = validatePasswordComplexity(passToHash, minPassLen);
    if (passError) return jsonResponse(400, { error: passError });

    const nowStr = new Date().toISOString();
    const finalRole = role || "employee";
    const finalActive = is_active !== undefined ? (is_active ? 1 : 0) : 1;
    const finalEmpNo = employee_no ? employee_no.trim() : `EMP${Math.floor(1000 + Math.random() * 9000)}`;
    const finalQr = qr_code ? qr_code.trim() : finalEmpNo;

    if (isMysqlConnected()) {
      const uCheck = await query("SELECT id FROM people WHERE LOWER(username) = ?", [username.trim().toLowerCase()]);
      if (uCheck.length > 0) return jsonResponse(400, { error: "Username already taken" });
      const eCheck = await query("SELECT id FROM people WHERE employee_no = ?", [finalEmpNo]);
      if (eCheck.length > 0) return jsonResponse(400, { error: "Employee Number already exists" });

      const maxRows = await query("SELECT MAX(id) as maxId FROM people");
      const nextId = (maxRows[0]?.maxId || 0) + 1;
      const hashed = hashPassword(passToHash);

      await execute(
        `INSERT INTO people (id, username, password, role, first_name, last_name, email, phone, is_active, employee_no, position, department_id, qr_code, employee_status, hire_date, managed_department_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextId, username.trim(), hashed, finalRole, first_name.trim(), last_name.trim(),
          email ? email.trim() : null, phone ? phone.trim() : null, finalActive, finalEmpNo,
          position ? position.trim() : null, deptId,
          finalQr, employee_status || "active", hire_date || nowStr.split("T")[0],
          managed_department_id ? parseInt(managed_department_id, 10) : null, nowStr, nowStr
        ]
      );

      const newRows = await query("SELECT * FROM people WHERE id = ?", [nextId]);
      const createdPerson = newRows[0];
      delete createdPerson.password;
      await logToAudit("EMPLOYEE_CREATE", "people", nextId, null, createdPerson);
      return jsonResponse(200, createdPerson);
    } else {
      const db = readDatabase();
      if (!db.people) db.people = [];
      const existsU = db.people.some(p => p.username.toLowerCase() === username.trim().toLowerCase());
      if (existsU) return jsonResponse(400, { error: "Username already taken" });
      const existsE = db.people.some(p => p.employee_no === finalEmpNo);
      if (existsE) return jsonResponse(400, { error: "Employee Number already exists" });

      const nextId = db.people.length > 0 ? Math.max(...db.people.map(p => p.id)) + 1 : 1;
      const hashed = hashPassword(passToHash);

      const newPerson: Person = {
        id: nextId,
        username: username.trim(),
        password: hashed,
        role: finalRole,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        is_active: Boolean(finalActive),
        employee_no: finalEmpNo,
        position: position ? position.trim() : null,
        department_id: deptId,
        qr_code: finalQr,
        employee_status: employee_status || "active",
        hire_date: hire_date || nowStr.split("T")[0],
        managed_department_id: managed_department_id ? parseInt(managed_department_id, 10) : null,
        is_protected: body.is_protected === true || body.is_protected === 1 || finalRole === "admin",
        protected: body.protected === true || body.protected === 1 || finalRole === "admin",
        created_at: nowStr,
        updated_at: nowStr
      };

      db.people.push(newPerson);
      writeDatabase(db);

      const safeCopy = { ...newPerson };
      delete (safeCopy as any).password;
      await logToAudit("EMPLOYEE_CREATE", "people", nextId, null, safeCopy);
      return jsonResponse(200, safeCopy);
    }
  }

  // Employee Individual Dashboard APIs
  if (path === "/api/employee/dashboard-data" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    const todayStr = new Date().toISOString().split("T")[0];
    let freeClaimedToday = false;
    let totalFreeClaimed = 0;
    let totalPaidPurchased = 0;
    let transactions: any[] = [];

    if (isMysqlConnected()) {
      const freeRows = await query("SELECT * FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [authUser.id, todayStr]);
      freeClaimedToday = freeRows.length > 0;

      const allTrans = await query("SELECT * FROM transactions WHERE person_id = ? AND status = 'completed'", [authUser.id]);
      allTrans.forEach(t => {
        if (t.is_free === 1 || t.is_free === true) totalFreeClaimed++;
        else totalPaidPurchased++;
      });
      transactions = allTrans.slice(-10).reverse();
    } else {
      const db = readDatabase();
      freeClaimedToday = (db.free_meal_log || []).some(f => f.person_id === authUser.id && f.meal_date === todayStr);
      const userTrans = db.transactions.filter(t => t.person_id === authUser.id && t.status === "completed");
      userTrans.forEach(t => {
        if (t.is_free) totalFreeClaimed++;
        else totalPaidPurchased++;
      });
      transactions = userTrans.slice(-10).reverse();
    }

    return jsonResponse(200, {
      freeClaimedToday,
      totalFreeClaimed,
      totalPaidPurchased,
      qr_code: authUser.qr_code,
      recentTransactions: transactions
    });
  }

  if (path === "/api/employee/schedules" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM employee_schedules WHERE person_id = ? ORDER BY work_date DESC", [authUser.id]);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const list = (db.employee_schedules || []).filter(s => s.person_id === authUser.id);
      return jsonResponse(200, list);
    }
  }

  if (path === "/api/employee/meals" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM transactions WHERE person_id = ? ORDER BY id DESC LIMIT 100", [authUser.id]);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const list = (db.transactions || []).filter(t => t.person_id === authUser.id).reverse().slice(0, 100);
      return jsonResponse(200, list);
    }
  }

  if (path === "/api/employee/qr-signed" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    return jsonResponse(200, { success: true, qr_code: authUser.qr_code, employee_no: authUser.employee_no, name: `${authUser.first_name} ${authUser.last_name}` });
  }

  // Manager APIs
  const managedDepartmentId = authUser ? (authUser.managed_department_id || authUser.department_id) : undefined;
  const mgrEmpMeals = path.match(/^\/api\/manager\/employee-meals\/(\d+)$/);
  if (mgrEmpMeals && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin session required" });
    const employeeId = parseInt(mgrEmpMeals[1], 10);
    
    if (isMysqlConnected()) {
      const peopleRows = await query("SELECT * FROM people WHERE id = ?", [employeeId]);
      const emp = peopleRows[0];
      if (!emp) return jsonResponse(404, { error: "Employee profile not found" });

      if (emp.department_id !== managedDepartmentId && authUser.role !== "admin") {
        return jsonResponse(403, { error: "Department isolation: Cannot query records for other departments." });
      }

      const empTrans = await query("SELECT * FROM transactions WHERE person_id = ? ORDER BY id DESC", [employeeId]);
      const mappedTrans = empTrans.map(t => ({
        ...t,
        is_free: t.is_free === 1 || t.is_free === true,
        meal_amount: Number(t.meal_amount)
      }));
      return jsonResponse(200, mappedTrans);
    } else {
      const db = readDatabase();
      const emp = db.people.find(p => p.id === employeeId);
      if (!emp) return jsonResponse(404, { error: "Employee profile not found" });

      if (emp.department_id !== managedDepartmentId && authUser.role !== "admin") {
        return jsonResponse(403, { error: "Department isolation: Cannot query records for other departments." });
      }

      const empTrans = db.transactions.filter(t => t.person_id === employeeId).sort((a, b) => b.id - a.id);
      return jsonResponse(200, empTrans);
    }
  }

  if (path === "/api/manager/stats" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });
    
    let totalEmployees = 0;
    let activeEmployees = 0;
    let todayFreeCount = 0;
    let scheduledToday = 0;
    let consumedToday = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const empCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee'");
        totalEmployees = empCount[0]?.cnt || 0;
        const actCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND is_active = 1");
        activeEmployees = actCount[0]?.cnt || 0;
        
        const schedRes = await query("SELECT COUNT(*) as cnt FROM employee_schedules WHERE work_date = ?", [todayStr]);
        scheduledToday = schedRes[0]?.cnt || 0;

        const freeT = await query("SELECT COUNT(*) as cnt FROM transactions t JOIN people p ON t.person_id = p.id WHERE t.meal_date = ? AND t.is_free = 1 AND t.status = 'completed'", [todayStr]);
        todayFreeCount = freeT[0]?.cnt || 0;

        const totalT = await query("SELECT COUNT(*) as cnt FROM transactions t JOIN people p ON t.person_id = p.id WHERE t.meal_date = ? AND t.status = 'completed'", [todayStr]);
        consumedToday = totalT[0]?.cnt || 0;
      } else {
        const empCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND department_id = ?", [managedDepartmentId]);
        totalEmployees = empCount[0]?.cnt || 0;
        const actCount = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND department_id = ? AND is_active = 1", [managedDepartmentId]);
        activeEmployees = actCount[0]?.cnt || 0;

        const schedRes = await query("SELECT COUNT(*) as cnt FROM employee_schedules s JOIN people p ON s.person_id = p.id WHERE p.department_id = ? AND s.work_date = ?", [managedDepartmentId, todayStr]);
        scheduledToday = schedRes[0]?.cnt || 0;

        const freeT = await query("SELECT COUNT(*) as cnt FROM transactions t JOIN people p ON t.person_id = p.id WHERE p.department_id = ? AND t.meal_date = ? AND t.is_free = 1 AND t.status = 'completed'", [managedDepartmentId, todayStr]);
        todayFreeCount = freeT[0]?.cnt || 0;

        const totalT = await query("SELECT COUNT(*) as cnt FROM transactions t JOIN people p ON t.person_id = p.id WHERE p.department_id = ? AND t.meal_date = ? AND t.status = 'completed'", [managedDepartmentId, todayStr]);
        consumedToday = totalT[0]?.cnt || 0;
      }
    } else {
      const db = readDatabase();
      const emps = db.people.filter(p => p.role === "employee" && (authUser.role === "admin" || p.department_id === managedDepartmentId));
      totalEmployees = emps.length;
      activeEmployees = emps.filter(p => p.is_active).length;
      const empIds = new Set(emps.map(e => e.id));

      scheduledToday = (db.employee_schedules || []).filter(s => s.work_date === todayStr && empIds.has(s.person_id)).length;
      todayFreeCount = db.transactions.filter(t => t.meal_date === todayStr && t.is_free && t.status === "completed" && empIds.has(t.person_id)).length;
      consumedToday = db.transactions.filter(t => t.meal_date === todayStr && t.status === "completed" && empIds.has(t.person_id)).length;
    }

    return jsonResponse(200, {
      totalEmployees,
      activeEmployees,
      departmentStaffCount: totalEmployees,
      scheduledToday,
      consumedToday,
      freeMealsClaimed: todayFreeCount,
      todayFreeCount,
      managedDepartmentId
    });
  }

  if (path === "/api/manager/department" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });
    if (!managedDepartmentId && authUser.role !== "admin") return jsonResponse(404, { error: "No managed department assigned" });

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const rows = await query("SELECT * FROM departments");
        return jsonResponse(200, rows);
      } else {
        const rows = await query("SELECT * FROM departments WHERE id = ?", [managedDepartmentId]);
        return jsonResponse(200, rows[0] || null);
      }
    } else {
      const db = readDatabase();
      if (authUser.role === "admin") {
        return jsonResponse(200, db.departments);
      } else {
        const dept = db.departments.find(d => d.id === managedDepartmentId);
        return jsonResponse(200, dept || null);
      }
    }
  }

  if (path === "/api/manager/employees" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });

    const totalTimer = startTimer();
    let dbLatencyMs = 0;
    let joinLatencyMs = 0;
    let recordsProcessed = 0;
    let matchedDepartments = 0;
    let unmatchedDepartments = 0;
    const warnings: string[] = [];

    if (isMysqlConnected()) {
      const dbTimer = startTimer();
      let rows: any[] = [];
      if (authUser.role === "admin") {
        rows = await query(`
          SELECT p.*, d.name AS department_name 
          FROM people p 
          LEFT JOIN departments d ON p.department_id = d.id 
          WHERE p.role = 'employee'
        `);
      } else {
        rows = await query(`
          SELECT p.*, d.name AS department_name 
          FROM people p 
          LEFT JOIN departments d ON p.department_id = d.id 
          WHERE p.role = 'employee' AND p.department_id = ?
        `, [managedDepartmentId]);
      }
      dbLatencyMs = dbTimer();

      const joinTimer = startTimer();
      recordsProcessed = rows.length;
      rows.forEach(r => {
        delete r.password;
        if (r.department_name && r.department_name !== "N/A") {
          matchedDepartments++;
        } else if (r.department_id) {
          unmatchedDepartments++;
          warnings.push(`User ${r.id} (${r.username}) missing dept in MySQL`);
        }
      });
      joinLatencyMs = joinTimer();

      const totalLatencyMs = totalTimer();
      const metric = recordEmployeePerfMetric({
        endpoint: "/api/manager/employees",
        method: "GET",
        dbType: "mysql",
        totalLatencyMs,
        dbLatencyMs,
        joinLatencyMs,
        recordsProcessed,
        matchedDepartments,
        unmatchedDepartments,
        warnings
      });

      return jsonResponse(200, rows, undefined, getPerfHeaders(metric));
    } else {
      const dbTimer = startTimer();
      const db = readDatabase();
      dbLatencyMs = dbTimer();

      const joinTimer = startTimer();
      const filtered = db.people.filter(p => p.role === "employee" && (authUser.role === "admin" || p.department_id === managedDepartmentId));
      recordsProcessed = filtered.length;
      const emps = filtered.map(p => {
        const dept = p.department_id ? db.departments?.find(d => Number(d.id) === Number(p.department_id)) : null;
        if (dept) {
          matchedDepartments++;
        } else if (p.department_id) {
          unmatchedDepartments++;
          warnings.push(`User ${p.id} (${p.username}) missing dept in JSON db`);
        }
        const cp = { ...p };
        delete cp.password;
        return { ...cp, department_name: dept ? dept.name : "N/A" };
      });
      joinLatencyMs = joinTimer();

      const totalLatencyMs = totalTimer();
      const metric = recordEmployeePerfMetric({
        endpoint: "/api/manager/employees",
        method: "GET",
        dbType: "sqlite",
        totalLatencyMs,
        dbLatencyMs,
        joinLatencyMs,
        recordsProcessed,
        matchedDepartments,
        unmatchedDepartments,
        warnings
      });

      return jsonResponse(200, emps, undefined, getPerfHeaders(metric));
    }
  }

  if (path === "/api/manager/employee-schedules" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });

    if (isMysqlConnected()) {
      if (authUser.role === "admin") {
        const rows = await query(`
          SELECT s.*, CONCAT(p.first_name, ' ', p.last_name) AS employee_name 
          FROM employee_schedules s 
          JOIN people p ON s.person_id = p.id 
          WHERE p.is_active = 1
        `);
        return jsonResponse(200, rows);
      } else {
        const rows = await query(`
          SELECT s.*, CONCAT(p.first_name, ' ', p.last_name) AS employee_name 
          FROM employee_schedules s 
          JOIN people p ON s.person_id = p.id 
          WHERE p.department_id = ? AND p.is_active = 1
        `, [managedDepartmentId]);
        return jsonResponse(200, rows);
      }
    } else {
      const db = readDatabase();
      const empIds = new Set(db.people.filter(p => (authUser.role === "admin" || p.department_id === managedDepartmentId) && p.is_active).map(p => p.id));
      const schedules = (db.employee_schedules || []).filter(s => empIds.has(s.person_id)).map(s => {
        const p = db.people.find(item => item.id === s.person_id);
        return {
          ...s,
          employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown"
        };
      });
      return jsonResponse(200, schedules);
    }
  }

  if (path === "/api/manager/batch-schedules" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["manager", "admin"])) return jsonResponse(403, { error: "Manager/Admin privilege required" });
    const { updates } = body || {};
    if (!Array.isArray(updates)) return jsonResponse(400, { error: "Updates array required" });

    const nowStr = new Date().toISOString();
    if (isMysqlConnected()) {
      for (const item of updates) {
        const { person_id, work_date, shift_type, action } = item;
        if (action === "remove") {
          await execute("DELETE FROM employee_schedules WHERE person_id = ? AND work_date = ?", [person_id, work_date]);
        } else if (action === "add" || action === "update") {
          const p = await query("SELECT is_active FROM people WHERE id = ?", [person_id]);
          if (p.length === 0 || !p[0].is_active) {
             return jsonResponse(400, { error: "Cannot schedule inactive employee" });
          }
          const check = await query("SELECT id FROM employee_schedules WHERE person_id = ? AND work_date = ?", [person_id, work_date]);
          if (check.length > 0) {
            await execute("UPDATE employee_schedules SET shift_type = ? WHERE person_id = ? AND work_date = ?", [shift_type || "day", person_id, work_date]);
          } else {
            const rows = await query("SELECT MAX(id) as maxId FROM employee_schedules");
            const nextId = (rows[0]?.maxId || 0) + 1;
            await execute("INSERT INTO employee_schedules (id, person_id, work_date, shift_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", [nextId, person_id, work_date, shift_type || "day", authUser.id, nowStr]);
          }
        }
      }
      await logToAudit("BATCH_SCHEDULE_UPDATE", "employee_schedules", null, null, `${updates.length} schedules updated`);
      return jsonResponse(200, { success: true, message: "Schedules updated successfully" });
    } else {
      const db = readDatabase();
      if (!db.employee_schedules) db.employee_schedules = [];
      for (const item of updates) {
        const { person_id, work_date, shift_type, action } = item;
        if (action === "remove") {
          db.employee_schedules = db.employee_schedules.filter(s => !(s.person_id === person_id && s.work_date === work_date));
        } else {
          const existing = db.employee_schedules.find(s => s.person_id === person_id && s.work_date === work_date);
          if (existing) {
            existing.shift_type = shift_type || "day";
          } else {
            const p = db.people.find(person => person.id === person_id);
            if (!p || !p.is_active) {
                return jsonResponse(400, { error: "Cannot schedule inactive employee" });
            }
            const nextId = db.employee_schedules.length > 0 ? Math.max(...db.employee_schedules.map(s => s.id)) + 1 : 1;
            db.employee_schedules.push({
              id: nextId,
              person_id,
              work_date,
              shift_type: shift_type || "day",
              created_by: authUser.id,
              created_at: nowStr
            });
          }
        }
      }
      writeDatabase(db);
      await logToAudit("BATCH_SCHEDULE_UPDATE", "employee_schedules", null, null, `${updates.length} schedules updated`);
      return jsonResponse(200, { success: true, message: "Schedules updated successfully" });
    }
  }

  return null;
}
