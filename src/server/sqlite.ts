import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { DatabaseSchema } from "./db.js";
import { encryptPerson, decryptPerson } from "./encryption.js";
import { logger } from "./utils/logger.js";

const SQLITE_DB_PATH = path.join(process.cwd(), "dgmc_meals.db");

let sqliteDb: Database.Database | null = null;
let isSqliteActive = false;

export function getSqliteDb() {
  return sqliteDb;
}

export function isSqliteConnected(): boolean {
  return isSqliteActive;
}

export async function initializeSqlite(defaultDb: DatabaseSchema): Promise<DatabaseSchema | null> {
  try {
    sqliteDb = new Database(SQLITE_DB_PATH);
    // Enable WAL mode for high performance concurrent reads and writes
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");
    
    isSqliteActive = true;

    // Create tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        employee_no TEXT UNIQUE,
        position TEXT,
        department_id INTEGER,
        qr_code TEXT UNIQUE,
        employee_status TEXT DEFAULT 'active',
        hire_date TEXT,
        managed_department_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS employee_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        work_date TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        created_by INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        cashier_person_id INTEGER NOT NULL,
        meal_date TEXT NOT NULL,
        meal_time TEXT NOT NULL,
        is_free INTEGER NOT NULL DEFAULT 0,
        meal_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        meal_type TEXT NOT NULL DEFAULT 'paid',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS free_meal_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        meal_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT,
        updated_at TEXT NOT NULL,
        updated_by INTEGER
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        ip_address TEXT,
        timestamp TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 0
      );
    `);

    try {
      sqliteDb.exec("ALTER TABLE transactions ADD COLUMN meal_type TEXT DEFAULT 'paid'");
    } catch (e) {
      // Column might already exist
    }

    // Create indexes for high performance query optimization
    sqliteDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_people_dept ON people(department_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(meal_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_person ON transactions(person_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_person_date ON employee_schedules(person_id, work_date);
      CREATE INDEX IF NOT EXISTS idx_free_meals_person_date ON free_meal_logs(person_id, meal_date);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username);
    `);

    // Check if SQLite needs seeding (if no people exist)
    const rowCountStmt = sqliteDb.prepare("SELECT COUNT(*) as cnt FROM people");
    const result = rowCountStmt.get() as { cnt: number };
    const count = result?.cnt || 0;

    if (count === 0) {
      logger.info("[SQLite] Database is empty. Seeding with default state...");
      await syncStateToSqlite(defaultDb);
      return defaultDb;
    } else {
      logger.info(`[SQLite] Found ${count} records. Loading persisted data from ${SQLITE_DB_PATH}...`);
      const loaded = await loadFromSqlite();
      return loaded;
    }
  } catch (_error: any) {
    isSqliteActive = false;
    sqliteDb = null;
    return null;
  }
}

export async function loadFromSqlite(): Promise<DatabaseSchema> {
  if (!sqliteDb) {
    throw new Error("SQLite is not initialized.");
  }

  const depts = sqliteDb.prepare("SELECT * FROM departments").all() as any[];
  const people = sqliteDb.prepare("SELECT * FROM people").all() as any[];
  const schedules = sqliteDb.prepare("SELECT * FROM employee_schedules").all() as any[];
  const transactions = sqliteDb.prepare("SELECT * FROM transactions").all() as any[];
  const freeLogs = sqliteDb.prepare("SELECT * FROM free_meal_logs").all() as any[];
  const settings = sqliteDb.prepare("SELECT * FROM system_settings").all() as any[];
  const logs = sqliteDb.prepare("SELECT * FROM audit_logs").all() as any[];
  const attempts = sqliteDb.prepare("SELECT * FROM login_attempts").all() as any[];

  return {
    departments: depts.map(d => ({
      id: d.id,
      name: d.name,
      created_at: d.created_at
    })),
    people: people.map(p => decryptPerson({
      id: p.id,
      username: p.username,
      password: p.password,
      role: p.role,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email || undefined,
      phone: p.phone || undefined,
      is_active: p.is_active === 1 || p.is_active === true,
      last_login: p.last_login || null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      employee_no: p.employee_no || undefined,
      position: p.position || undefined,
      department_id: p.department_id !== null && p.department_id !== undefined ? Number(p.department_id) : undefined,
      qr_code: p.qr_code || undefined,
      employee_status: p.employee_status || undefined,
      hire_date: p.hire_date || undefined,
      managed_department_id: p.managed_department_id !== null && p.managed_department_id !== undefined ? Number(p.managed_department_id) : undefined
    })),
    employee_schedules: schedules.map(s => ({
      id: s.id,
      person_id: s.person_id,
      work_date: s.work_date,
      shift_type: s.shift_type,
      created_by: s.created_by !== null && s.created_by !== undefined ? Number(s.created_by) : undefined,
      created_at: s.created_at
    })),
    transactions: transactions.map(t => ({
      id: t.id,
      person_id: t.person_id,
      cashier_person_id: t.cashier_person_id,
      meal_date: t.meal_date,
      meal_time: t.meal_time,
      is_free: t.is_free === 1 || t.is_free === true,
      meal_amount: Number(t.meal_amount),
      status: t.status,
      meal_type: t.meal_type || (t.is_free === 1 || t.is_free === true ? "free" : "paid"),
      created_at: t.created_at
    })),
    free_meal_log: freeLogs.map(f => ({
      id: f.id,
      person_id: f.person_id,
      meal_date: f.meal_date,
      created_at: f.created_at
    })),
    system_settings: settings.map(s => ({
      id: s.id,
      setting_key: s.setting_key,
      setting_value: s.setting_value,
      updated_at: s.updated_at,
      updated_by: s.updated_by !== null && s.updated_by !== undefined ? Number(s.updated_by) : undefined
    })),
    audit_logs: logs.map(l => ({
      id: l.id,
      user_id: l.user_id !== null && l.user_id !== undefined ? Number(l.user_id) : undefined,
      action: l.action,
      entity_type: l.entity_type || undefined,
      entity_id: l.entity_id || undefined,
      old_value: l.old_value || null,
      new_value: l.new_value || null,
      ip_address: l.ip_address || undefined,
      created_at: l.created_at
    })),
    login_attempts: attempts.map(la => ({
      id: la.id,
      username: la.username,
      ip_address: la.ip_address || undefined,
      timestamp: la.timestamp,
      success: la.success === 1 || la.success === true
    }))
  };
}

export async function syncStateToSqlite(data: DatabaseSchema): Promise<void> {
  if (!sqliteDb) return;

  // Use SQLite transactions for ACID guarantees and extremely fast batched execution
  const syncTx = sqliteDb.transaction(() => {
    // 1. Departments
    if (data.departments.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO departments (id, name, created_at)
        VALUES (?, ?, ?)
      `);
      for (const d of data.departments) {
        insertStmt.run(d.id, d.name, d.created_at || new Date().toISOString());
      }
    }

    // 2. People
    if (data.people.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO people (
          id, username, password, role, first_name, last_name,
          email, phone, is_active, last_login, created_at, updated_at,
          employee_no, position, department_id, qr_code, employee_status,
          hire_date, managed_department_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.people) {
        const encryptedP = encryptPerson(p);
        insertStmt.run(
          encryptedP.id,
          encryptedP.username,
          encryptedP.password || "",
          encryptedP.role,
          encryptedP.first_name,
          encryptedP.last_name,
          encryptedP.email || null,
          encryptedP.phone || null,
          encryptedP.is_active ? 1 : 0,
          encryptedP.last_login || null,
          encryptedP.created_at || new Date().toISOString(),
          encryptedP.updated_at || new Date().toISOString(),
          encryptedP.employee_no || null,
          encryptedP.position || null,
          encryptedP.department_id !== undefined ? encryptedP.department_id : null,
          encryptedP.qr_code || null,
          encryptedP.employee_status || "active",
          encryptedP.hire_date || null,
          encryptedP.managed_department_id !== undefined ? encryptedP.managed_department_id : null
        );
      }
    }

    // 3. Employee Schedules
    if (data.employee_schedules.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO employee_schedules (id, person_id, work_date, shift_type, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.employee_schedules) {
        insertStmt.run(
          s.id,
          s.person_id,
          s.work_date,
          s.shift_type,
          s.created_by !== undefined ? s.created_by : null,
          s.created_at || new Date().toISOString()
        );
      }
    }

    // 4. Transactions
    if (data.transactions.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO transactions (id, person_id, cashier_person_id, meal_date, meal_time, is_free, meal_amount, status, meal_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of data.transactions) {
        insertStmt.run(
          t.id,
          t.person_id,
          t.cashier_person_id || 1,
          t.meal_date || new Date().toISOString().split("T")[0],
          t.meal_time || new Date().toTimeString().split(" ")[0],
          t.is_free ? 1 : 0,
          t.meal_amount ?? 0,
          t.status || "completed",
          t.meal_type || (t.is_free ? "free" : "paid"),
          t.created_at || new Date().toISOString()
        );
      }
    }

    // 5. Free Meal Logs
    if (data.free_meal_log.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO free_meal_logs (id, person_id, meal_date, created_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const f of data.free_meal_log) {
        insertStmt.run(
          f.id,
          f.person_id,
          f.meal_date,
          f.created_at || new Date().toISOString()
        );
      }
    }

    // 6. System Settings
    if (data.system_settings && data.system_settings.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const s of data.system_settings) {
        insertStmt.run(
          s.id,
          s.setting_key,
          s.setting_value !== undefined && s.setting_value !== null ? s.setting_value : "",
          s.updated_at || new Date().toISOString(),
          s.updated_by !== undefined ? s.updated_by : null
        );
      }
    }

    // 7. Audit Logs
    if (data.audit_logs && data.audit_logs.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of data.audit_logs) {
        insertStmt.run(
          l.id,
          l.user_id !== undefined ? l.user_id : null,
          l.action,
          l.entity_type || null,
          l.entity_id || null,
          l.old_value || null,
          l.new_value || null,
          l.ip_address || null,
          l.created_at || new Date().toISOString()
        );
      }
    }

    // 8. Login Attempts
    if (data.login_attempts && data.login_attempts.length > 0) {
      const insertStmt = sqliteDb!.prepare(`
        INSERT OR REPLACE INTO login_attempts (id, username, ip_address, timestamp, success)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const la of data.login_attempts) {
        insertStmt.run(
          la.id,
          la.username,
          la.ip_address || null,
          la.timestamp || new Date().toISOString(),
          la.success ? 1 : 0
        );
      }
    }

    // Perform sync deletions in reverse dependency order (child records first, parent records last)
    if (data.free_meal_log.length > 0) {
      const ids = data.free_meal_log.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM free_meal_logs WHERE id NOT IN (${ids.join(",")})`).run();
    } else {
      sqliteDb!.prepare("DELETE FROM free_meal_logs").run();
    }
    if (data.transactions.length > 0) {
      const ids = data.transactions.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM transactions WHERE id NOT IN (${ids.join(",")})`).run();
    } else {
      sqliteDb!.prepare("DELETE FROM transactions").run();
    }
    if (data.employee_schedules.length > 0) {
      const ids = data.employee_schedules.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM employee_schedules WHERE id NOT IN (${ids.join(",")})`).run();
    } else {
      sqliteDb!.prepare("DELETE FROM employee_schedules").run();
    }
    if (data.login_attempts && data.login_attempts.length > 0) {
      const ids = data.login_attempts.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM login_attempts WHERE id NOT IN (${ids.join(",")})`).run();
    }
    if (data.audit_logs && data.audit_logs.length > 0) {
      const ids = data.audit_logs.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM audit_logs WHERE id NOT IN (${ids.join(",")})`).run();
    }
    if (data.system_settings && data.system_settings.length > 0) {
      const ids = data.system_settings.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM system_settings WHERE id NOT IN (${ids.join(",")})`).run();
    }
    if (data.people.length > 0) {
      const ids = data.people.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM people WHERE id NOT IN (${ids.join(",")})`).run();
    }
    if (data.departments.length > 0) {
      const ids = data.departments.map(x => x.id);
      sqliteDb!.prepare(`DELETE FROM departments WHERE id NOT IN (${ids.join(",")})`).run();
    }
  });

  try {
    syncTx();
    logger.debug(`[SQLite] Successfully synchronized ${data.people.length} people and ${data.departments.length} departments to local database.`);
  } catch (err: any) {
    logger.error("[SQLite] Synchronization failed:", err);
  }
}
