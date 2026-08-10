import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Department, Person, Transaction, EmployeeSchedule, FreeMealLog, SystemSetting, AuditLog, LoginAttempt } from "../types.js";
import { initializeMysql, syncStateToMySQL, getMysqlPool } from "./mysql.js";
import { initializeSqlite, syncStateToSqlite, isSqliteConnected } from "./sqlite.js";
import { encryptPerson, decryptPerson, decrypt } from "./encryption.js";
import { cacheLayer } from "./cache.js";

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
    } catch (err) {
      console.error("[SECURITY] PBKDF2 password verification error:", err);
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
  } catch (err) {
    console.error("[SECURITY] Token verification error:", err);
    return null;
  }
}

// In-memory cache for ultra-fast API processing 
let cachedDbState: DatabaseSchema | null = null;

// Dual-mode database loader, executed at start-up
export async function loadAndInitDatabase(): Promise<void> {
  console.log("[DATA-ENGINE] Initializing dual database storage layer...");
  
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

  // Ensure admin user exists and password123 is valid
  if (!activeState.people) activeState.people = [];
  const adminIndex = activeState.people.findIndex(p => p.username.toLowerCase() === "admin");
  if (adminIndex >= 0) {
    activeState.people[adminIndex].password = hashPassword("password123");
    activeState.people[adminIndex].is_active = true;
    activeState.people[adminIndex].role = "admin";
  } else {
    activeState.people.unshift({
      id: 1,
      username: "admin",
      password: hashPassword("password123"),
      role: "admin",
      first_name: "System",
      last_name: "Administrator",
      email: "it.admin@dgmc.com",
      phone: "",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // Ensure dietary_admin user exists and password123 is valid
  const dietaryAdminIndex = activeState.people.findIndex(p => p.username.toLowerCase() === "dietary_admin");
  if (dietaryAdminIndex >= 0) {
    activeState.people[dietaryAdminIndex].password = hashPassword("password123");
    activeState.people[dietaryAdminIndex].is_active = true;
    activeState.people[dietaryAdminIndex].role = "dietary_admin";
  } else {
    activeState.people.push({
      id: 99,
      username: "dietary_admin",
      password: hashPassword("password123"),
      role: "dietary_admin",
      first_name: "Dietary",
      last_name: "Administrator",
      email: "dietary.admin@dgmc.com",
      phone: "",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // Attempt to initialize SQLite database connection
  const sqliteResultState = await initializeSqlite(activeState);
  if (sqliteResultState) {
    activeState = sqliteResultState;
  }

  // Attempt to initialize MySQL database connection
  const mysqlResultState = await initializeMysql(activeState);
  if (mysqlResultState) {
    cachedDbState = mysqlResultState;
    // Decrypt people loaded from MySQL
    if (cachedDbState.people) {
      cachedDbState.people = cachedDbState.people.map(decryptPerson);
    }
    // Ensure admin in mysqlResultState as well
    const mAdminIndex = cachedDbState.people.findIndex(p => p.username.toLowerCase() === "admin");
    if (mAdminIndex >= 0) {
      cachedDbState.people[mAdminIndex].password = hashPassword("password123");
      cachedDbState.people[mAdminIndex].is_active = true;
      cachedDbState.people[mAdminIndex].role = "admin";
    } else {
      cachedDbState.people.unshift({
        id: 1,
        username: "admin",
        password: hashPassword("password123"),
        role: "admin",
        first_name: "System",
        last_name: "Administrator",
        email: "it.admin@dgmc.com",
        phone: "",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    console.log("[DATA-ENGINE] Utilizing LIVE MySQL storage engine. Backup stored locally at db.json and SQLite");
    // Ensure backup is saved in encrypted format
    const encryptedPeople = cachedDbState.people.map(encryptPerson);
    const dataToSave = {
      ...cachedDbState,
      people: encryptedPeople
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
    
    // Keep SQLite database in lockstep with MySQL loads
    await syncStateToSqlite(cachedDbState).catch((err) => {
      console.error("[DATA-ENGINE] SQLite synchronization from MySQL loaded state failed:", err);
    });
  } else {
    cachedDbState = activeState;
    console.log("[DATA-ENGINE] Utilizing LOCAL SQLite & JSON storage engine fallback.");
    // Save local backup with updated admin
    const encryptedPeople = cachedDbState.people.map(encryptPerson);
    const dataToSave = {
      ...cachedDbState,
      people: encryptedPeople
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
    
    // Ensure SQLite is in sync
    await syncStateToSqlite(cachedDbState).catch((err) => {
      console.error("[DATA-ENGINE] Local SQLite synchronization failed:", err);
    });
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
      } catch (err) {
        console.error("Error reading fallback database JSON:", err);
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
    let touched = false;
    if (!cachedDbState.system_settings) {
      const defaultSeed = seedDatabase();
      cachedDbState.system_settings = defaultSeed.system_settings;
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
  } catch (err) {
    console.error("[DATA-ENGINE] Error writing local JSON backup:", err);
  }

  // 2. Synchronize in lockstep to SQLite
  syncStateToSqlite(data).catch((err) => {
    console.error("[DATA-ENGINE] Background SQLite synchronization failed:", err);
  });

  // 3. Asynchronously synchronizes in lockstep to active MySQL tables
  const pool = getMysqlPool();
  if (pool) {
    syncStateToMySQL(pool, dataToSave).catch((err) => {
      console.error("[DATA-ENGINE] Background MySQL synchronization failed:", err);
    });
  }
}

function seedDatabase(): DatabaseSchema {
  const nowStr = new Date().toISOString();
  
  // Production Start: No predefined departments. IT will add them via settings.
  const depts: Department[] = [];

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
      is_active: true,
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
    { id: 9, setting_key: "min_password_length", setting_value: "8", updated_at: nowStr },
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
