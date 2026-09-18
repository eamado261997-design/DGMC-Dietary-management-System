import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { logger } from './logger.ts';
import { loadAndInitDatabase } from '../db.ts';
import { isMysqlConnected, getMysqlPool } from '../mysql.ts';
import { isSqliteConnected, getSqliteDb } from '../sqlite.ts';

const REQUIRED_TABLES = [
  'departments',
  'people',
  'transactions',
  'employee_schedules',
  'free_meal_logs',
  'system_settings',
  'audit_logs',
  'recentActivities'
];

/**
 * Splits and executes SQL script statements safely.
 */
export async function executeSqlStatements(
  executor: (stmt: string) => Promise<any> | any,
  sqlContent: string
): Promise<number> {
  // Strip block comments
  const cleanContent = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Custom delimiter support (e.g., DELIMITER // ... //)
  const statements: string[] = [];
  const lines = cleanContent.split(/\r?\n/);
  let currentDelimiter = ';';
  let buffer = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('#')) {
      continue;
    }
    if (trimmed.toUpperCase().startsWith('DELIMITER ')) {
      currentDelimiter = trimmed.substring(10).trim();
      continue;
    }

    buffer += line + '\n';
    if (buffer.trim().endsWith(currentDelimiter)) {
      const statementToExec = buffer.trim().slice(0, -currentDelimiter.length).trim();
      if (statementToExec.length > 0) {
        statements.push(statementToExec);
      }
      buffer = '';
    }
  }

  if (buffer.trim().length > 0) {
    statements.push(buffer.trim());
  }

  let executedCount = 0;
  for (const stmt of statements) {
    if (!stmt || stmt.length < 3) continue;
    try {
      await executor(stmt);
      executedCount++;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const code = err?.code || '';
      // Safe to ignore duplicate indexes/tables/columns
      const isIgnorable = 
        code === 'ER_DUP_KEYNAME' ||
        code === 'ER_TABLE_EXISTS_ERROR' ||
        msg.includes('duplicate key') ||
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('index already exists');

      if (!isIgnorable) {
        logger.warn(`[DbInit] Statement warning: ${err.message}`, {
          snippet: stmt.substring(0, 80)
        });
      }
    }
  }

  return executedCount;
}

/**
 * Locates the most appropriate schema.sql file in the project.
 */
function findSchemaSqlFile(): string | null {
  const candidatePaths = [
    path.join(process.cwd(), 'schema.sql'),
    path.join(process.cwd(), 'docker/schema.sql'),
    path.join(process.cwd(), 'docker-entrypoint-initdb.d/schema.sql'),
    path.join(process.cwd(), 'init.sql')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Verifies database connection and checks if required tables are missing.
 * If tables are missing, executes 'schema.sql' to ensure the database schema is fully present.
 */
export async function initializeDatabase(): Promise<boolean> {
  const startTime = Date.now();
  logger.info('[DbInit] Verifying database connection and schema state...');

  // 1. Establish and verify connection
  try {
    await loadAndInitDatabase();
  } catch (loadErr: any) {
    logger.warn(`[DbInit] Notice during primary storage init: ${loadErr.message}`);
  }

  let pool = getMysqlPool();
  let activeEngine: 'mysql' | 'sqlite' | 'json' = 'json';
  let existingTables: string[] = [];

  if (isMysqlConnected() && pool) {
    activeEngine = 'mysql';
    try {
      const dbName = process.env.MYSQL_DATABASE || 'dgmc_meals';
      const [rows]: any = await pool.query(
        'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ?',
        [dbName]
      );
      existingTables = Array.isArray(rows) ? rows.map((r: any) => (r.TABLE_NAME || r.table_name || '').toLowerCase()) : [];
      logger.info(`[DbInit] Connected to MySQL (${dbName}). Found ${existingTables.length} tables.`);
    } catch (queryErr: any) {
      logger.warn(`[DbInit] Could not query information_schema: ${queryErr.message}`);
    }
  } else if (isSqliteConnected()) {
    activeEngine = 'sqlite';
    try {
      const sdb = getSqliteDb();
      if (sdb) {
        const rows: any = sdb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        existingTables = rows.map((r: any) => (r.name || '').toLowerCase());
        logger.info(`[DbInit] Connected to SQLite. Found ${existingTables.length} tables.`);
      }
    } catch (sErr: any) {
      logger.warn(`[DbInit] Could not query sqlite_master: ${sErr.message}`);
    }
  }

  // 2. Determine Missing Tables
  const missingTables = REQUIRED_TABLES.filter(tbl => !existingTables.includes(tbl.toLowerCase()));

  // 3. Execute schema.sql if tables are missing or not fully created
  if (missingTables.length > 0) {
    logger.info(`[DbInit] Tables missing or needing initialization: [${missingTables.join(', ')}]. Executing schema.sql...`);
    const schemaFile = findSchemaSqlFile();

    if (schemaFile) {
      try {
        const schemaSql = fs.readFileSync(schemaFile, 'utf-8');
        if (activeEngine === 'mysql' && pool) {
          const executed = await executeSqlStatements((stmt) => pool!.query(stmt), schemaSql);
          logger.info(`[DbInit] Successfully applied ${executed} statements from ${path.basename(schemaFile)} to MySQL`);
        } else if (activeEngine === 'sqlite') {
          const sdb = getSqliteDb();
          if (sdb) {
            const executed = await executeSqlStatements((stmt) => sdb.exec(stmt), schemaSql);
            logger.info(`[DbInit] Applied ${executed} statements from ${path.basename(schemaFile)} to SQLite`);
          }
        }
      } catch (schemaErr: any) {
        logger.error(`[DbInit] Error executing ${schemaFile}: ${schemaErr.message}`);
      }
    } else {
      logger.warn('[DbInit] schema.sql file not found on disk; proceeding with ORM/schema loader');
    }
  } else {
    logger.info('[DbInit] All core tables verified successfully.');
  }

  // 4. Guarantee complete application data seeding (admin accounts, default departments, settings)
  try {
    await loadAndInitDatabase();
    logger.info(`[DbInit] Database state verified and fully initialized in ${Date.now() - startTime}ms`);
    return true;
  } catch (seedErr: any) {
    logger.error(`[DbInit] Error during database load and seeding: ${seedErr.message}`);
    return false;
  }
}

// Alias for backwards compatibility
export const initDatabase = initializeDatabase;
export default initializeDatabase;
