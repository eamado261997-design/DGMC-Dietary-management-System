import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { DatabaseSchema } from "./db.js";
import { encryptPerson, decryptPerson, decryptAny, encryptDeterministic } from "./encryption.js";
import { dbLatencyTracker } from "./utils/apiUtils.js";

dotenv.config();

// Keep a global connection pool state & monitoring metrics
let dbPool: any = null;
let isMysqlActive = false;

let totalQueriesCount = 0;
let totalQueryErrors = 0;
let lastQueryTimestamp: string | null = null;
let lastErrorTimestamp: string | null = null;

export function getMysqlPool() {
  return dbPool;
}

export function isMysqlConnected(): boolean {
  return isMysqlActive;
}

export function getPoolStats() {
  return {
    isMysqlActive,
    connectionLimit: 12,
    totalQueriesCount,
    totalQueryErrors,
    lastQueryTimestamp,
    lastErrorTimestamp,
    hasPool: dbPool !== null
  };
}

export async function checkMysqlHealth(): Promise<{ healthy: boolean; latencyMs: number | null; error?: string }> {
  if (!dbPool || !isMysqlActive) {
    return { healthy: false, latencyMs: null, error: "MySQL pool not initialized or inactive" };
  }
  const start = Date.now();
  try {
    await dbPool.execute("SELECT 1 as health");
    const latencyMs = Date.now() - start;
    return { healthy: true, latencyMs };
  } catch (err: any) {
    totalQueryErrors++;
    lastErrorTimestamp = new Date().toISOString();
    return { healthy: false, latencyMs: null, error: err.message };
  }
}

function getSslOption(): any {
  const mysqlSsl = process.env.MYSQL_SSL;
  const mysqlSslMode = process.env.MYSQL_SSL_MODE;
  const rejectUnauthorized = process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "true";
  const sslCa = process.env.MYSQL_SSL_CA;

  if (mysqlSsl === "true" || mysqlSsl === "1" || mysqlSslMode === "REQUIRED" || mysqlSslMode === "VERIFY_CA" || mysqlSslMode === "VERIFY_IDENTITY") {
    const sslConfig: any = {
      rejectUnauthorized
    };
    if (sslCa) {
      sslConfig.ca = sslCa;
    }
    return sslConfig;
  }
  return undefined;
}

async function connectWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

function processParamsForSql(sql: string, params: any[]): any[] {
  if (!params || params.length === 0) return params;
  
  const sensitiveColumns = ["qr_code", "employee_no", "first_name", "last_name", "email", "phone", "password"];
  const processed = [...params];
  
  let paramIndex = 0;
  let searchIndex = 0;
  
  while (true) {
    const qIndex = sql.indexOf("?", searchIndex);
    if (qIndex === -1 || paramIndex >= params.length) {
      break;
    }
    
    const preceding = sql.substring(0, qIndex);
    const match = preceding.match(/\b([a-zA-Z0-9_]+)\s*(?:=|(?:LIKE))\s*$/i);
    if (match) {
      const colName = match[1].toLowerCase();
      if (sensitiveColumns.includes(colName)) {
        const val = params[paramIndex];
        if (typeof val === "string" && !val.startsWith("enc:") && !val.startsWith("enc_det:")) {
          processed[paramIndex] = encryptDeterministic(val);
        }
      }
    }
    
    searchIndex = qIndex + 1;
    paramIndex++;
  }
  
  return processed;
}

export async function query<T = any>(sql: string, params: any = []): Promise<T[]> {
  if (!dbPool) {
    throw new Error("Database error: MySQL client connection is not initialized.");
  }
  totalQueriesCount++;
  lastQueryTimestamp = new Date().toISOString();
  const startQuery = Date.now();
  try {
    const processedParams = processParamsForSql(sql, params);
    const [rows] = await dbPool.execute(sql, processedParams);
    return decryptAny(rows) as T[];
  } catch (err) {
    totalQueryErrors++;
    lastErrorTimestamp = new Date().toISOString();
    throw err;
  } finally {
    const queryDuration = Date.now() - startQuery;
    const store = dbLatencyTracker.getStore();
    if (store) {
      store.totalDbLatency += queryDuration;
    }
  }
}

export async function execute(sql: string, params: any = []): Promise<any> {
  if (!dbPool) {
    throw new Error("Database error: MySQL client connection is not initialized.");
  }
  totalQueriesCount++;
  lastQueryTimestamp = new Date().toISOString();
  const startQuery = Date.now();
  try {
    const processedParams = processParamsForSql(sql, params);
    const [result] = await dbPool.execute(sql, processedParams);
    return result;
  } catch (err) {
    totalQueryErrors++;
    lastErrorTimestamp = new Date().toISOString();
    throw err;
  } finally {
    const queryDuration = Date.now() - startQuery;
    const store = dbLatencyTracker.getStore();
    if (store) {
      store.totalDbLatency += queryDuration;
    }
  }
}

/**
 * Initializes MySQL connection with retries, SSL support, and connection pool setup.
 */
export async function initializeMysql(defaultDb: DatabaseSchema): Promise<DatabaseSchema | null> {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER || "dgmc_user";
  const password = process.env.MYSQL_PASSWORD || "dgmc_password";
  const dbName = process.env.MYSQL_DATABASE || "dgmc_meals";
  const portString = process.env.MYSQL_PORT || "3311";
  const port = parseInt(portString, 10);
  const sslOptions = getSslOption();

  if (!host || host === 'YOUR_MYSQL_HOST' || host === '' || host === 'dgmc' || host === 'EMPTY') {
    isMysqlActive = false;
    return null;
  }

  try {
    // 1. Establish connection to ensure database exists, wrapped in retry backoff
    const adminConnection = await connectWithRetry(async () => {
      return await mysql.createConnection({
        host,
        user,
        password,
        port,
        ssl: sslOptions
      });
    }, 3, 500);

    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await adminConnection.end();

    // 2. Build full application connection Pool
    dbPool = mysql.createPool({
      host,
      user,
      password,
      database: dbName,
      port,
      ssl: sslOptions,
      waitForConnections: true,
      connectionLimit: 12,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      namedPlaceholders: true
    });

    isMysqlActive = true;

    // 3. Auto-Create target tables (DDL operations)

    // A. Departments table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // B. People Table (personnel information)
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS people (
        id INT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        first_name VARCHAR(55) NOT NULL,
        last_name VARCHAR(55) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_login VARCHAR(50),
        created_at VARCHAR(50) NOT NULL,
        updated_at VARCHAR(50) NOT NULL,
        employee_no VARCHAR(20) UNIQUE,
        position VARCHAR(100),
        department_id INT,
        qr_code VARCHAR(255) UNIQUE,
        employee_status VARCHAR(20) DEFAULT 'active',
        hire_date VARCHAR(10),
        managed_department_id INT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // C. Work schedules
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS employee_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        person_id INT NOT NULL,
        work_date VARCHAR(10) NOT NULL,
        shift_type VARCHAR(20) NOT NULL,
        created_by INT,
        created_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // D. Meal Swipes Transactions
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        person_id INT NOT NULL,
        cashier_person_id INT NOT NULL,
        meal_date VARCHAR(10) NOT NULL,
        meal_time VARCHAR(10) NOT NULL,
        is_free TINYINT(1) NOT NULL DEFAULT 0,
        meal_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        meal_type VARCHAR(20) NOT NULL DEFAULT 'paid',
        created_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await dbPool.query("ALTER TABLE transactions ADD COLUMN meal_type VARCHAR(20) NOT NULL DEFAULT 'paid'");
    } catch (e) {
      // Column already exists, safe to ignore
    }

    // E. Free allowance logging
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS free_meal_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        person_id INT NOT NULL,
        meal_date VARCHAR(10) NOT NULL,
        created_at VARCHAR(50) NOT NULL,
        claimed_at VARCHAR(50)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await dbPool.query("ALTER TABLE free_meal_logs ADD COLUMN claimed_at VARCHAR(50)");
    } catch (e) {
      // Column already exists
    }

    // F. System settings table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value LONGTEXT,
        updated_at VARCHAR(50) NOT NULL,
        updated_by INT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Proactively upgrade column to LONGTEXT if system_settings already existed as TEXT
    try {
      await dbPool.query("ALTER TABLE system_settings MODIFY COLUMN setting_value LONGTEXT");
    } catch (_colErr) {
      // Clean pass if already modified or running in custom setups
    }

    // G. Audit logs table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100),
        entity_id VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(45),
        created_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // H. Login attempts table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45),
        timestamp VARCHAR(50) NOT NULL,
        success TINYINT(1) NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create database performance indexes for query optimization
    const indexesToCreate = [
      "CREATE INDEX idx_people_dept ON people(department_id)",
      "CREATE INDEX idx_transactions_date ON transactions(meal_date)",
      "CREATE INDEX idx_transactions_person ON transactions(person_id)",
      "CREATE INDEX idx_schedules_person_date ON employee_schedules(person_id, work_date)",
      "CREATE INDEX idx_free_meals_person_date ON free_meal_logs(person_id, meal_date)",
      "CREATE INDEX idx_audit_logs_user ON audit_logs(user_id)",
      "CREATE INDEX idx_login_attempts_user ON login_attempts(username)"
    ];

    for (const idxSql of indexesToCreate) {
      try {
        await dbPool.query(idxSql);
      } catch (_idxErr) {
        // Index may already exist
      }
    }

    // 4. Verify if database has historical records. If database is completely unseeded (no people), perform seed.
    const [rows]: any = await dbPool.query("SELECT COUNT(*) as cnt FROM people");
    const count = rows[0]?.cnt || 0;

    if (count === 0) {
      await seedMySQL(dbPool, defaultDb);
      return defaultDb;
    } else {
      const loaded = await loadFromMySQL(dbPool);
      return loaded;
    }

  } catch (_error: any) {
    totalQueryErrors++;
    lastErrorTimestamp = new Date().toISOString();
    isMysqlActive = false;
    dbPool = null;
    return null;
  }
}

/**
 * Helper function for high-performance batch replace statements
 */
async function batchReplace(
  pool: any,
  table: string,
  columns: string[],
  rowsData: any[][],
  chunkSize: number = 100
): Promise<void> {
  if (!rowsData || rowsData.length === 0) return;
  for (let i = 0; i < rowsData.length; i += chunkSize) {
    const chunk = rowsData.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const sql = `REPLACE INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`;
    const flatParams = chunk.reduce((acc, val) => acc.concat(val), []);
    await pool.query(sql, flatParams);
  }
}

/**
 * Helper function for high-performance batch upsert (ON DUPLICATE KEY UPDATE)
 */
async function batchUpsert(
  conn: any,
  table: string,
  columns: string[],
  rowsData: any[][],
  updateAssignments: string,
  chunkSize: number = 100
): Promise<void> {
  if (!rowsData || rowsData.length === 0) return;
  for (let i = 0; i < rowsData.length; i += chunkSize) {
    const chunk = rowsData.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateAssignments}`;
    const flatParams = chunk.reduce((acc, val) => acc.concat(val), []);
    await conn.query(sql, flatParams);
  }
}

/**
 * Seeds the MySQL tables with standard initial datasets using batch statements
 */
async function seedMySQL(pool: any, defaultDb: DatabaseSchema): Promise<void> {
  // A. Seed Departments
  if (defaultDb.departments.length > 0) {
    const deptRows = defaultDb.departments.map(d => [d.id, d.name, d.created_at]);
    await batchReplace(pool, "departments", ["id", "name", "created_at"], deptRows);
  }

  // B. Seed People (Admin account & staff)
  if (defaultDb.people.length > 0) {
    const peopleRows = defaultDb.people.map(p => {
      const encryptedP = encryptPerson(p);
      return [
        encryptedP.id, encryptedP.username, encryptedP.password, encryptedP.role, encryptedP.first_name, encryptedP.last_name,
        encryptedP.email || null, encryptedP.phone || null, encryptedP.is_active ? 1 : 0, encryptedP.last_login || null,
        encryptedP.created_at, encryptedP.updated_at, encryptedP.employee_no || null, encryptedP.position || null,
        encryptedP.department_id || null, encryptedP.qr_code || null, encryptedP.employee_status || "active",
        encryptedP.hire_date || null, encryptedP.managed_department_id || null
      ];
    });
    await batchReplace(
      pool,
      "people",
      [
        "id", "username", "password", "role", "first_name", "last_name",
        "email", "phone", "is_active", "last_login", "created_at", "updated_at",
        "employee_no", "position", "department_id", "qr_code", "employee_status",
        "hire_date", "managed_department_id"
      ],
      peopleRows
    );
  }

  // C. Seed Schedules
  if (defaultDb.employee_schedules.length > 0) {
    const schedRows = defaultDb.employee_schedules.map(s => [s.id, s.person_id, s.work_date, s.shift_type, s.created_by || null, s.created_at]);
    await batchReplace(pool, "employee_schedules", ["id", "person_id", "work_date", "shift_type", "created_by", "created_at"], schedRows);
  }

  // D. Seed Transactions
  if (defaultDb.transactions.length > 0) {
    const txRows = defaultDb.transactions.map(t => [t.id, t.person_id, t.cashier_person_id, t.meal_date, t.meal_time, t.is_free ? 1 : 0, t.meal_amount, t.status, t.meal_type || (t.is_free ? "free" : "paid"), t.created_at]);
    await batchReplace(pool, "transactions", ["id", "person_id", "cashier_person_id", "meal_date", "meal_time", "is_free", "meal_amount", "status", "meal_type", "created_at"], txRows);
  }

  // E. Seed Free Meal Logs
  if (defaultDb.free_meal_log.length > 0) {
    const logRows = defaultDb.free_meal_log.map(f => [f.id, f.person_id, f.meal_date, f.created_at, f.claimed_at || null]);
    await batchReplace(pool, "free_meal_logs", ["id", "person_id", "meal_date", "created_at", "claimed_at"], logRows);
  }

  // F. Seed System settings
  if (defaultDb.system_settings && defaultDb.system_settings.length > 0) {
    const settingRows = defaultDb.system_settings.map(s => [s.id, s.setting_key, s.setting_value, s.updated_at, s.updated_by || null]);
    await batchReplace(pool, "system_settings", ["id", "setting_key", "setting_value", "updated_at", "updated_by"], settingRows);
  }
}

/**
 * Loads entire datasets from MySQL and formats them back to memory interfaces
 */
async function loadFromMySQL(pool: any): Promise<DatabaseSchema> {
  const [depts] = await pool.query("SELECT * FROM departments");
  const [people] = await pool.query("SELECT * FROM people");
  const [schedules] = await pool.query("SELECT * FROM employee_schedules");
  const [transactions] = await pool.query("SELECT * FROM transactions");
  const [freeLogs] = await pool.query("SELECT * FROM free_meal_logs");
  const [settings] = await pool.query("SELECT * FROM system_settings");
  const [logs] = await pool.query("SELECT * FROM audit_logs");
  const [attempts] = await pool.query("SELECT * FROM login_attempts");

  return {
    departments: (depts as any[]).map(d => ({
      id: d.id,
      name: d.name,
      created_at: d.created_at
    })),
    people: (people as any[]).map(p => decryptPerson({
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
      department_id: p.department_id !== null ? Number(p.department_id) : undefined,
      qr_code: p.qr_code || undefined,
      employee_status: p.employee_status || undefined,
      hire_date: p.hire_date || undefined,
      managed_department_id: p.managed_department_id !== null ? Number(p.managed_department_id) : undefined
    })),
    employee_schedules: (schedules as any[]).map(s => ({
      id: s.id,
      person_id: s.person_id,
      work_date: s.work_date,
      shift_type: s.shift_type,
      created_by: s.created_by !== null ? Number(s.created_by) : undefined,
      created_at: s.created_at
    })),
    transactions: (transactions as any[]).map(t => ({
      id: t.id,
      person_id: t.person_id,
      cashier_person_id: t.cashier_person_id,
      meal_date: t.meal_date,
      meal_time: t.meal_time,
      is_free: t.is_free === 1 || t.is_free === true,
      meal_amount: Number(t.meal_amount),
      status: t.status,
      meal_type: t.meal_type || (t.is_free ? "free" : "paid"),
      created_at: t.created_at
    })),
    free_meal_log: (freeLogs as any[]).map(f => ({
      id: f.id,
      person_id: f.person_id,
      meal_date: f.meal_date,
      created_at: f.created_at,
      claimed_at: f.claimed_at || undefined
    })),
    system_settings: (settings as any[]).map(s => ({
      id: s.id,
      setting_key: s.setting_key,
      setting_value: s.setting_value,
      updated_at: s.updated_at,
      updated_by: s.updated_by !== null ? Number(s.updated_by) : undefined
    })),
    audit_logs: (logs as any[]).map(l => ({
      id: l.id,
      user_id: l.user_id !== null ? Number(l.user_id) : undefined,
      action: l.action,
      entity_type: l.entity_type || undefined,
      entity_id: l.entity_id || undefined,
      old_value: l.old_value || null,
      new_value: l.new_value || null,
      ip_address: l.ip_address || undefined,
      created_at: l.created_at
    })),
    login_attempts: (attempts as any[]).map(la => ({
      id: la.id,
      username: la.username,
      ip_address: la.ip_address || undefined,
      timestamp: la.timestamp,
      success: la.success === 1 || la.success === true
    }))
  };
}

/**
 * Synchronizes the runtime application state down to MySQL with batch upsert operations.
 */
export async function syncStateToMySQL(pool: any, data: DatabaseSchema): Promise<void> {
  if (!pool) return;
  let conn: any = null;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Synchronize Departments
    if (data.departments.length > 0) {
      const rows = data.departments.map(d => [d.id, d.name, d.created_at]);
      await batchUpsert(conn, "departments", ["id", "name", "created_at"], rows, "name=VALUES(name)");
    }

    // 2. Synchronize People
    if (data.people.length > 0) {
      const rows = data.people.map(p => [
        p.id, p.username, p.password || "", p.role, p.first_name, p.last_name,
        p.email || null, p.phone || null, p.is_active ? 1 : 0, p.last_login || null,
        p.created_at, p.updated_at, p.employee_no || null, p.position || null,
        p.department_id || null, p.qr_code || null, p.employee_status || "active",
        p.hire_date || null, p.managed_department_id || null
      ]);
      const updateCols = `
        username = VALUES(username),
        password = VALUES(password),
        role = VALUES(role),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        email = VALUES(email),
        phone = VALUES(phone),
        is_active = VALUES(is_active),
        last_login = VALUES(last_login),
        updated_at = VALUES(updated_at),
        employee_no = VALUES(employee_no),
        position = VALUES(position),
        department_id = VALUES(department_id),
        qr_code = VALUES(qr_code),
        employee_status = VALUES(employee_status),
        hire_date = VALUES(hire_date),
        managed_department_id = VALUES(managed_department_id)
      `;
      await batchUpsert(
        conn,
        "people",
        [
          "id", "username", "password", "role", "first_name", "last_name",
          "email", "phone", "is_active", "last_login", "created_at", "updated_at",
          "employee_no", "position", "department_id", "qr_code", "employee_status",
          "hire_date", "managed_department_id"
        ],
        rows,
        updateCols
      );
    }

    // 3. Synchronize Schedules
    if (data.employee_schedules.length > 0) {
      const rows = data.employee_schedules.map(s => [s.id, s.person_id, s.work_date, s.shift_type, s.created_by || null, s.created_at]);
      const updateCols = "person_id=VALUES(person_id), work_date=VALUES(work_date), shift_type=VALUES(shift_type), created_by=VALUES(created_by), created_at=VALUES(created_at)";
      await batchUpsert(conn, "employee_schedules", ["id", "person_id", "work_date", "shift_type", "created_by", "created_at"], rows, updateCols);
    }

    // 4. Synchronize Transactions
    if (data.transactions.length > 0) {
      const rows = data.transactions.map(t => [t.id, t.person_id, t.cashier_person_id, t.meal_date, t.meal_time, t.is_free ? 1 : 0, t.meal_amount, t.status, t.meal_type || (t.is_free ? "free" : "paid"), t.created_at]);
      const updateCols = "person_id=VALUES(person_id), cashier_person_id=VALUES(cashier_person_id), meal_date=VALUES(meal_date), meal_time=VALUES(meal_time), is_free=VALUES(is_free), meal_amount=VALUES(meal_amount), status=VALUES(status), meal_type=VALUES(meal_type), created_at=VALUES(created_at)";
      await batchUpsert(conn, "transactions", ["id", "person_id", "cashier_person_id", "meal_date", "meal_time", "is_free", "meal_amount", "status", "meal_type", "created_at"], rows, updateCols);
    }

    // 5. Synchronize Free Meal Logs
    if (data.free_meal_log.length > 0) {
      const rows = data.free_meal_log.map(f => [f.id, f.person_id, f.meal_date, f.created_at, f.claimed_at || null]);
      const updateCols = "person_id=VALUES(person_id), meal_date=VALUES(meal_date), created_at=VALUES(created_at), claimed_at=VALUES(claimed_at)";
      await batchUpsert(conn, "free_meal_logs", ["id", "person_id", "meal_date", "created_at", "claimed_at"], rows, updateCols);
    }

    // 6. Synchronize System Settings
    if (data.system_settings && data.system_settings.length > 0) {
      const rows = data.system_settings.map(s => [s.id, s.setting_key, s.setting_value, s.updated_at, s.updated_by || null]);
      const updateCols = "setting_key=VALUES(setting_key), setting_value=VALUES(setting_value), updated_at=VALUES(updated_at), updated_by=VALUES(updated_by)";
      await batchUpsert(conn, "system_settings", ["id", "setting_key", "setting_value", "updated_at", "updated_by"], rows, updateCols);
    }

    // 7. Synchronize Audit Logs
    if (data.audit_logs && data.audit_logs.length > 0) {
      const rows = data.audit_logs.map(l => [l.id, l.user_id || null, l.action, l.entity_type || null, l.entity_id || null, l.old_value || null, l.new_value || null, l.ip_address || null, l.created_at]);
      const updateCols = "user_id=VALUES(user_id), action=VALUES(action), entity_type=VALUES(entity_type), entity_id=VALUES(entity_id), old_value=VALUES(old_value), new_value=VALUES(new_value), ip_address=VALUES(ip_address), created_at=VALUES(created_at)";
      await batchUpsert(conn, "audit_logs", ["id", "user_id", "action", "entity_type", "entity_id", "old_value", "new_value", "ip_address", "created_at"], rows, updateCols);
    }

    // 8. Synchronize Login Attempts
    if (data.login_attempts && data.login_attempts.length > 0) {
      const rows = data.login_attempts.map(la => [la.id, la.username, la.ip_address || null, la.timestamp, la.success ? 1 : 0]);
      const updateCols = "username=VALUES(username), ip_address=VALUES(ip_address), timestamp=VALUES(timestamp), success=VALUES(success)";
      await batchUpsert(conn, "login_attempts", ["id", "username", "ip_address", "timestamp", "success"], rows, updateCols);
    }

    // --- EXECUTE SYNCHRONOUS DELETIONS IN DATABASE IF RECORDS REMOVED FROM MEMORY ---
    if (data.departments.length > 0) {
      const ids = data.departments.map(x => x.id);
      await conn.query("DELETE FROM departments WHERE id NOT IN (?)", [ids]);
    }
    if (data.people.length > 0) {
      const ids = data.people.map(x => x.id);
      await conn.query("DELETE FROM people WHERE id NOT IN (?)", [ids]);
    }
    if (data.employee_schedules.length > 0) {
      const ids = data.employee_schedules.map(x => x.id);
      await conn.query("DELETE FROM employee_schedules WHERE id NOT IN (?)", [ids]);
    } else {
      await conn.query("DELETE FROM employee_schedules");
    }
    if (data.transactions.length > 0) {
      const ids = data.transactions.map(x => x.id);
      await conn.query("DELETE FROM transactions WHERE id NOT IN (?)", [ids]);
    } else {
      await conn.query("DELETE FROM transactions");
    }
    if (data.free_meal_log.length > 0) {
      const ids = data.free_meal_log.map(x => x.id);
      await conn.query("DELETE FROM free_meal_logs WHERE id NOT IN (?)", [ids]);
    } else {
      await conn.query("DELETE FROM free_meal_logs");
    }

    if (data.system_settings && data.system_settings.length > 0) {
      const ids = data.system_settings.map(x => x.id);
      await conn.query("DELETE FROM system_settings WHERE id NOT IN (?)", [ids]);
    }
    if (data.audit_logs && data.audit_logs.length > 0) {
      const ids = data.audit_logs.map(x => x.id);
      await conn.query("DELETE FROM audit_logs WHERE id NOT IN (?)", [ids]);
    } else {
      await conn.query("DELETE FROM audit_logs");
    }
    if (data.login_attempts && data.login_attempts.length > 0) {
      const ids = data.login_attempts.map(x => x.id);
      await conn.query("DELETE FROM login_attempts WHERE id NOT IN (?)", [ids]);
    } else {
      await conn.query("DELETE FROM login_attempts");
    }

    await conn.commit();
  } catch (_syncError: any) {
    if (conn) {
      try { await conn.rollback(); } catch (_e) {}
    }
  } finally {
    if (conn) {
      try { conn.release(); } catch (_e) {}
    }
  }
}
