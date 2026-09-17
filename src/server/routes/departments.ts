import { jsonResponse, ApiResponse } from "../utils/apiUtils.js";
import { readDatabase, writeDatabase } from "../db.js";
import { isMysqlConnected, query, execute } from "../mysql.js";
import { Person } from "../../types.js";

export async function handleDepartmentRoutes(
  method: string,
  path: string,
  body: any,
  headers: any,
  authUser: Person | null,
  requireRole: (roles: string[]) => boolean,
  logToAudit: (action: string, entityType: string, entityId: any, oldData: any, newData: any) => Promise<void>
): Promise<ApiResponse | null> {
  if (path === "/api/departments" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM departments ORDER BY name ASC");
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      return jsonResponse(200, db.departments || []);
    }
  }

  if (path === "/api/departments" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const { name } = body || {};
    if (!name || !name.trim()) return jsonResponse(400, { error: "Department name is required" });

    const nowStr = new Date().toISOString();
    if (isMysqlConnected()) {
      const exists = await query("SELECT id FROM departments WHERE LOWER(name) = ?", [name.trim().toLowerCase()]);
      if (exists.length > 0) return jsonResponse(400, { error: "Department with this name already exists" });

      const maxRows = await query("SELECT MAX(id) as maxId FROM departments");
      const nextId = (maxRows[0]?.maxId || 0) + 1;
      await execute("INSERT INTO departments (id, name, created_at) VALUES (?, ?, ?)", [nextId, name.trim(), nowStr]);
      const newRows = await query("SELECT * FROM departments WHERE id = ?", [nextId]);
      await logToAudit("DEPARTMENT_CREATE", "departments", nextId, null, newRows[0]);
      return jsonResponse(201, { success: true, department: newRows[0] });
    } else {
      const db = readDatabase();
      if (!db.departments) db.departments = [];
      const exists = db.departments.some((d: any) => d.name.toLowerCase() === name.trim().toLowerCase());
      if (exists) return jsonResponse(400, { error: "Department with this name already exists" });

      const nextId = db.departments.length > 0 ? Math.max(...db.departments.map((d: any) => d.id)) + 1 : 1;
      const newDept = { id: nextId, name: name.trim(), created_at: nowStr };
      db.departments.push(newDept);
      writeDatabase(db);
      await logToAudit("DEPARTMENT_CREATE", "departments", nextId, null, newDept);
      return jsonResponse(201, { success: true, department: newDept });
    }
  }

  const deptMatch = path.match(/^\/api\/departments\/(\d+)$/);
  if (deptMatch && method === "PUT") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const deptId = parseInt(deptMatch[1], 10);
    const { name } = body || {};
    if (!name || !name.trim()) return jsonResponse(400, { error: "Department name is required" });

    if (isMysqlConnected()) {
      const exists = await query("SELECT id FROM departments WHERE LOWER(name) = ? AND id != ?", [name.trim().toLowerCase(), deptId]);
      if (exists.length > 0) return jsonResponse(400, { error: "Department with this name already exists" });

      const deptRows = await query("SELECT * FROM departments WHERE id = ?", [deptId]);
      if (deptRows.length === 0) return jsonResponse(404, { error: "Department not found" });

      await execute("UPDATE departments SET name = ? WHERE id = ?", [name.trim(), deptId]);
      const updatedRows = await query("SELECT * FROM departments WHERE id = ?", [deptId]);
      await logToAudit("DEPARTMENT_UPDATE", "departments", deptId, deptRows[0], updatedRows[0]);
      return jsonResponse(200, { success: true, department: updatedRows[0] });
    } else {
      const db = readDatabase();
      const exists = (db.departments || []).some((d: any) => d.name.toLowerCase() === name.trim().toLowerCase() && d.id !== deptId);
      if (exists) return jsonResponse(400, { error: "Department with this name already exists" });

      const index = (db.departments || []).findIndex((d: any) => d.id === deptId);
      if (index === -1) return jsonResponse(404, { error: "Department not found" });

      const oldDept = { ...db.departments[index] };
      db.departments[index].name = name.trim();
      writeDatabase(db);
      await logToAudit("DEPARTMENT_UPDATE", "departments", deptId, oldDept, db.departments[index]);
      return jsonResponse(200, { success: true, department: db.departments[index] });
    }
  }
  if (deptMatch && method === "DELETE") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const deptId = parseInt(deptMatch[1], 10);

    if (isMysqlConnected()) {
      const usedRows = await query("SELECT id FROM people WHERE department_id = ?", [deptId]);
      if (usedRows.length > 0) return jsonResponse(400, { error: "Cannot delete department while personnel are assigned to it." });

      const deptRows = await query("SELECT * FROM departments WHERE id = ?", [deptId]);
      if (deptRows.length === 0) return jsonResponse(404, { error: "Department not found" });

      await execute("DELETE FROM departments WHERE id = ?", [deptId]);
      await logToAudit("DEPARTMENT_DELETE", "departments", deptId, deptRows[0], null);
      return jsonResponse(200, { success: true, message: "Department deleted successfully" });
    } else {
      const db = readDatabase();
      const isUsed = (db.people || []).some((p: Person) => p.department_id === deptId);
      if (isUsed) return jsonResponse(400, { error: "Cannot delete department while personnel are assigned to it." });

      const index = (db.departments || []).findIndex((d: any) => d.id === deptId);
      if (index === -1) return jsonResponse(404, { error: "Department not found" });

      const oldDept = db.departments[index];
      db.departments.splice(index, 1);
      writeDatabase(db);
      await logToAudit("DEPARTMENT_DELETE", "departments", deptId, oldDept, null);
      return jsonResponse(200, { success: true, message: "Department deleted successfully" });
    }
  }

  return null;
}
