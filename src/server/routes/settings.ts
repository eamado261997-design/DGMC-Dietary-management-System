import { jsonResponse, ApiResponse } from "../utils/apiUtils.js";
import { readDatabase, writeDatabase } from "../db.js";
import { isMysqlConnected, query, execute } from "../mysql.js";
import { cacheLayer } from "../cache.js";
import { DEFAULT_MIN_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH_LIMITS } from "../../utils/password.js";
import { Person, AuditLog } from "../../types.js";
import { decrypt } from "../encryption.js";
import JSZip from "jszip";

export async function handleSettingsRoutes(
  method: string,
  path: string,
  body: any,
  headers: any,
  authUser: Person | null,
  queryParams: any,
  requireRole: (roles: string[]) => boolean,
  logToAudit: (action: string, entityType: string, entityId: any, oldData: any, newData: any) => Promise<void>
): Promise<ApiResponse | null> {
  if (path === "/api/settings" && method === "GET") {
    if (!authUser) {
      let itSupportPhone = "Medical arts Bldg. 5th floor/ICT dept. / 2568";
      let companyName = "Divine Grace Medical Center";
      let companyTagline = "Compassionate Care, Exceptional Service";
      let companyLogoUrl = "";
      let minPasswordLength = String(DEFAULT_MIN_PASSWORD_LENGTH);
      
      if (isMysqlConnected()) {
        const rows = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('it_support_phone', 'company_name', 'company_tagline', 'company_logo_url', 'min_password_length')");
        rows.forEach((row: any) => {
          if (row.setting_key === "it_support_phone") itSupportPhone = row.setting_value;
          if (row.setting_key === "company_name") companyName = row.setting_value;
          if (row.setting_key === "company_tagline") companyTagline = row.setting_value;
          if (row.setting_key === "company_logo_url") companyLogoUrl = row.setting_value;
          if (row.setting_key === "min_password_length") minPasswordLength = row.setting_value;
        });
      } else {
        const db = readDatabase();
        (db.system_settings || []).forEach((row: any) => {
          if (row.setting_key === "it_support_phone") itSupportPhone = row.setting_value;
          if (row.setting_key === "company_name") companyName = row.setting_value;
          if (row.setting_key === "company_tagline") companyTagline = row.setting_value;
          if (row.setting_key === "company_logo_url") companyLogoUrl = row.setting_value;
          if (row.setting_key === "min_password_length") minPasswordLength = row.setting_value;
        });
      }
      return jsonResponse(200, [
        { setting_key: "it_support_phone", setting_value: itSupportPhone },
        { setting_key: "company_name", setting_value: companyName },
        { setting_key: "company_tagline", setting_value: companyTagline },
        { setting_key: "company_logo_url", setting_value: companyLogoUrl },
        { setting_key: "min_password_length", setting_value: minPasswordLength }
      ]);
    }
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM system_settings");
      return jsonResponse(200, rows);
    } else {
      const db = readDatabase();
      return jsonResponse(200, db.system_settings || []);
    }
  }

  if (path === "/api/settings" && (method === "POST" || method === "PUT")) {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    
    let settingsObj: Record<string, any> = {};
    if (body && Array.isArray(body.settings)) {
      for (const item of body.settings) {
        if (item && item.setting_key !== undefined) {
          settingsObj[item.setting_key] = item.setting_value;
        }
      }
    } else if (body && typeof body.settings === "object" && body.settings !== null) {
      settingsObj = body.settings;
    } else if (body && typeof body === "object") {
      settingsObj = body;
    }

    if (settingsObj["min_password_length"] !== undefined) {
      const minLenVal = parseInt(String(settingsObj["min_password_length"]), 10);
      if (isNaN(minLenVal) || minLenVal < MIN_PASSWORD_LENGTH_LIMITS.MIN || minLenVal > MIN_PASSWORD_LENGTH_LIMITS.MAX) {
        return jsonResponse(400, { error: `Minimum password length must be a number between ${MIN_PASSWORD_LENGTH_LIMITS.MIN} and ${MIN_PASSWORD_LENGTH_LIMITS.MAX}` });
      }
    }

    const nowStr = new Date().toISOString();
    if (isMysqlConnected()) {
      for (const [key, val] of Object.entries(settingsObj)) {
        const valStr = String(val ?? "");
        const check = await query("SELECT * FROM system_settings WHERE setting_key = ?", [key]);
        if (check.length > 0) {
          await execute("UPDATE system_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?", [valStr, nowStr, key]);
        } else {
          await execute("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)", [key, valStr, nowStr]);
        }
      }
    }

    const db = readDatabase();
    if (!db.system_settings) db.system_settings = [];
    for (const [key, val] of Object.entries(settingsObj)) {
      const valStr = String(val ?? "");
      const existing = db.system_settings.find((s: any) => s.setting_key === key);
      if (existing) {
        existing.setting_value = valStr;
        existing.updated_at = nowStr;
      } else {
        const nextId = db.system_settings.length > 0 ? Math.max(...db.system_settings.map((s: any) => s.id)) + 1 : 1;
        db.system_settings.push({ id: nextId, setting_key: key, setting_value: valStr, updated_at: nowStr });
      }
    }
    writeDatabase(db);
    cacheLayer.clear();
    await logToAudit("SETTINGS_UPDATE", "system_settings", null, null, settingsObj);
    return jsonResponse(200, { success: true, message: "Settings updated successfully" });
  }

  // Audit logs endpoints
  if ((path === "/api/audit-logs" || path === "/api/admin/audit-logs") && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const { action, entity_type } = queryParams || {};

    if (isMysqlConnected()) {
      let q = `
        SELECT a.*, p.first_name, p.last_name, p.username AS user_handle
        FROM audit_logs a
        LEFT JOIN people p ON a.user_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (action) {
        q += " AND a.action = ?";
        params.push(action);
      }
      if (entity_type) {
        q += " AND a.entity_type = ?";
        params.push(entity_type);
      }
      q += " ORDER BY a.id DESC LIMIT 500";
      const rows = await query(q, params);
      const decryptedRows = rows.map((l: any) => {
        const fName = decrypt(l.first_name);
        const lName = decrypt(l.last_name);
        return {
          ...l,
          user_name: (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : "System / Unauthenticated"
        };
      });
      return jsonResponse(200, decryptedRows);
    } else {
      const db = readDatabase();
      let list = [...(db.audit_logs || [])];
      if (action) list = list.filter((l: AuditLog) => l.action === action);
      if (entity_type) list = list.filter((l: AuditLog) => l.entity_type === entity_type);
      const logs = list.reverse().slice(0, 500).map((l: AuditLog) => {
        const p = l.user_id ? (db.people || []).find((user: Person) => user.id === l.user_id) : null;
        const fName = p ? decrypt(p.first_name) : "";
        const lName = p ? decrypt(p.last_name) : "";
        return {
          ...l,
          user_name: (fName || lName) ? `${fName} ${lName}`.trim() : "System / Unauthenticated",
          user_handle: p ? p.username : "system"
        };
      });
      return jsonResponse(200, logs);
    }
  }

  if (path === "/api/audit-logs/export" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin", "dietary_admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    let csv = "ID,User ID,Action,Entity Type,Entity ID,IP Address,Created At\n";
    if (isMysqlConnected()) {
      const rows = await query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000");
      rows.forEach((r: any) => {
        csv += `"${r.id}","${r.user_id || ''}","${r.action}","${r.entity_type || ''}","${r.entity_id || ''}","${r.ip_address || ''}","${r.created_at}"\n`;
      });
    } else {
      const db = readDatabase();
      (db.audit_logs || []).slice(-1000).reverse().forEach((r: any) => {
        csv += `"${r.id}","${r.user_id || ''}","${r.action}","${r.entity_type || ''}","${r.entity_id || ''}","${r.ip_address || ''}","${r.created_at}"\n`;
      });
    }
    return jsonResponse(200, { csv });
  }

  if (path === "/api/admin/db-zip-export" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });
    const db = readDatabase();
    const zip = new JSZip();
    zip.file("database.json", JSON.stringify(db, null, 2));
    const content = await zip.generateAsync({ type: "nodebuffer" });
    return jsonResponse(200, { success: true, filename: "dgmc_database_backup.zip", base64: content.toString("base64") });
  }

  if (path === "/api/admin/database/backup" && method === "GET") {
    if (!authUser) return jsonResponse(401, { error: "Authentication required" });
    if (!requireRole(["admin"])) return jsonResponse(403, { error: "Admin privilege required" });

    const db = readDatabase();
    const zip = new JSZip();
    zip.file("database_backup.json", JSON.stringify(db, null, 2));
    const content = await zip.generateAsync({ type: "nodebuffer" });
    const filename = `dgmc_encrypted_backup_${new Date().toISOString().split("T")[0]}.zip`;

    return {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`
      },
      body: content
    };
  }

  return null;
}
