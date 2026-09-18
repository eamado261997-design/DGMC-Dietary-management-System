import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Department, Person, Transaction, EmployeeSchedule, FreeMealLog, SystemSetting, AuditLog, LoginAttempt } from "../types.js";
import { initializeMysql, syncStateToMySQL, getMysqlPool } from "./mysql.js";
import { initializeSqlite, syncStateToSqlite, isSqliteConnected, getSqliteDb } from "./sqlite.js";
import { encryptPerson, decryptPerson, decrypt } from "./encryption.js";
import { cacheLayer } from "./cache.js";
import { logger } from "./utils/logger.js";

const DB_FILE_PATH = path.join(process.cwd(), "db.json");

export interface DatabaseSchema {
  departments: Department[];
  people: Person[];
  transactions: Transaction[];
  employee_schedules: EmployeeSchedule[];
  free_meal_log: FreeMealLog[];
  system_settings: SystemSetting[];
  audit_logs: AuditLog[];
  login_attempts: LoginAttempt[];
}

const JWT_SECRET = process.env.JWT_SECRET || "dgmc_dietary_secret_jwt_key_9501";

// Password Hashing helpers using high-security PBKDF2 (SHA-512) with a random salt & 20,000 iterations (OWASP recommendation)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 20000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

// Support backward compatibility verification & dynamic upgrade during login
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  
  // Decrypt the hash if it is encrypted at rest
  const decryptedHash = decrypt(storedHash);
  
  // If it's a PBKDF2 hash, verify using salt & key derivation parameters
  if (decryptedHash.startsWith("pbkdf2$")) {
    try {
      const parts = decryptedHash.split("$");
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const originalHash = parts[3];
      const testHash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
      return testHash === originalHash;
    } catch (_err) {
      return false;
    }
  }
  
  // Fallback to legacy SHA256 hashing for old accounts or initial seed
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  return legacyHash === decryptedHash;
}

// Token Authentication helpers
export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (_err) {
    return null;
  }
}

// In-memory cache for ultra-fast API processing 
let cachedDbState: DatabaseSchema | null = null;

// Ensure default administrator accounts (admin and dietary_admin) exist and have valid credentials
export function ensureDefaultAdmins(state: DatabaseSchema): void {
  if (!state.people) state.people = [];
  const adminHash = hashPassword("password123");
  const nowStr = new Date().toISOString();

  // 1. Primary System Administrator
  const adminIndex = state.people.findIndex(p => p.username.toLowerCase() === "admin");
  if (adminIndex >= 0) {
    state.people[adminIndex].password = adminHash;
    state.people[adminIndex].is_active = true;
    state.people[adminIndex].role = "admin";
    state.people[adminIndex].is_protected = true;
  } else {
    state.people.unshift({
      id: 1,
      username: "admin",
      password: adminHash,
      role: "admin",
      first_name: "System",
      last_name: "Administrator",
      email: "it.admin@dgmc.com",
      phone: "",
      department_id: 1,
      is_active: true,
      is_protected: true,
      protected: true,
      created_at: nowStr,
      updated_at: nowStr
    });
  }

  // 2. Dietary Administrator
  const dietaryAdminIndex = state.people.findIndex(p => p.username.toLowerCase() === "dietary_admin");
  if (dietaryAdminIndex >= 0) {
    state.people[dietaryAdminIndex].password = adminHash;
    state.people[dietaryAdminIndex].is_active = true;
    state.people[dietaryAdminIndex].role = "dietary_admin";
  } else {
    state.people.push({
      id: 99,
      username: "dietary_admin",
      password: adminHash,
      role: "dietary_admin",
      first_name: "Dietary",
      last_name: "Administrator",
      email: "dietary.admin@dgmc.com",
      phone: "",
      department_id: 1,
      is_active: true,
      created_at: nowStr,
      updated_at: nowStr
    });
  }
}

// Dual-mode database loader, executed at start-up
export async function loadAndInitDatabase(): Promise<void> {
  let activeState: DatabaseSchema;
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const jsonStr = fs.readFileSync(DB_FILE_PATH, "utf-8");
      activeState = JSON.parse(jsonStr);
      // Decrypt people loaded from backup
      if (activeState.people) {
        activeState.people = activeState.people.map(decryptPerson);
      }
    } catch {
      activeState = seedDatabase();
    }
  } else {
    activeState = seedDatabase();
  }

  ensureDefaultAdmins(activeState);

  // Attempt to initialize SQLite database connection
  const sqliteResultState = await initializeSqlite(activeState);
  if (sqliteResultState) {
    activeState = sqliteResultState;
  }

  // Attempt to initialize MySQL database connection
  const mysqlResultState = await initializeMysql(activeState);
  if (mysqlResultState) {
    // If local activeState (JSON/SQLite) has more people than what was found in MySQL,
    // it likely means the user created data while MySQL was offline. Sync TO MySQL.
    if (activeState.people.length > mysqlResultState.people.length) {
      logger.info(`[Database] Local data is more complete (${activeState.people.length} vs ${mysqlResultState.people.length}). Syncing to MySQL...`);
      cachedDbState = activeState;
      await syncStateToMySQL(getMysqlPool(), cachedDbState);
    } else {
      // Use MySQL state as primary
      cachedDbState = mysqlResultState;
    }

    if (cachedDbState.people) {
      cachedDbState.people = cachedDbState.people.map(decryptPerson);
    }
  } else {
    cachedDbState = activeState;
  }

  // Always ensure default admin accounts exist and have valid passwords in cachedDbState
  ensureDefaultAdmins(cachedDbState);

  // Persist admin updates to SQLite table directly
  try {
    const sdb = getSqliteDb();
    if (sdb) {
      const adminHash = hashPassword("password123");
      sdb.prepare("UPDATE people SET password = ?, is_active = 1, role = 'admin' WHERE LOWER(username) = 'admin'").run(adminHash);
      sdb.prepare("UPDATE people SET password = ?, is_active = 1, role = 'dietary_admin' WHERE LOWER(username) = 'dietary_admin'").run(adminHash);
    }
  } catch (_e) {}

  // Persist admin updates to MySQL table directly if connected
  try {
    const pool = getMysqlPool();
    if (pool) {
      const adminHash = hashPassword("password123");
      await pool.query("UPDATE people SET password = ?, is_active = 1, role = 'admin' WHERE LOWER(username) = 'admin'", [adminHash]);
      await pool.query("UPDATE people SET password = ?, is_active = 1, role = 'dietary_admin' WHERE LOWER(username) = 'dietary_admin'", [adminHash]);
    }
  } catch (_e) {}

  // Save local backup file with updated admin
  const encryptedPeople = cachedDbState.people.map(encryptPerson);
  const dataToSave = {
    ...cachedDbState,
    people: encryptedPeople
  };
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");

  if (mysqlResultState) {
    await syncStateToSqlite(cachedDbState).catch(() => {});
  } else {
    await syncStateToSqlite(cachedDbState).catch(() => {});
  }
}

// Low-level database operations
export function readDatabase(): DatabaseSchema {
  if (!cachedDbState) {
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf-8"));
        if (parsed.people) {
          parsed.people = parsed.people.map(decryptPerson);
        }
        cachedDbState = parsed;
      } catch (_err) {
        cachedDbState = seedDatabase();
      }
    } else {
      cachedDbState = seedDatabase();
      const encryptedPeople = cachedDbState.people.map(encryptPerson);
      const dataToSave = {
        ...cachedDbState,
        people: encryptedPeople
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
    }
  }

  // Backfill if missing loaded fields
  if (cachedDbState) {
    const nowStr = new Date().toISOString();
    let touched = false;
    if (!cachedDbState.departments || cachedDbState.departments.length === 0) {
      cachedDbState.departments = [
        { id: 1, name: "ICT Department", created_at: nowStr },
        { id: 2, name: "Nursing Department", created_at: nowStr },
        { id: 3, name: "Emergency Department", created_at: nowStr },
        { id: 4, name: "Pharmacy", created_at: nowStr },
        { id: 5, name: "Laboratory", created_at: nowStr }
      ];
      touched = true;
    }
    if (!cachedDbState.system_settings) {
      const defaultSeed = seedDatabase();
      cachedDbState.system_settings = defaultSeed.system_settings;
      touched = true;
    }
    if (!cachedDbState.free_meal_log) {
      cachedDbState.free_meal_log = [];
      touched = true;
    }
    if (!cachedDbState.transactions) {
      cachedDbState.transactions = [];
      touched = true;
    }
    if (!cachedDbState.employee_schedules) {
      cachedDbState.employee_schedules = [];
      touched = true;
    }
    if (!cachedDbState.audit_logs) {
      cachedDbState.audit_logs = [];
      touched = true;
    }
    if (!cachedDbState.login_attempts) {
      cachedDbState.login_attempts = [];
      touched = true;
    }

    // Ensure all records have mandatory created_at / updated_at
    for (const d of cachedDbState.departments || []) {
      if (!d.created_at) { d.created_at = nowStr; touched = true; }
    }
    for (const p of cachedDbState.people || []) {
      if (!p.created_at) { p.created_at = nowStr; touched = true; }
      if (!p.updated_at) { p.updated_at = nowStr; touched = true; }
    }
    for (const s of cachedDbState.employee_schedules || []) {
      if (!s.created_at) { s.created_at = nowStr; touched = true; }
    }
    for (const t of cachedDbState.transactions || []) {
      if (!t.created_at) { t.created_at = nowStr; touched = true; }
    }
    for (const f of cachedDbState.free_meal_log || []) {
      if (!f.created_at) { f.created_at = nowStr; touched = true; }
      if (!f.claimed_at) { f.claimed_at = f.created_at; touched = true; }
    }
    for (const l of cachedDbState.audit_logs || []) {
      if (!l.created_at) { l.created_at = nowStr; touched = true; }
    }
    for (const la of cachedDbState.login_attempts || []) {
      if (!la.timestamp) { la.timestamp = nowStr; touched = true; }
    }
    if (touched) {
      try {
        const encryptedPeople = cachedDbState.people.map(encryptPerson);
        const dataToSave = {
          ...cachedDbState,
          people: encryptedPeople
        };
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
      } catch {}
    }
  }

  return cachedDbState!;
}

export function writeDatabase(data: DatabaseSchema): void {
  cachedDbState = data;
  
  // Invalidate cached query results on database updates
  cacheLayer.clear();
  
  const encryptedPeople = data.people.map(encryptPerson);
  const dataToSave = {
    ...data,
    people: encryptedPeople
  };

  // 1. Instantly write to local backup JSON file
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
  } catch (_err) {
    // Suppress JSON write error
  }

  // 2. Synchronize in lockstep to SQLite
  if (isSqliteConnected()) {
    syncStateToSqlite(data).catch((err) => {
      logger.error("[Database] Failed to sync to SQLite:", err);
    });
  }

  // 3. Asynchronously synchronizes in lockstep to active MySQL tables
  const pool = getMysqlPool();
  if (pool) {
    syncStateToMySQL(pool, dataToSave).catch(() => {});
  }
}

function seedDatabase(): DatabaseSchema {
  const nowStr = new Date().toISOString();
  
  const depts: Department[] = [
    { id: 1, name: "ICT Department", created_at: nowStr },
    { id: 2, name: "Nursing Department", created_at: nowStr },
    { id: 3, name: "Emergency Department", created_at: nowStr },
    { id: 4, name: "Pharmacy", created_at: nowStr },
    { id: 5, name: "Laboratory", created_at: nowStr }
  ];

  const people: Person[] = [
    // 1. Primary System Administrator
    {
      id: 1,
      username: "admin",
      password: hashPassword("password123"),
      role: "admin",
      first_name: "System",
      last_name: "Administrator",
      email: "it.admin@dgmc.com",
      phone: "",
      department_id: 1,
      is_active: true,
      is_protected: true,
      protected: true,
      created_at: nowStr,
      updated_at: nowStr
    },
    // 2. Dietary Administrator
    {
      id: 99,
      username: "dietary_admin",
      password: hashPassword("password123"),
      role: "dietary_admin",
      first_name: "Dietary",
      last_name: "Administrator",
      email: "dietary.admin@dgmc.com",
      phone: "",
      department_id: 1,
      is_active: true,
      created_at: nowStr,
      updated_at: nowStr
    }
  ];

  // Empty datasets for production start
  const schedules: EmployeeSchedule[] = [];
  const transactions: Transaction[] = [];
  const free_meal_log: FreeMealLog[] = [];

  // Core System Settings required for application logic
  const defaultSettings: SystemSetting[] = [
    { id: 1, setting_key: "shift_day_start", setting_value: "11:00", updated_at: nowStr },
    { id: 2, setting_key: "shift_day_end", setting_value: "14:00", updated_at: nowStr },
    { id: 3, setting_key: "shift_night_start", setting_value: "22:00", updated_at: nowStr },
    { id: 4, setting_key: "shift_night_end", setting_value: "06:00", updated_at: nowStr },
    { id: 5, setting_key: "meal_price", setting_value: "150.00", updated_at: nowStr },
    { id: 6, setting_key: "schedule_cutoff_days", setting_value: "3", updated_at: nowStr },
    { id: 7, setting_key: "max_login_attempts", setting_value: "5", updated_at: nowStr },
    { id: 8, setting_key: "lockout_duration_minutes", setting_value: "15", updated_at: nowStr },
    { id: 9, setting_key: "min_password_length", setting_value: "6", updated_at: nowStr },
    { id: 10, setting_key: "company_name", setting_value: "Divine Grace Medical Center", updated_at: nowStr },
    { id: 11, setting_key: "company_tagline", setting_value: "Compassionate Care, Exceptional Service", updated_at: nowStr },
    { id: 12, setting_key: "company_logo_url", setting_value: "", updated_at: nowStr },
    { id: 13, setting_key: "currency_symbol", setting_value: "₱", updated_at: nowStr },
    { id: 14, setting_key: "free_meal_limit_daily", setting_value: "1", updated_at: nowStr },
    { id: 15, setting_key: "audit_log_retention_days", setting_value: "30", updated_at: nowStr },
    { id: 16, setting_key: "it_support_phone", setting_value: "Medical arts Bldg. 5th floor/ICT dept. / 2568", updated_at: nowStr }
  ];

  return {
    departments: depts,
    people,
    transactions,
    employee_schedules: schedules,
    free_meal_log,
    system_settings: defaultSettings,
    audit_logs: [],
    login_attempts: []
  };
}
