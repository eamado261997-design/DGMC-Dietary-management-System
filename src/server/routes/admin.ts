import { jsonResponse, ApiResponse, getTodayDateStr } from "../utils/apiUtils.js";
import { readDatabase, writeDatabase } from "../db.js";
import { isMysqlConnected, query } from "../mysql.js";
import { cacheLayer } from "../cache.js";
import { isRedisClientConnected } from "../redis.js";
import { Person } from "../../types.js";
import { getEmployeePerfSummary } from "../utils/performanceTracker.js";
import { decrypt, decryptAny } from "../encryption.js";

// Short-lived in-memory cache for admin dashboard statistics
let cachedAdminStats: { data: any; exp: number } | null = null;
let cachedPm2Status: { status: string; exp: number } | null = null;

export function invalidateAdminStatsCache() {
  cachedAdminStats = null;
}

export async function handleAdminRoutes(
  method: string,
  path: string,
  body: any,
  headers: any,
  authUser: Person | null,
  queryParams: any,
  requireRole: (roles: string[]) => boolean
): Promise<ApiResponse | null> {
  // Field decryption utility for admin panel
  if (path === "/api/admin/decrypt-field" && method === "POST") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin", "manager"])) return jsonResponse(403, { error: "Admin privilege required" });
    const { ciphertext, fields } = body || {};
    if (fields && Array.isArray(fields)) {
      const decryptedMap: Record<string, string> = {};
      for (const item of fields) {
        if (item && item.field) {
          decryptedMap[item.field] = decrypt(item.value || "");
        }
      }
      return jsonResponse(200, { decrypted: decryptedMap });
    }
    const decrypted = decrypt(ciphertext);
    return jsonResponse(200, { decrypted });
  }

  // Employee Lookup Performance & Join Telemetry
  if (path === "/api/admin/employee-lookup-perf" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin", "manager"])) return jsonResponse(403, { error: "Admin privilege required" });
    const summary = getEmployeePerfSummary();
    return jsonResponse(200, summary);
  }

  // Public Stats
  if (path === "/api/public-stats" && method === "GET") {
    const cacheKey = "public_stats";
    const cachedStats = cacheLayer.get(cacheKey);
    if (cachedStats) {
      return jsonResponse(200, cachedStats);
    }

    let totalStaff = 0;
    let mealsProcessed = 0;
    let companyName = "Divine Grace Medical Center";
    let companyTagline = "Compassionate Care, Exceptional Service";
    let companyLogoUrl = "";
    let currencySymbol = "₱";
    let mealPrice = 150.00;
    let itSupportPhone = "Medical arts Bldg. 5th floor/ICT dept. / 2568";

    const todayStr = getTodayDateStr();

    if (isMysqlConnected()) {
      const staffRows = await query("SELECT COUNT(*) as cnt FROM people WHERE role = 'employee' AND is_active = 1");
      totalStaff = Number(staffRows[0]?.cnt || 0);
      const mealRows = await query("SELECT COUNT(*) as cnt FROM transactions WHERE meal_date = ? AND status = 'completed'", [todayStr]);
      mealsProcessed = Number(mealRows[0]?.cnt || 0);

      const settingsRows = await query("SELECT setting_key, setting_value FROM system_settings");
      const kv: Record<string, string> = {};
      settingsRows.forEach((row: any) => { kv[row.setting_key] = row.setting_value; });
      if (kv["company_name"]) companyName = kv["company_name"];
      if (kv["company_tagline"]) companyTagline = kv["company_tagline"];
      if (kv["company_logo_url"]) companyLogoUrl = kv["company_logo_url"];
      if (kv["currency_symbol"]) currencySymbol = kv["currency_symbol"];
      if (kv["meal_price"]) mealPrice = Number(kv["meal_price"]);
      if (kv["it_support_phone"]) itSupportPhone = kv["it_support_phone"];
    } else {
      const dbData = readDatabase();
      totalStaff = (dbData.people || []).filter(p => p.role === "employee" && p.is_active).length;
      mealsProcessed = (dbData.transactions || []).filter(t => t.meal_date === todayStr && t.status === "completed").length;

      const kv: Record<string, string> = {};
      (dbData.system_settings || []).forEach((s: any) => { kv[s.setting_key] = s.setting_value; });
      if (kv["company_name"]) companyName = kv["company_name"];
      if (kv["company_tagline"]) companyTagline = kv["company_tagline"];
      if (kv["company_logo_url"]) companyLogoUrl = kv["company_logo_url"];
      if (kv["currency_symbol"]) currencySymbol = kv["currency_symbol"];
      if (kv["meal_price"]) mealPrice = Number(kv["meal_price"]);
      if (kv["it_support_phone"]) itSupportPhone = kv["it_support_phone"];
    }

    const responsePayload = { 
      totalStaff, 
      mealsProcessed,
      companyName,
      companyTagline,
      companyLogoUrl,
      currencySymbol,
      mealPrice,
      itSupportPhone
    };
    cacheLayer.set(cacheKey, responsePayload, 15);
    return jsonResponse(200, responsePayload);
  }

  // API Docs
  if (path === "/api/docs" && method === "GET") {
    return jsonResponse(200, {
      service: "DGMC Hospital Cafeteria Management API",
      version: "2.5.0",
      routes: [
        { path: "/api/admin/stats", method: "GET", description: "Fetch admin dashboard statistics", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/reports/meals", method: "GET", description: "Fetch meals report logs", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/reports/employees", method: "GET", description: "Fetch employee summary report", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/reports/financial", method: "GET", description: "Fetch financial report summary", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/sys-health", method: "GET", description: "Fetch system diagnostics health", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/sys-perf", method: "GET", description: "Fetch API performance benchmarks", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/security-matrix-verify", method: "GET", description: "Verify RBAC security matrix", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/admin/people", method: "GET", description: "Manage personnel records", authenticationRequired: true, roles: ["admin"] },
        { path: "/api/auth/login", method: "POST", description: "Authenticate user and issue token", authenticationRequired: false },
        { path: "/api/auth/me", method: "GET", description: "Get current logged in user profile", authenticationRequired: true },
        { path: "/api/cashier/scan", method: "POST", description: "Process QR employee meal scan", authenticationRequired: true, roles: ["cashier", "admin"] }
      ]
    });
  }

  // Admin Stats
  if (path === "/api/admin/stats" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    const now = Date.now();
    if (cachedAdminStats && cachedAdminStats.exp > now) {
      return jsonResponse(200, cachedAdminStats.data, {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=5"
      });
    }

    const todayStr = getTodayDateStr();

    let totalPeople = 0;
    let totalEmployees = 0;
    let totalDepartments = 0;
    let freeMealsToday = 0;
    let cashMealsTodayCount = 0;
    let paidAmountToday = 0;
    let activeEmployees = 0;
    let pendingMealRequests = 0;
    let recentTransactions: any[] = [];
    let recentActivities: any[] = [];

    if (isMysqlConnected()) {
      const [countsResult, todayTransAgg, recTransRaw, auditRows, pendingRows] = await Promise.all([
        query(`
          SELECT 
            COUNT(*) AS totalPeople,
            SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) AS totalEmployees,
            SUM(CASE WHEN role = 'employee' AND is_active = 1 THEN 1 ELSE 0 END) AS activeEmployees,
            (SELECT COUNT(*) FROM departments) AS totalDepartments
          FROM people
        `),
        query(`
          SELECT 
            SUM(CASE WHEN is_free = 1 THEN 1 ELSE 0 END) AS freeMealsToday,
            SUM(CASE WHEN is_free = 0 OR is_free IS NULL THEN 1 ELSE 0 END) AS cashMealsTodayCount,
            SUM(CASE WHEN is_free = 0 OR is_free IS NULL THEN meal_amount ELSE 0 END) AS paidAmountToday
          FROM transactions
          WHERE meal_date = ? AND status = 'completed'
        `, [todayStr]),
        query(`
          SELECT t.*, 
                 p.first_name AS p_first_name, p.last_name AS p_last_name,
                 p.employee_no,
                 d.name AS department_name
          FROM transactions t
          LEFT JOIN people p ON t.person_id = p.id
          LEFT JOIN departments d ON p.department_id = d.id
          ORDER BY t.id DESC
          LIMIT 10
        `),
        query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10"),
        query(`
          SELECT COUNT(DISTINCT p.id) as cnt
          FROM people p
          JOIN employee_schedules s ON p.id = s.person_id
          WHERE p.role = 'employee' AND p.is_active = 1 AND s.work_date = ?
          AND p.id NOT IN (
            SELECT person_id FROM transactions WHERE meal_date = ? AND status = 'completed'
          )
        `, [todayStr, todayStr])
      ]);

      const counts = countsResult[0] || {};
      totalPeople = Number(counts.totalPeople || 0);
      totalEmployees = Number(counts.totalEmployees || 0);
      activeEmployees = Number(counts.activeEmployees || 0);
      totalDepartments = Number(counts.totalDepartments || 0);

      const transAgg = todayTransAgg[0] || {};
      freeMealsToday = Number(transAgg.freeMealsToday || 0);
      cashMealsTodayCount = Number(transAgg.cashMealsTodayCount || 0);
      paidAmountToday = Number(transAgg.paidAmountToday || 0);

      recentTransactions = (recTransRaw || []).map((t: any) => {
        const pFirst = decrypt(t.p_first_name);
        const pLast = decrypt(t.p_last_name);
        const empNo = decrypt(t.employee_no) || t.employee_no;
        return {
          ...t,
          employee_name: (pFirst || pLast) ? `${pFirst || ''} ${pLast || ''}`.trim() : "Unknown Employee",
          employee_no: empNo || "N/A"
        };
      });

      recentActivities = auditRows || [];
      pendingMealRequests = Number(pendingRows[0]?.cnt || 0);

    } else {
      const db = readDatabase();
      totalPeople = db.people.length;
      totalEmployees = db.people.filter(p => p.role === "employee").length;
      activeEmployees = db.people.filter(p => p.role === "employee" && p.is_active).length;
      totalDepartments = db.departments.length;

      const todayTrans = db.transactions.filter(t => t.meal_date === todayStr && t.status === "completed");
      todayTrans.forEach(t => {
        if (t.is_free) {
          freeMealsToday++;
        } else {
          cashMealsTodayCount++;
          paidAmountToday += Number(t.meal_amount || 0);
        }
      });

      recentTransactions = db.transactions.slice(-10).reverse().map(t => {
        const p = db.people.find(item => item.id === t.person_id);
        const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        return {
          ...t,
          employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
          employee_no: p ? p.employee_no : "N/A",
          department_name: dept ? dept.name : "N/A"
        };
      });

      recentActivities = (db.audit_logs || []).slice(-10).reverse();

      const activeEmps = db.people.filter(p => p.role === "employee" && p.is_active);
      const transactedPersonIds = new Set(todayTrans.map(t => t.person_id));
      pendingMealRequests = activeEmps.filter(p => {
        const hasSched = (db.employee_schedules || []).some(s => s.person_id === p.id && s.work_date === todayStr);
        return hasSched && !transactedPersonIds.has(p.id);
      }).length;
    }

    const payload = {
      totalPeople,
      totalDepartments,
      freeMealsToday,
      cashMealsTodayCount,
      paidAmountToday,
      activeEmployees,
      totalEmployees,
      pendingMealRequests,
      recentTransactions,
      recentActivities
    };

    // Cache for 5 seconds to eliminate burst load
    cachedAdminStats = {
      data: payload,
      exp: Date.now() + 5000
    };

    return jsonResponse(200, payload, {
      "Cache-Control": "private, max-age=5, stale-while-revalidate=5"
    });
  }

  // System Connectivity
  if (path === "/api/admin/system-connectivity" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    // 1. MySQL Status
    const mysqlStatus = isMysqlConnected();
    
    // 2. Redis Status
    const redisStatus = isRedisClientConnected() || cacheLayer.getIsRedisConnected();

    // 3. Node API Engine Status
    const engineStatus = "online";
    
    // 4. Telemetry Status
    const telemetryStatus = "active";

    // 5. PM2 Status Detection (fast path + in-memory cache to maintain sub-50ms TTFB)
    let pm2Status = "standalone";
    if (process.env.pm_id !== undefined || process.env.PM2_HOME !== undefined || process.env.exec_mode !== undefined) {
      const instanceId = process.env.pm_id ?? "0";
      pm2Status = `online (Worker #${instanceId})`;
    } else if (cachedPm2Status && cachedPm2Status.exp > Date.now()) {
      pm2Status = cachedPm2Status.status;
    } else {
      try {
        const { execSync } = await import('child_process');
        const pm2Bin = './node_modules/.bin/pm2';
        const fs = await import('fs');
        if (fs.existsSync(pm2Bin)) {
          const output = execSync(`${pm2Bin} jlist`, { encoding: 'utf-8', timeout: 500, stdio: ['ignore', 'pipe', 'ignore'] });
          const processes = JSON.parse(output);
          if (Array.isArray(processes) && processes.length > 0) {
            const online = processes.filter((p: any) => p.pm2_env?.status === 'online');
            pm2Status = online.length > 0 ? `online (${online.length} workers)` : 'stopped';
          }
        }
      } catch (e) {
        pm2Status = "standalone";
      }
      cachedPm2Status = { status: pm2Status, exp: Date.now() + 30000 };
    }

    return jsonResponse(200, {
        mysql: mysqlStatus ? "connected" : "disconnected",
        redis: redisStatus ? "connected" : "disconnected",
        engine: engineStatus,
        telemetry: telemetryStatus,
        pm2: pm2Status,
        timestamp: new Date().toISOString()
    });
  }


  // Reports - Meals
  if (path === "/api/admin/reports/meals" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin", "cashier", "manager"])) return jsonResponse(403, { error: "Staff privilege required" });

    const { startDate, endDate, isFree, departmentId } = queryParams;

    if (isMysqlConnected()) {
      let q = `
        SELECT t.*, 
               p.first_name AS p_first_name, p.last_name AS p_last_name,
               p.employee_no,
               d.name AS department_name,
               c.first_name AS c_first_name, c.last_name AS c_last_name
        FROM transactions t
        LEFT JOIN people p ON t.person_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN people c ON t.cashier_person_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (startDate) {
        q += " AND t.meal_date >= ?";
        params.push(startDate);
      }
      if (endDate) {
        q += " AND t.meal_date <= ?";
        params.push(endDate);
      }
      if (isFree !== undefined && isFree !== "") {
        const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
        q += " AND t.is_free = ?";
        params.push(freeBool ? 1 : 0);
      }
      if (departmentId && departmentId !== "") {
        q += " AND p.department_id = ?";
        params.push(parseInt(departmentId, 10));
      }
      q += " ORDER BY t.id DESC LIMIT 500";
      const rows = await query(q, params);
      const decryptedRows = rows.map((r: any) => {
        const pFirst = decrypt(r.p_first_name);
        const pLast = decrypt(r.p_last_name);
        const cFirst = decrypt(r.c_first_name);
        const cLast = decrypt(r.c_last_name);
        const empNo = decrypt(r.employee_no) || r.employee_no;
        return {
          ...r,
          employee_name: (pFirst || pLast) ? `${pFirst || ''} ${pLast || ''}`.trim() : "Unknown Employee",
          employee_no: empNo || "N/A",
          cashier_name: (cFirst || cLast) ? `${cFirst || ''} ${cLast || ''}`.trim() : "System"
        };
      });
      return jsonResponse(200, decryptedRows);
    } else {
      const db = readDatabase();
      let list = [...db.transactions];
      if (startDate) list = list.filter(t => (t.meal_date || (t.created_at ? t.created_at.substring(0, 10) : "")) >= startDate);
      if (endDate) list = list.filter(t => (t.meal_date || (t.created_at ? t.created_at.substring(0, 10) : "")) <= endDate);
      if (isFree !== undefined && isFree !== "") {
        const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
        list = list.filter(t => t.is_free === freeBool);
      }

      const enriched = list.map(t => {
        const p = db.people.find(item => item.id === t.person_id);
        const cashier = db.people.find(item => item.id === t.cashier_person_id);
        const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        const pFirst = p ? decrypt(p.first_name) : "";
        const pLast = p ? decrypt(p.last_name) : "";
        const cFirst = cashier ? decrypt(cashier.first_name) : "";
        const cLast = cashier ? decrypt(cashier.last_name) : "";
        const empNo = p ? (decrypt(p.employee_no) || p.employee_no) : "N/A";
        return {
          ...t,
          employee_name: p ? `${pFirst} ${pLast}`.trim() : "Unknown Employee",
          employee_no: empNo,
          department_name: dept ? dept.name : "N/A",
          department_id: p ? p.department_id : null,
          cashier_name: cashier ? `${cFirst} ${cLast}`.trim() : "System"
        };
      });

      let filtered = enriched;
      if (departmentId && departmentId !== "") {
        const depNum = parseInt(departmentId, 10);
        filtered = enriched.filter(t => t.department_id === depNum);
      }
      return jsonResponse(200, filtered.reverse().slice(0, 500));
    }
  }

  // Reports - Employees
  if (path === "/api/admin/reports/employees" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    if (isMysqlConnected()) {
      const rows = await query(`
        SELECT p.employee_no, p.first_name, p.last_name,
               d.name AS department_name, p.position, p.is_active,
               COUNT(CASE WHEN t.is_free = 1 AND t.status = 'completed' THEN 1 END) AS freeMealsClaimed,
               COUNT(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN 1 END) AS paidMealsPurchased,
               SUM(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN t.meal_amount ELSE 0 END) AS totalPaidAmount
        FROM people p
        LEFT JOIN departments d ON p.department_id = d.id
        LEFT JOIN transactions t ON p.id = t.person_id
        WHERE p.role = 'employee'
        GROUP BY p.id
        ORDER BY p.id ASC
      `);
      const decryptedRows = rows.map((p: any) => {
        const fName = decrypt(p.first_name);
        const lName = decrypt(p.last_name);
        const empNo = decrypt(p.employee_no) || p.employee_no;
        return {
          ...p,
          employee_no: empNo || "N/A",
          name: (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : "Unknown Staff"
        };
      });
      return jsonResponse(200, decryptedRows);
    } else {
      const db = readDatabase();
      const results = db.people.filter(p => p.role === "employee").map(p => {
        const empTrans = db.transactions.filter(t => t.person_id === p.id && t.status === "completed");
        const freeClaims = empTrans.filter(t => t.is_free).length;
        const paidClaims = empTrans.filter(t => !t.is_free).length;
        const totalSpent = empTrans.filter(t => !t.is_free).reduce((sum, t) => sum + Number(t.meal_amount), 0);
        const dept = p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
        const fName = decrypt(p.first_name);
        const lName = decrypt(p.last_name);
        const empNo = decrypt(p.employee_no) || p.employee_no;
        return {
          employee_no: empNo || "N/A",
          name: `${fName} ${lName}`.trim() || "Unknown Staff",
          department_name: dept ? dept.name : "N/A",
          position: p.position || "Staff",
          freeMealsClaimed: freeClaims,
          paidMealsPurchased: paidClaims,
          totalPaidAmount: totalSpent,
          is_active: p.is_active
        };
      });
      return jsonResponse(200, results);
    }
  }

  // Reports - Financial
  if (path === "/api/admin/reports/financial" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    if (isMysqlConnected()) {
      const rows = await query(`
        SELECT meal_date AS date,
               COUNT(CASE WHEN is_free = 1 THEN 1 END) AS freeCount,
               COUNT(CASE WHEN is_free = 0 OR is_free IS NULL THEN 1 END) AS paidCount,
               SUM(CASE WHEN is_free = 0 OR is_free IS NULL THEN meal_amount ELSE 0 END) AS totalPaidAmount
        FROM transactions
        WHERE status = 'completed'
        GROUP BY meal_date
        ORDER BY meal_date DESC
        LIMIT 100
      `);
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      const map: Record<string, { date: string; freeCount: number; paidCount: number; totalPaidAmount: number }> = {};
      db.transactions.filter(t => t.status === "completed").forEach(t => {
        const date = t.meal_date || "Unknown";
        if (!map[date]) {
          map[date] = { date, freeCount: 0, paidCount: 0, totalPaidAmount: 0 };
        }
        if (t.is_free) {
          map[date].freeCount++;
        } else {
          map[date].paidCount++;
          map[date].totalPaidAmount += Number(t.meal_amount || 0);
        }
      });
      const results = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
      return jsonResponse(200, results);
    }
  }

  // Batch QR export list
  if (path === "/api/admin/batch-qr-export" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "manager"])) return jsonResponse(403, { error: "Admin or Manager privilege required" });
    if (isMysqlConnected()) {
      const rows = await query("SELECT id, employee_no, first_name, last_name, qr_code FROM people WHERE role = 'employee'");
      const decryptedRows = rows.map((p: any) => ({
        id: p.id,
        employee_no: decrypt(p.employee_no) || p.employee_no,
        first_name: decrypt(p.first_name) || p.first_name,
        last_name: decrypt(p.last_name) || p.last_name,
        qr_code: decrypt(p.qr_code) || p.qr_code
      }));
      return jsonResponse(200, decryptedRows);
    } else {
      const db = readDatabase();
      const rows = db.people.filter(p => p.role === "employee").map(p => ({
        id: p.id,
        employee_no: decrypt(p.employee_no) || p.employee_no,
        first_name: decrypt(p.first_name) || p.first_name,
        last_name: decrypt(p.last_name) || p.last_name,
        qr_code: decrypt(p.qr_code) || p.qr_code
      }));
      return jsonResponse(200, rows);
    }
  }

  // Dynamic CSV export
  const exportMatch = path.match(/^\/api\/admin\/reports\/export\/([a-zA-Z0-9_\-]+)$/);
  if (exportMatch && method === "GET") {
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const type = exportMatch[1];
    
    let csvContent = "";
    const { startDate, endDate, isFree, departmentId } = queryParams;
    const db = readDatabase();

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      let s = String(val).trim();
      s = s.replace(/"/g, '""');
      return `"${s}"`;
    };
    
    if (isMysqlConnected()) {
      if (type === "meals") {
        csvContent = "Transaction ID,Meal Date,Meal Time,Employee Name,Employee No,Department,Free Claim?,Amount,Status,Cashier\n";
        let q = `
          SELECT t.*, 
                 p.first_name AS p_first_name, p.last_name AS p_last_name,
                 p.employee_no,
                 d.name AS department_name,
                 c.first_name AS c_first_name, c.last_name AS c_last_name
          FROM transactions t
          LEFT JOIN people p ON t.person_id = p.id
          LEFT JOIN departments d ON p.department_id = d.id
          LEFT JOIN people c ON t.cashier_person_id = c.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (startDate) { q += " AND t.meal_date >= ?"; params.push(startDate); }
        if (endDate) { q += " AND t.meal_date <= ?"; params.push(endDate); }
        if (isFree !== undefined && isFree !== "") {
          const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
          q += " AND t.is_free = ?";
          params.push(freeBool ? 1 : 0);
        }
        if (departmentId && departmentId !== "") {
          q += " AND p.department_id = ?";
          params.push(parseInt(departmentId, 10));
        }
        q += " ORDER BY t.id ASC";

        const rows = await query(q, params);
        rows.forEach((t: any) => {
          const isFreeYesNo = (t.is_free === 1 || t.is_free === true) ? "YES" : "NO";
          const pFirst = decrypt(t.p_first_name);
          const pLast = decrypt(t.p_last_name);
          const cFirst = decrypt(t.c_first_name);
          const cLast = decrypt(t.c_last_name);
          const empNo = decrypt(t.employee_no) || t.employee_no;
          const empName = (pFirst || pLast) ? `${pFirst || ''} ${pLast || ''}`.trim() : "Unknown";
          const cashName = (cFirst || cLast) ? `${cFirst || ''} ${cLast || ''}`.trim() : "System";
          csvContent += [
            t.id, t.meal_date, t.meal_time, empName, empNo || "N/A",
            t.department_name || "N/A", isFreeYesNo, Number(t.meal_amount || 0).toFixed(2), t.status, cashName
          ].map(escapeCsv).join(",") + "\n";
        });
      } else if (type === "employees") {
        csvContent = "Employee No,Name,Department,Position,Free Meals Claimed,Salary Deductions,Total Salary Deductions,Status\n";
        const rows = await query(`
          SELECT p.employee_no, p.first_name, p.last_name,
                 d.name AS department_name, p.position, p.is_active,
                 COUNT(CASE WHEN t.is_free = 1 AND t.status = 'completed' THEN 1 END) AS freeMealsClaimed,
                 COUNT(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN 1 END) AS paidMealsPurchased,
                 SUM(CASE WHEN (t.is_free = 0 OR t.is_free IS NULL) AND t.status = 'completed' THEN t.meal_amount ELSE 0 END) AS totalPaidAmount
          FROM people p
          LEFT JOIN departments d ON p.department_id = d.id
          LEFT JOIN transactions t ON p.id = t.person_id
          WHERE p.role = 'employee'
          GROUP BY p.id
          ORDER BY p.id ASC
        `);
        rows.forEach((p: any) => {
          const statusStr = (p.is_active === 1 || p.is_active === true) ? "Active" : "Inactive";
          const fName = decrypt(p.first_name);
          const lName = decrypt(p.last_name);
          const empNo = decrypt(p.employee_no) || p.employee_no;
          const name = (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : "Unknown";
          csvContent += [
            empNo || "N/A", name, p.department_name || "N/A", p.position || "Staff",
            Number(p.freeMealsClaimed || 0), Number(p.paidMealsPurchased || 0), Number(p.totalPaidAmount || 0).toFixed(2), statusStr
          ].map(escapeCsv).join(",") + "\n";
        });
      } else {
        csvContent = "Date,Free Meals Distributed,Salary Deductions,Total Salary Deductions\n";
        const rows = await query(`
          SELECT meal_date AS date,
                 COUNT(CASE WHEN is_free = 1 THEN 1 END) AS freeCount,
                 COUNT(CASE WHEN is_free = 0 OR is_free IS NULL THEN 1 END) AS paidCount,
                 SUM(CASE WHEN is_free = 0 OR is_free IS NULL THEN meal_amount ELSE 0 END) AS totalPaidAmount
          FROM transactions
          WHERE status = 'completed'
          GROUP BY meal_date
          ORDER BY meal_date ASC
        `);
        rows.forEach((r: any) => {
          csvContent += [
            r.date, Number(r.freeCount || 0), Number(r.paidCount || 0), Number(r.totalPaidAmount || 0).toFixed(2)
          ].map(escapeCsv).join(",") + "\n";
        });
      }
    } else {
      if (type === "meals") {
        csvContent = "Transaction ID,Meal Date,Meal Time,Employee Name,Employee No,Department,Free Claim?,Amount,Status,Cashier\n";
        let list = [...db.transactions];
        if (startDate) list = list.filter(t => t.meal_date >= startDate);
        if (endDate) list = list.filter(t => t.meal_date <= endDate);
        if (isFree !== undefined && isFree !== "") {
          const freeBool = isFree === "true" || isFree === "1" || isFree === 1;
          list = list.filter(t => t.is_free === freeBool);
        }

        const enriched = list.map(t => {
          const p = db.people.find(item => item.id === t.person_id);
          const cashier = db.people.find(item => item.id === t.cashier_person_id);
          const dept = p && p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
          return {
            ...t,
            employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown Employee",
            employee_no: p ? p.employee_no : "N/A",
            department_name: dept ? dept.name : "N/A",
            department_id: p ? p.department_id : null,
            cashier_name: cashier ? `${cashier.first_name} ${cashier.last_name}` : "System"
          };
        });

        let filtered = enriched;
        if (departmentId && departmentId !== "") {
          const depNum = parseInt(departmentId, 10);
          filtered = enriched.filter(t => t.department_id === depNum);
        }

        filtered.forEach(t => {
          csvContent += [
            t.id, t.meal_date, t.meal_time, t.employee_name || "Unknown", t.employee_no || "N/A",
            t.department_name || "N/A", t.is_free ? "YES" : "NO", Number(t.meal_amount || 0).toFixed(2), t.status, t.cashier_name || "System"
          ].map(escapeCsv).join(",") + "\n";
        });
      } else if (type === "employees") {
        csvContent = "Employee No,Name,Department,Position,Free Meals Claimed,Salary Deductions,Total Salary Deductions,Status\n";
        db.people.filter(p => p.role === "employee").forEach(p => {
          const empTrans = db.transactions.filter(t => t.person_id === p.id && t.status === "completed");
          const freeClaims = empTrans.filter(t => t.is_free).length;
          const paidClaims = empTrans.filter(t => !t.is_free).length;
          const totalSpent = empTrans.filter(t => !t.is_free).reduce((sum, t) => sum + Number(t.meal_amount), 0);
          const dept = p.department_id ? db.departments.find(d => d.id === p.department_id) : null;
          csvContent += [
            p.employee_no || "N/A", `${p.first_name} ${p.last_name}`, dept ? dept.name : "N/A", p.position || "Staff",
            freeClaims, paidClaims, Number(totalSpent).toFixed(2), p.is_active ? "Active" : "Inactive"
          ].map(escapeCsv).join(",") + "\n";
        });
      } else {
        csvContent = "Date,Free Meals Distributed,Salary Deductions,Total Salary Deductions\n";
        const dailyMap: { [date: string]: { freeCount: number; paidCount: number; amount: number } } = {};
        db.transactions.filter(t => t.status === "completed").forEach(t => {
          if (!dailyMap[t.meal_date]) dailyMap[t.meal_date] = { freeCount: 0, paidCount: 0, amount: 0 };
          if (t.is_free) dailyMap[t.meal_date].freeCount++;
          else {
            dailyMap[t.meal_date].paidCount++;
            dailyMap[t.meal_date].amount += Number(t.meal_amount);
          }
        });
        Object.keys(dailyMap).sort().forEach(dt => {
          csvContent += [dt, dailyMap[dt].freeCount, dailyMap[dt].paidCount, Number(dailyMap[dt].amount).toFixed(2)].map(escapeCsv).join(",") + "\n";
        });
      }
    }

    return {
      status: 200,
      body: { csv: csvContent }
    };
  }

  return null;
}
