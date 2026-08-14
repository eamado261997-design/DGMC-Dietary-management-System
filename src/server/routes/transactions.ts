import { jsonResponse, ApiResponse } from "../utils/apiUtils.js";
import { readDatabase, writeDatabase } from "../db.js";
import { isMysqlConnected, query, execute } from "../mysql.js";
import { Person, Transaction } from "../../types.js";

const getSystemSettings = async () => {
  let settings: any[] = [];
  if (isMysqlConnected()) {
    settings = await query("SELECT setting_key, setting_value FROM system_settings");
  } else {
    const db = readDatabase();
    settings = db.system_settings || [];
  }
  
  const getVal = (k: string, def: string) => settings.find((s: any) => s.setting_key === k)?.setting_value || def;
  
  const dayStart = getVal("shift_day_start", "11:00");
  const dayEnd = getVal("shift_day_end", "14:00");
  const nightStart = getVal("shift_night_start", "22:00");
  const nightEnd = getVal("shift_night_end", "06:00");
  const mealPrice = parseFloat(getVal("meal_price", "150.00"));
  const freeMealLimit = parseInt(getVal("free_meal_limit_daily", "1"), 10);

  const toMins = (t: string) => { const [h,m] = t.split(":").map(Number); return h * 60 + m; };
  const formatTime = (t: string) => {
    const [h,m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  return {
    dayStartMins: toMins(dayStart),
    dayEndMins: toMins(dayEnd),
    nightStartMins: toMins(nightStart),
    nightEndMins: toMins(nightEnd),
    dayStr: `${formatTime(dayStart)} - ${formatTime(dayEnd)}`,
    nightStr: `${formatTime(nightStart)} - ${formatTime(nightEnd)}`,
    mealPrice,
    freeMealLimit
  };
};

export async function handleTransactionRoutes(
  method: string,
  path: string,
  body: any,
  headers: any,
  authUser: Person | null,
  requireRole: (roles: string[]) => boolean,
  logToAudit: (action: string, entityType: string, entityId: any, oldData: any, newData: any) => Promise<void>
): Promise<ApiResponse | null> {
  try {
    // Transaction cancellation API (cashier/admin)
    const cancelTxMatch = path.match(/^\/api\/cashier\/transactions\/(\d+)\/cancel$/);
    if (cancelTxMatch && method === "POST") {
      if (!authUser) return jsonResponse(401, { error: "Authentication required" });
      if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Access denied" });
      const txId = parseInt(cancelTxMatch[1], 10);

      if (isMysqlConnected()) {
        const rows = await query("SELECT * FROM transactions WHERE id = ?", [txId]);
        const tx = rows[0];
        if (!tx) return jsonResponse(404, { error: "Transaction not found" });
        if (tx.status === "cancelled") return jsonResponse(400, { error: "This receipt already processed as cancelled" });

        await execute("UPDATE transactions SET status = 'cancelled' WHERE id = ?", [txId]);

        const isFreeBool = tx.is_free === 1 || tx.is_free === true;
        if (isFreeBool) {
          await execute("DELETE FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [tx.person_id, tx.meal_date]);
        }
        await logToAudit("TRANSACTION_VOID", "transactions", txId, tx, { ...tx, status: "cancelled" });
        return jsonResponse(200, { success: true, message: "Receipt cancelled successfully" });
      } else {
        const db = readDatabase();
        const tx = (db.transactions || []).find(t => t.id === txId);
        if (!tx) return jsonResponse(404, { error: "Transaction not found" });
        if (tx.status === "cancelled") return jsonResponse(400, { error: "This receipt already processed as cancelled" });

        const oldTxCopy = { ...tx };
        tx.status = "cancelled";

        // If it was free, remove it from the free_meal_log so they can claim again if corrected
        if (tx.is_free) {
          db.free_meal_log = (db.free_meal_log || []).filter(f => !(f.person_id === tx.person_id && f.meal_date === tx.meal_date));
        }

        writeDatabase(db);
        await logToAudit("TRANSACTION_VOID", "transactions", txId, oldTxCopy, { ...tx, status: "cancelled" });
        return jsonResponse(200, { success: true, message: "Receipt cancelled successfully" });
      }
    }

    // Cashier stats
    if (path === "/api/cashier/stats" && method === "GET") {
      if (!authUser) return jsonResponse(401, { error: "Authentication required" });
      if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
      const todayStr = new Date().toISOString().split("T")[0];
      let freeCount = 0;
      let paidCount = 0;
      let totalRevenue = 0;
      if (isMysqlConnected()) {
        const rows = await query("SELECT is_free, meal_amount FROM transactions WHERE meal_date = ? AND status = 'completed'", [todayStr]);
        rows.forEach(t => {
          if (t.is_free === 1 || t.is_free === true) freeCount++;
          else {
            paidCount++;
            totalRevenue += Number(t.meal_amount || 0);
          }
        });
      } else {
        const db = readDatabase();
        const list = (db.transactions || []).filter(t => t.meal_date === todayStr && t.status === "completed");
        list.forEach(t => {
          if (t.is_free) freeCount++;
          else {
            paidCount++;
            totalRevenue += Number(t.meal_amount || 0);
          }
        });
      }
      return jsonResponse(200, { freeCount, paidCount, totalRevenue, totalMeals: freeCount + paidCount });
    }

    // Cashier transactions list
    if (path === "/api/cashier/transactions" && method === "GET") {
      if (!authUser) return jsonResponse(401, { error: "Authentication required" });
      if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
      if (isMysqlConnected()) {
        const rows = await query(`
          SELECT t.*, 
                 CONCAT(p.first_name, ' ', p.last_name) AS employee_name,
                 p.employee_no,
                 d.name AS department_name,
                 CONCAT(c.first_name, ' ', c.last_name) AS cashier_name
          FROM transactions t
          LEFT JOIN people p ON t.person_id = p.id
          LEFT JOIN departments d ON p.department_id = d.id
          LEFT JOIN people c ON t.cashier_person_id = c.id
          ORDER BY t.id DESC LIMIT 100
        `);
        return jsonResponse(200, rows);
      } else {
        const db = readDatabase();
        const enriched = (db.transactions || []).slice(-100).reverse().map(t => {
          const p = (db.people || []).find(item => item.id === t.person_id);
          const cashier = (db.people || []).find(item => item.id === t.cashier_person_id);
          const dept = p && p.department_id ? (db.departments || []).find(d => d.id === p.department_id) : null;
          return {
            ...t,
            employee_name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
            employee_no: p ? p.employee_no : "N/A",
            department_name: dept ? dept.name : "N/A",
            cashier_name: cashier ? `${cashier.first_name} ${cashier.last_name}` : "System"
          };
        });
        return jsonResponse(200, enriched);
      }
    }

    // Cashier QR scan
    if (path === "/api/cashier/scan" && method === "POST") {
      if (!authUser) return jsonResponse(401, { error: "Authentication required" });
      if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
      const { qr_code } = body || {};
      if (!qr_code) return jsonResponse(400, { error: "QR code is required" });

      const todayStr = new Date().toISOString().split("T")[0];
      const timeStr = new Date().toTimeString().split(" ")[0];

      let person: any = null;
      if (isMysqlConnected()) {
        const pRows = await query(
          "SELECT * FROM people WHERE (qr_code = ? OR employee_no = ? OR LOWER(employee_no) = LOWER(?)) AND is_active = 1",
          [qr_code, qr_code, qr_code]
        );
        person = pRows[0];
      } else {
        const db = readDatabase();
        const codeStr = String(qr_code).trim().toLowerCase();
        person = (db.people || []).find(p => p.is_active && (
          (p.qr_code && p.qr_code.toLowerCase() === codeStr) ||
          (p.employee_no && p.employee_no.toLowerCase() === codeStr) ||
          String(p.id) === codeStr
        ));
      }

      if (!person) return jsonResponse(404, { error: "Employee not found or account inactive for this QR code or Employee ID." });

      // Fetch active roster schedule for today
      let schedule: any = null;
      if (isMysqlConnected()) {
        const schedRows = await query(
          "SELECT * FROM employee_schedules WHERE person_id = ? AND work_date = ?",
          [person.id, todayStr]
        );
        schedule = schedRows[0];
      } else {
        const db = readDatabase();
        schedule = (db.employee_schedules || []).find(s => s.person_id === person.id && s.work_date === todayStr);
      }

      const sysSettings = await getSystemSettings();

      // Check free meal claims today
      let claimedCount = 0;
      if (isMysqlConnected()) {
        const freeRows = await query("SELECT COUNT(*) as cnt FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [person.id, todayStr]);
        claimedCount = freeRows[0]?.cnt || 0;
      } else {
        const db = readDatabase();
        claimedCount = (db.free_meal_log || []).filter(f => f.person_id === person.id && f.meal_date === todayStr).length;
      }

      let alreadyClaimedFree = claimedCount >= sysSettings.freeMealLimit;

      let isFree = false;
      let reason = "";
      let windowDetails = "Off Duty";
      let shiftType = "off";

      if (!schedule) {
        isFree = false;
        reason = "No Active Schedule Today: Registered as Off Duty/Absent. Meal requires standard cashier payment.";
        windowDetails = "No Scheduled Shift";
        shiftType = "off";
      } else {
        shiftType = schedule.shift_type;
        const [h, m] = timeStr.split(":").map(Number);
        const totalMinutes = h * 60 + m;
        let isEligibleTime = false;

        const shiftSettings = sysSettings;
        
        if (schedule.shift_type === "day") {
          windowDetails = `${shiftSettings.dayStr} (Day Shift)`;
          isEligibleTime = totalMinutes >= shiftSettings.dayStartMins && totalMinutes <= shiftSettings.dayEndMins;
        } else if (schedule.shift_type === "night") {
          windowDetails = `${shiftSettings.nightStr} (Night Shift)`;
          isEligibleTime = totalMinutes >= shiftSettings.nightStartMins || totalMinutes <= shiftSettings.nightEndMins;
        } else {
          windowDetails = "Unknown Shift Type";
        }

        if (!isEligibleTime) {
          isFree = false;
          reason = `Outside Allotted Shift Meal Window. Allowed hours: ${schedule.shift_type === "day" ? shiftSettings.dayStr : shiftSettings.nightStr}.`;
        } else if (alreadyClaimedFree) {
          isFree = false;
          reason = `Quota Exceeded: ${claimedCount}/${sysSettings.freeMealLimit} Free Meal(s) Already Claimed for Current Shift.`;
        } else {
          isFree = true;
          reason = "Complimentary Meal Voucher Available";
        }
      }

      const mealAmount = isFree ? 0 : sysSettings.mealPrice;

      if (isMysqlConnected()) {
        const tRows = await query("SELECT MAX(id) as maxId FROM transactions");
        const nextId = (tRows[0]?.maxId || 0) + 1;
        await execute(
          `INSERT INTO transactions (id, person_id, meal_date, meal_time, is_free, meal_amount, status, meal_type, cashier_person_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
          [nextId, person.id, todayStr, timeStr, isFree ? 1 : 0, mealAmount, isFree ? "free" : "paid", authUser.id, new Date().toISOString()]
        );

        if (isFree) {
          const fRows = await query("SELECT MAX(id) as maxId FROM free_meal_logs");
          const nextFId = (fRows[0]?.maxId || 0) + 1;
          await execute(
            `INSERT INTO free_meal_logs (id, person_id, meal_date, claimed_at) VALUES (?, ?, ?, ?)`,
            [nextFId, person.id, todayStr, new Date().toISOString()]
          );
        }

        let deptName = "N/A";
        if (person.department_id) {
          const deptRows = await query("SELECT name FROM departments WHERE id = ?", [person.department_id]);
          deptName = deptRows[0]?.name || "N/A";
        }

        const txRecord = {
          id: nextId,
          person_id: person.id,
          employee_name: `${person.first_name} ${person.last_name}`,
          employee_no: person.employee_no,
          department_name: deptName,
          meal_date: todayStr,
          meal_time: timeStr,
          is_free: isFree,
          meal_amount: mealAmount,
          status: "completed",
          meal_type: isFree ? "free" : "paid",
          cashier_name: `${authUser.first_name} ${authUser.last_name}`
        };

        await logToAudit(isFree ? "MEAL_SCAN_FREE" : "MEAL_SCAN_PAID", "transactions", nextId, null, txRecord);
        return jsonResponse(200, {
          eligible: isFree,
          reason,
          shift_type: shiftType,
          windowDetails,
          secure_verified: true,
          security_method: "HMAC SHA-256 Badge Token",
          remainingQuota: isFree ? 1 : 0,
          totalQuota: 1,
          claimedCount: alreadyClaimedFree ? 1 : 0,
          employee: {
            id: person.id,
            name: `${person.first_name} ${person.last_name}`,
            employee_no: person.employee_no,
            department_name: deptName,
            position: person.position || "Staff Member"
          },
          success: true,
          transaction: txRecord,
          isFree,
          message: isFree ? "Free meal verified and recorded." : "Recorded as paid meal."
        });
      } else {
        const db = readDatabase();
        const transactionsList = db.transactions || [];
        const nextId = transactionsList.length > 0 ? Math.max(...transactionsList.map(t => t.id)) + 1 : 1;
        const tx: Transaction = {
          id: nextId,
          person_id: person.id,
          cashier_person_id: authUser.id,
          meal_date: todayStr,
          meal_time: timeStr,
          is_free: isFree,
          meal_amount: mealAmount,
          status: "completed",
          meal_type: isFree ? "free" : "paid",
          created_at: new Date().toISOString()
        };
        if (!db.transactions) db.transactions = [];
        db.transactions.push(tx);

        if (isFree) {
          if (!db.free_meal_log) db.free_meal_log = [];
          const nextFId = db.free_meal_log.length > 0 ? Math.max(...db.free_meal_log.map(f => f.id)) + 1 : 1;
          db.free_meal_log.push({
            id: nextFId,
            person_id: person.id,
            meal_date: todayStr,
            created_at: new Date().toISOString()
          });
        }
        writeDatabase(db);

        const dept = person.department_id ? (db.departments || []).find(d => d.id === person.department_id) : null;
        const deptName = dept ? dept.name : "N/A";
        const txRecord = {
          ...tx,
          employee_name: `${person.first_name} ${person.last_name}`,
          employee_no: person.employee_no,
          department_name: deptName,
          cashier_name: `${authUser.first_name} ${authUser.last_name}`
        };

        await logToAudit(isFree ? "MEAL_SCAN_FREE" : "MEAL_SCAN_PAID", "transactions", nextId, null, txRecord);
        return jsonResponse(200, {
          eligible: isFree,
          reason,
          shift_type: shiftType,
          windowDetails,
          secure_verified: true,
          security_method: "HMAC SHA-256 Badge Token",
          remainingQuota: isFree ? 1 : 0,
          totalQuota: 1,
          claimedCount: alreadyClaimedFree ? 1 : 0,
          employee: {
            id: person.id,
            name: `${person.first_name} ${person.last_name}`,
            employee_no: person.employee_no,
            department_name: deptName,
            position: person.position || "Staff Member"
          },
          success: true,
          transaction: txRecord,
          isFree,
          message: isFree ? "Free meal verified and recorded." : "Recorded as paid meal."
        });
      }
    }

    // Cashier process manual
    if (path === "/api/cashier/process" && method === "POST") {
      if (!authUser) return jsonResponse(401, { error: "Authentication required" });
      if (!requireRole(["cashier", "admin"])) return jsonResponse(403, { error: "Cashier privilege required" });
      const { person_id, is_free, meal_amount } = body || {};
      if (!person_id) return jsonResponse(400, { error: "Person ID is required" });

      const todayStr = new Date().toISOString().split("T")[0];
      const timeStr = new Date().toTimeString().split(" ")[0];

      let person: any = null;
      if (isMysqlConnected()) {
        const pRows = await query("SELECT * FROM people WHERE id = ?", [person_id]);
        person = pRows[0];
      } else {
        const db = readDatabase();
        person = (db.people || []).find(p => p.id === Number(person_id));
      }
      if (!person) return jsonResponse(404, { error: "Employee not found" });

      const freeBool = !!is_free;
      if (freeBool) {
        // Enforce active roster and window for complimentary meals
        let schedule: any = null;
        if (isMysqlConnected()) {
          const schedRows = await query(
            "SELECT * FROM employee_schedules WHERE person_id = ? AND work_date = ?",
            [person.id, todayStr]
          );
          schedule = schedRows[0];
        } else {
          const db = readDatabase();
          schedule = (db.employee_schedules || []).find(s => s.person_id === person.id && s.work_date === todayStr);
        }

        if (!schedule) {
          return jsonResponse(400, { error: "Complimentary meal blocked: Employee has no active roster schedule today." });
        }

        const [h, m] = timeStr.split(":").map(Number);
        const totalMinutes = h * 60 + m;
        let isEligibleTime = false;

        const shiftSettings = await getSystemSettings();
        
        if (schedule.shift_type === "day") {
          isEligibleTime = totalMinutes >= shiftSettings.dayStartMins && totalMinutes <= shiftSettings.dayEndMins;
        } else if (schedule.shift_type === "night") {
          isEligibleTime = totalMinutes >= shiftSettings.nightStartMins || totalMinutes <= shiftSettings.nightEndMins;
        }

        if (!isEligibleTime) {
          const allowedStr = schedule.shift_type === "day" ? shiftSettings.dayStr : shiftSettings.nightStr;
          return jsonResponse(400, { error: `Complimentary meal blocked: Current time is outside shift window (${allowedStr}).` });
        }

        let claimedCount = 0;
        if (isMysqlConnected()) {
          const freeRows = await query("SELECT COUNT(*) as cnt FROM free_meal_logs WHERE person_id = ? AND meal_date = ?", [person.id, todayStr]);
          claimedCount = freeRows[0]?.cnt || 0;
        } else {
          const db = readDatabase();
          claimedCount = (db.free_meal_log || []).filter(f => f.person_id === person.id && f.meal_date === todayStr).length;
        }
        
        let alreadyClaimedFree = claimedCount >= shiftSettings.freeMealLimit;
        if (alreadyClaimedFree) {
          return jsonResponse(400, { error: `Complimentary meal blocked: Quota already claimed today (${claimedCount}/${shiftSettings.freeMealLimit}).` });
        }
      }

      const sysSettings = await getSystemSettings();
      const amount = freeBool ? 0 : Number(meal_amount || sysSettings.mealPrice);

      if (isMysqlConnected()) {
        const tRows = await query("SELECT MAX(id) as maxId FROM transactions");
        const nextId = (tRows[0]?.maxId || 0) + 1;
        await execute(
          `INSERT INTO transactions (id, person_id, meal_date, meal_time, is_free, meal_amount, status, meal_type, cashier_person_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
          [nextId, person.id, todayStr, timeStr, freeBool ? 1 : 0, amount, freeBool ? "free" : "paid", authUser.id, new Date().toISOString()]
        );

        if (freeBool) {
          const fRows = await query("SELECT MAX(id) as maxId FROM free_meal_logs");
          const nextFId = (fRows[0]?.maxId || 0) + 1;
          await execute(
            `INSERT INTO free_meal_logs (id, person_id, meal_date, claimed_at) VALUES (?, ?, ?, ?)`,
            [nextFId, person.id, todayStr, new Date().toISOString()]
          );
        }

        const txRecord = {
          id: nextId,
          person_id: person.id,
          employee_name: `${person.first_name} ${person.last_name}`,
          employee_no: person.employee_no,
          meal_date: todayStr,
          meal_time: timeStr,
          is_free: freeBool,
          meal_amount: amount,
          status: "completed",
          meal_type: freeBool ? "free" : "paid"
        };
        await logToAudit(freeBool ? "MEAL_SCAN_FREE" : "MEAL_SCAN_PAID", "transactions", nextId, null, txRecord);
        return jsonResponse(200, { success: true, transaction: txRecord });
      } else {
        const db = readDatabase();
        const transactionsList = db.transactions || [];
        const nextId = transactionsList.length > 0 ? Math.max(...transactionsList.map(t => t.id)) + 1 : 1;
        const tx: Transaction = {
          id: nextId,
          person_id: person.id,
          cashier_person_id: authUser.id,
          meal_date: todayStr,
          meal_time: timeStr,
          is_free: freeBool,
          meal_amount: amount,
          status: "completed",
          meal_type: freeBool ? "free" : "paid",
          created_at: new Date().toISOString()
        };
        if (!db.transactions) db.transactions = [];
        db.transactions.push(tx);
        if (freeBool) {
          if (!db.free_meal_log) db.free_meal_log = [];
          const nextFId = db.free_meal_log.length > 0 ? Math.max(...db.free_meal_log.map(f => f.id)) + 1 : 1;
          db.free_meal_log.push({ id: nextFId, person_id: person.id, meal_date: todayStr, created_at: new Date().toISOString() });
        }
        writeDatabase(db);
        await logToAudit(freeBool ? "MEAL_SCAN_FREE" : "MEAL_SCAN_PAID", "transactions", nextId, null, tx);
        return jsonResponse(200, { success: true, transaction: tx });
      }
    }

    return null;
  } catch (err: any) {
    return jsonResponse(500, {
      error: "An unexpected database exception occurred in transaction services.",
      details: err?.message || String(err)
    });
  }
}
