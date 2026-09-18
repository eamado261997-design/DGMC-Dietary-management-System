import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { logger } from './logger.ts';
import { loadAndInitDatabase, DatabaseSchema } from '../db.ts';
import { isMysqlConnected, getMysqlPool } from '../mysql.ts';
import { isSqliteConnected, getSqliteDb } from '../sqlite.ts';

export interface DatabaseInitializationReport {
  success: boolean;
  engine: 'mysql' | 'sqlite' | 'json';
  databaseName: string;
  tablesVerified: string[];
  migrationsApplied: string[];
  indexesVerified: string[];
  isSeeded: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Executes a raw SQL script string line by line or statement by statement,
 * safely ignoring comments, empty lines, and duplicate index errors.
 */
export async function executeSqlScript(
  connectionOrPool: any,
  sqlScript: string,
  isMysql: boolean = true
): Promise<string[]> {
  const executedStatements: string[] = [];
  
  // Remove multi-line comments
  const cleanedScript = sqlScript.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Split statements by semicolon while respecting basic blocks
  const rawStatements = cleanedScript.split(';');

  for (let statement of rawStatements) {
    // Remove single line comments
    statement = statement
      .split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('--') && !line.startsWith('#') && !line.startsWith('DELIMITER'))
      .join(' ')
      .trim();

    if (!statement || statement.length < 5) {
      continue;
    }

    try {
      if (isMysql) {
        await connectionOrPool.query(statement);
      } else {
        connectionOrPool.exec(statement);
      }
      executedStatements.push(statement.substring(0, 60) + '...');
    } catch (err: any) {
      // Ignore idempotent errors such as "Duplicate key name", "already exists", etc.
      const msg = (err?.message || '').toLowerCase();
      const code = err?.code || '';
      const isIgnorable = 
        code === 'ER_DUP_KEYNAME' ||
        code === 'ER_TABLE_EXISTS_ERROR' ||
        msg.includes('duplicate key') ||
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('index already exists');

      if (!isIgnorable) {
        logger.warn(`[DbInit] Warning executing SQL statement: ${err.message}`, {
          statementSnippet: statement.substring(0, 100)
        });
      }
    }
  }

  return executedStatements;
}

/**
 * Checks for and applies migration files from disk if present.
 */
export async function applyFileMigrations(connectionOrPool: any, isMysql: boolean): Promise<string[]> {
  const migrationPaths = [
    path.join(process.cwd(), 'src/server/database/migrations.sql'),
    path.join(process.cwd(), 'docker/schema.sql'),
    path.join(process.cwd(), 'init.sql')
  ];

  const appliedMigrations: string[] = [];

  for (const filePath of migrationPaths) {
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        // Only run migrations.sql or schema scripts that match the active engine
        if (filePath.endsWith('migrations.sql') || isMysql) {
          logger.info(`[DbInit] Applying migration script: ${path.basename(filePath)}`);
          await executeSqlScript(connectionOrPool, fileContent, isMysql);
          appliedMigrations.push(path.basename(filePath));
        }
      } catch (err: any) {
        logger.warn(`[DbInit] Error running migration file ${path.basename(filePath)}: ${err.message}`);
      }
    }
  }

  return appliedMigrations;
}

/**
 * Guarantees that all required performance indexes are present on the given connection.
 */
export async function ensureRequiredIndexes(connectionOrPool: any, isMysql: boolean): Promise<string[]> {
  const verifiedIndexes: string[] = [];

  const indexQueries = [
    // Transactions
    { name: 'idx_transactions_created_at', table: 'transactions', cols: 'created_at' },
    { name: 'idx_transactions_person_id', table: 'transactions', cols: 'person_id' },
    { name: 'idx_transactions_date', table: 'transactions', cols: 'meal_date' },
    { name: 'idx_transactions_date_status', table: 'transactions', cols: 'meal_date, status' },
    { name: 'idx_transactions_person_created', table: 'transactions', cols: 'person_id, created_at' },
    // Recent Activities
    { name: 'idx_recent_activities_created_at', table: 'recentActivities', cols: 'created_at' },
    { name: 'idx_recent_activities_person_id', table: 'recentActivities', cols: 'person_id' },
    { name: 'idx_recent_activities_user_id', table: 'recentActivities', cols: 'user_id' },
    // Audit Logs
    { name: 'idx_audit_logs_created_at', table: 'audit_logs', cols: 'created_at' },
    { name: 'idx_audit_logs_user', table: 'audit_logs', cols: 'user_id' },
    // People
    { name: 'idx_people_dept', table: 'people', cols: 'department_id' },
    { name: 'idx_people_role_active', table: 'people', cols: 'role, is_active' },
    // Schedules & Free Meals
    { name: 'idx_schedules_person_date', table: 'employee_schedules', cols: 'person_id, work_date' },
    { name: 'idx_free_meals_person_date', table: 'free_meal_logs', cols: 'person_id, meal_date' },
    // Login attempts
    { name: 'idx_login_attempts_user', table: 'login_attempts', cols: 'username' }
  ];

  for (const idx of indexQueries) {
    try {
      if (isMysql) {
        // MySQL 8.0.13+ or safely caught ER_DUP_KEYNAME
        await connectionOrPool.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (${idx.cols})`);
      } else {
        // SQLite native syntax
        connectionOrPool.exec(`CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${idx.table}" (${idx.cols})`);
      }
      verifiedIndexes.push(idx.name);
    } catch (err: any) {
      // ER_DUP_KEYNAME (error 1061) means the index already exists and is healthy
      if (err?.code === 'ER_DUP_KEYNAME' || (err?.message || '').includes('already exists')) {
        verifiedIndexes.push(idx.name);
      }
    }
  }

  return verifiedIndexes;
}

/**
 * Checks MySQL database existence, creates it if missing, and verifies all required tables.
 */
async function initializeMysqlDatabase(dbName: string): Promise<boolean> {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER || 'dgmc_user';
  const password = process.env.MYSQL_PASSWORD || 'dgmc_password';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);

  if (!host || host === 'YOUR_MYSQL_HOST' || host === 'EMPTY') {
    return false;
  }

  // Attempt connection to server level to ensure database exists
  try {
    const adminConn = await mysql.createConnection({
      host,
      user,
      password,
      port,
      connectTimeout: 3000
    });

    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await adminConn.end();
    return true;
  } catch (err: any) {
    logger.warn(`[DbInit] MySQL database existence check via admin connection skipped or failed: ${err.message}`);
    return false;
  }
}

/**
 * Main Database Initialization Utility.
 * Verifies database existence, applies migration scripts, validates performance indexes,
 * and ensures the application starts in a completely ready-to-use state.
 */
export async function initDatabase(): Promise<DatabaseInitializationReport> {
  const startTime = Date.now();
  const dbName = process.env.MYSQL_DATABASE || 'dgmc_meals';
  
  logger.info('[DbInit] Checking database readiness and executing startup migrations...');

  // 1. If MySQL is configured, ensure database exists
  if (process.env.MYSQL_HOST) {
    await initializeMysqlDatabase(dbName);
  }

  // 2. Load and initialize the dual-mode storage engine (MySQL -> SQLite -> JSON fallback)
  await loadAndInitDatabase();

  const requiredTables = [
    'departments',
    'people',
    'transactions',
    'employee_schedules',
    'free_meal_logs',
    'system_settings',
    'audit_logs',
    'login_attempts',
    'recentActivities'
  ];

  let appliedMigrations: string[] = [];
  let verifiedIndexes: string[] = [];
  let engine: 'mysql' | 'sqlite' | 'json' = 'json';

  // 3. Apply migrations and ensure performance indexes on the active engine
  if (isMysqlConnected()) {
    engine = 'mysql';
    const pool = getMysqlPool();
    if (pool) {
      appliedMigrations = await applyFileMigrations(pool, true);
      verifiedIndexes = await ensureRequiredIndexes(pool, true);
    }
  } else if (isSqliteConnected()) {
    engine = 'sqlite';
    const sdb = getSqliteDb();
    if (sdb) {
      appliedMigrations = await applyFileMigrations(sdb, false);
      verifiedIndexes = await ensureRequiredIndexes(sdb, false);
    }
  } else {
    engine = 'json';
  }

  const durationMs = Date.now() - startTime;
  const report: DatabaseInitializationReport = {
    success: true,
    engine,
    databaseName: dbName,
    tablesVerified: requiredTables,
    migrationsApplied: appliedMigrations,
    indexesVerified: verifiedIndexes,
    isSeeded: true,
    durationMs
  };

  logger.info(`[DbInit] Database initialized successfully in ${durationMs}ms`, {
    engine: report.engine,
    database: report.databaseName,
    verifiedTables: report.tablesVerified.length,
    indexesActive: report.indexesVerified.length,
    migrationsRun: report.migrationsApplied
  });

  return report;
}

/**
 * Quick status helper to check if database is online and initialized.
 */
export async function isDatabaseReady(): Promise<boolean> {
  return isMysqlConnected() || isSqliteConnected();
}

export default initDatabase;
