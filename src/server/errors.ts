/**
 * Standardized Application & Database Error System
 * Maps database constraints, schema errors, and operational exceptions to human-readable messages.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly field?: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: any,
    field?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.field = field;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.field ? { field: this.field } : {}),
      ...(this.details !== undefined ? { details: this.details } : {}),
      timestamp: new Date().toISOString()
    };
  }
}

export class DatabaseConstraintError extends AppError {
  public readonly constraintType:
    | "unique"
    | "foreign_key"
    | "not_null"
    | "check"
    | "data_length"
    | "lock"
    | "connection"
    | "general";

  constructor(
    message: string,
    statusCode: number,
    code: string,
    constraintType: DatabaseConstraintError["constraintType"],
    details?: any,
    field?: string
  ) {
    super(message, statusCode, code, details, field);
    this.constraintType = constraintType;
  }
}

export class DuplicateKeyError extends DatabaseConstraintError {
  constructor(message: string, details?: any, field?: string) {
    super(
      message || "A record with this identifier or unique value already exists.",
      409,
      "DUPLICATE_ENTRY",
      "unique",
      details,
      field
    );
  }
}

export class ForeignKeyViolationError extends DatabaseConstraintError {
  constructor(message: string, isDeletion = false, details?: any, field?: string) {
    super(
      message ||
        (isDeletion
          ? "Cannot delete this record because other active records depend on it."
          : "The referenced related record does not exist in the database."),
      isDeletion ? 409 : 400,
      "FOREIGN_KEY_VIOLATION",
      "foreign_key",
      details,
      field
    );
  }
}

export class NotNullConstraintError extends DatabaseConstraintError {
  constructor(message: string, details?: any, field?: string) {
    super(
      message || "A mandatory database field was omitted or left empty.",
      400,
      "NOT_NULL_VIOLATION",
      "not_null",
      details,
      field
    );
  }
}

export class CheckConstraintError extends DatabaseConstraintError {
  constructor(message: string, details?: any, field?: string) {
    super(
      message || "The provided data violates system range or format validation rules.",
      400,
      "CHECK_CONSTRAINT_VIOLATION",
      "check",
      details,
      field
    );
  }
}

export class DataLengthConstraintError extends DatabaseConstraintError {
  constructor(message: string, details?: any, field?: string) {
    super(
      message || "The provided text exceeds the maximum allowable length for this field.",
      400,
      "DATA_TOO_LONG",
      "data_length",
      details,
      field
    );
  }
}

export class DatabaseLockError extends DatabaseConstraintError {
  constructor(message: string, details?: any) {
    super(
      message || "The database is currently experiencing high contention. Please retry your request shortly.",
      503,
      "DATABASE_LOCK_TIMEOUT",
      "lock",
      details
    );
  }
}

export class DatabaseConnectionError extends DatabaseConstraintError {
  constructor(message: string, details?: any) {
    super(
      message || "The database connection is temporarily unavailable. Please retry in a moment.",
      503,
      "DATABASE_UNAVAILABLE",
      "connection",
      details
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any, field?: string) {
    super(message || "Invalid request payload.", 400, "VALIDATION_ERROR", details, field);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required. Please provide a valid session token.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Access Denied: You do not have sufficient privileges for this resource.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "A conflict occurred while processing the resource state.", details?: any) {
    super(message, 409, "RESOURCE_CONFLICT", details);
  }
}

/**
 * Maps field/column technical identifiers to user-friendly human labels
 */
function humanizeFieldName(rawField: string): string {
  const normalized = rawField.toLowerCase().trim();
  if (normalized.includes("employee_id") || normalized.includes("employee_number")) return "Employee Number";
  if (normalized.includes("rfid") || normalized.includes("badge")) return "RFID / Badge ID";
  if (normalized.includes("username")) return "Username";
  if (normalized.includes("email")) return "Email Address";
  if (normalized.includes("department_id") || normalized.includes("dept")) return "Department";
  if (normalized.includes("first_name")) return "First Name";
  if (normalized.includes("last_name")) return "Last Name";
  if (normalized.includes("password")) return "Password";
  if (normalized.includes("meal_price")) return "Meal Price";
  if (normalized.includes("setting_key")) return "Setting Key";
  if (normalized.includes("name")) return "Name";
  return rawField.replace(/_/g, " ");
}

/**
 * Standardizes any database error (MySQL, SQLite, ORM, etc.) or operational error
 * into a structured, human-readable AppError instance.
 */
export function mapDatabaseError(err: any): AppError {
  if (!err) {
    return new AppError("An unexpected server error occurred.", 500, "INTERNAL_SERVER_ERROR");
  }

  // Already a structured AppError
  if (err instanceof AppError) {
    return err;
  }

  const errCode = String(err.code || err.errno || "").toUpperCase();
  const rawMsg = String(err.sqlMessage || err.message || err);
  const sqlState = String(err.sqlState || "");

  // -------------------------------------------------------------
  // 1. DUPLICATE KEY / UNIQUE CONSTRAINT (MySQL 1062, ER_DUP_ENTRY, SQLite SQLITE_CONSTRAINT_UNIQUE)
  // -------------------------------------------------------------
  if (
    errCode === "ER_DUP_ENTRY" ||
    errCode === "1062" ||
    sqlState === "23000" ||
    errCode === "SQLITE_CONSTRAINT_UNIQUE" ||
    errCode === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    rawMsg.includes("Duplicate entry") ||
    rawMsg.includes("UNIQUE constraint failed") ||
    rawMsg.includes("PRIMARY KEY must be unique")
  ) {
    let duplicateValue = "";
    let fieldIdentifier = "";

    // Parse MySQL: Duplicate entry 'XYZ' for key 'table.field_name'
    const mysqlMatch = rawMsg.match(/Duplicate entry '([^']+)' for key '([^']+)'/i);
    if (mysqlMatch) {
      duplicateValue = mysqlMatch[1];
      fieldIdentifier = mysqlMatch[2];
    } else {
      // Parse SQLite: UNIQUE constraint failed: table.column
      const sqliteMatch = rawMsg.match(/UNIQUE constraint failed: (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)/i);
      if (sqliteMatch) {
        fieldIdentifier = sqliteMatch[1];
      }
    }

    const fieldLabel = fieldIdentifier ? humanizeFieldName(fieldIdentifier) : "";
    let friendlyMessage = "A record with this unique identifier already exists in the system.";

    if (fieldLabel) {
      if (duplicateValue) {
        friendlyMessage = `A record with ${fieldLabel} "${duplicateValue}" already exists. Duplicate values are not permitted.`;
      } else {
        friendlyMessage = `A record with this ${fieldLabel} already exists in the database. Please provide a unique value.`;
      }
    } else if (duplicateValue) {
      friendlyMessage = `A record with identifier "${duplicateValue}" already exists. Please provide a different value.`;
    }

    return new DuplicateKeyError(
      friendlyMessage,
      { rawCode: errCode, duplicateValue: duplicateValue || undefined, key: fieldIdentifier || undefined },
      fieldIdentifier || undefined
    );
  }

  // -------------------------------------------------------------
  // 2. FOREIGN KEY CONSTRAINT VIOLATIONS (MySQL 1451, 1452, 1216, 1217, SQLite SQLITE_CONSTRAINT_FOREIGNKEY)
  // -------------------------------------------------------------
  if (
    errCode === "ER_ROW_IS_REFERENCED_2" ||
    errCode === "ER_ROW_IS_REFERENCED" ||
    errCode === "1451" ||
    errCode === "1217" ||
    (rawMsg.includes("foreign key constraint fails") && rawMsg.includes("Cannot delete or update a parent row"))
  ) {
    return new ForeignKeyViolationError(
      "Cannot delete or update this record because other active records (such as meal transactions, schedules, or personnel profiles) depend on it. Please reassign or clear dependent records first.",
      true,
      { rawCode: errCode, constraint: "parent_row_is_referenced" }
    );
  }

  if (
    errCode === "ER_NO_REFERENCED_ROW_2" ||
    errCode === "ER_NO_REFERENCED_ROW" ||
    errCode === "1452" ||
    errCode === "1216" ||
    (rawMsg.includes("foreign key constraint fails") && rawMsg.includes("Cannot add or update a child row"))
  ) {
    return new ForeignKeyViolationError(
      "The referenced parent record (such as the specified Department, Supervisor, or Employee) does not exist in the database. Please select a valid existing entity.",
      false,
      { rawCode: errCode, constraint: "referenced_row_missing" }
    );
  }

  if (
    errCode === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
    rawMsg.includes("FOREIGN KEY constraint failed")
  ) {
    return new ForeignKeyViolationError(
      "A foreign key reference constraint failed. Please ensure all related entities exist and have valid IDs.",
      false,
      { rawCode: errCode }
    );
  }

  // -------------------------------------------------------------
  // 3. NOT NULL / MISSING MANDATORY COLUMN (MySQL 1048, 1364, SQLite SQLITE_CONSTRAINT_NOTNULL)
  // -------------------------------------------------------------
  if (
    errCode === "ER_BAD_NULL_ERROR" ||
    errCode === "1048" ||
    errCode === "ER_NO_DEFAULT_FOR_FIELD" ||
    errCode === "1364" ||
    errCode === "SQLITE_CONSTRAINT_NOTNULL" ||
    rawMsg.includes("cannot be null") ||
    rawMsg.includes("NOT NULL constraint failed")
  ) {
    let fieldIdentifier = "";
    const colMatch = rawMsg.match(/Column '([^']+)' cannot be null/i) ||
                     rawMsg.match(/Field '([^']+)' doesn't have a default value/i) ||
                     rawMsg.match(/NOT NULL constraint failed: (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)/i);
    if (colMatch) {
      fieldIdentifier = colMatch[1];
    }

    const fieldLabel = fieldIdentifier ? humanizeFieldName(fieldIdentifier) : "A required field";
    return new NotNullConstraintError(
      `${fieldLabel} is mandatory and cannot be empty. Please provide a valid value.`,
      { rawCode: errCode, field: fieldIdentifier || undefined },
      fieldIdentifier || undefined
    );
  }

  // -------------------------------------------------------------
  // 4. DATA TOO LONG / VALUE TRUNCATION (MySQL 1406, 1264, SQLite SQLITE_TOOBIG)
  // -------------------------------------------------------------
  if (
    errCode === "ER_DATA_TOO_LONG" ||
    errCode === "1406" ||
    errCode === "ER_WARN_DATA_OUT_OF_RANGE" ||
    errCode === "1264" ||
    errCode === "SQLITE_TOOBIG" ||
    rawMsg.includes("Data too long") ||
    rawMsg.includes("Out of range value")
  ) {
    let fieldIdentifier = "";
    const match = rawMsg.match(/Data too long for column '([^']+)'/i);
    if (match) {
      fieldIdentifier = match[1];
    }
    const fieldLabel = fieldIdentifier ? humanizeFieldName(fieldIdentifier) : "The provided input";
    return new DataLengthConstraintError(
      `${fieldLabel} exceeds the maximum allowable length or range. Please shorten the entered text.`,
      { rawCode: errCode, field: fieldIdentifier || undefined },
      fieldIdentifier || undefined
    );
  }

  // -------------------------------------------------------------
  // 5. CHECK CONSTRAINT VIOLATION (MySQL 3819, SQLite SQLITE_CONSTRAINT_CHECK)
  // -------------------------------------------------------------
  if (
    errCode === "ER_CHECK_CONSTRAINT_VIOLATED" ||
    errCode === "3819" ||
    errCode === "SQLITE_CONSTRAINT_CHECK" ||
    rawMsg.includes("Check constraint") ||
    rawMsg.includes("CHECK constraint failed")
  ) {
    return new CheckConstraintError(
      "The provided values violate database validation constraints. Please verify that amounts, dates, and formats are valid.",
      { rawCode: errCode }
    );
  }

  // -------------------------------------------------------------
  // 6. LOCK WAIT TIMEOUT & DEADLOCK (MySQL 1205, 1213, SQLite SQLITE_BUSY, SQLITE_LOCKED)
  // -------------------------------------------------------------
  if (
    errCode === "ER_LOCK_WAIT_TIMEOUT" ||
    errCode === "1205" ||
    errCode === "ER_LOCK_DEADLOCK" ||
    errCode === "1213" ||
    errCode === "SQLITE_BUSY" ||
    errCode === "SQLITE_LOCKED" ||
    rawMsg.includes("Lock wait timeout") ||
    rawMsg.includes("Deadlock found") ||
    rawMsg.includes("database is locked") ||
    rawMsg.includes("database is busy")
  ) {
    return new DatabaseLockError(
      "The database is currently experiencing high concurrent write traffic. Please retry your request in a moment.",
      { rawCode: errCode }
    );
  }

  // -------------------------------------------------------------
  // 7. CONNECTION & NETWORK DISRUPTIONS
  // -------------------------------------------------------------
  if (
    errCode === "ECONNREFUSED" ||
    errCode === "ETIMEDOUT" ||
    errCode === "PROTOCOL_CONNECTION_LOST" ||
    errCode === "ER_ACCESS_DENIED_ERROR" ||
    errCode === "ENOTFOUND" ||
    rawMsg.includes("Connection lost") ||
    rawMsg.includes("ECONNREFUSED")
  ) {
    return new DatabaseConnectionError(
      "The primary database service is momentarily unreachable. Fallback mechanisms are maintaining operational continuity.",
      { rawCode: errCode }
    );
  }

  // -------------------------------------------------------------
  // 8. ZOD VALIDATION ERRORS
  // -------------------------------------------------------------
  if (err.name === "ZodError" && Array.isArray(err.issues)) {
    const errorMessages = err.issues.map((i: any) => {
      const fieldPath = i.path && i.path.length > 0 ? i.path.join(".") : "field";
      return `${humanizeFieldName(fieldPath)}: ${i.message}`;
    });
    return new ValidationError(
      `Input validation failed: ${errorMessages.join("; ")}`,
      { issues: err.issues }
    );
  }

  // -------------------------------------------------------------
  // 9. HTTP STATUS PRESERVATION (e.g. 400, 401, 403, 404, 409, 422, 429)
  // -------------------------------------------------------------
  const explicitStatus = typeof err.status === "number" ? err.status : (typeof err.statusCode === "number" ? err.statusCode : null);
  if (explicitStatus && explicitStatus >= 400 && explicitStatus < 500) {
    return new AppError(
      rawMsg || "The request could not be processed due to client error.",
      explicitStatus,
      err.code || (explicitStatus === 404 ? "NOT_FOUND" : explicitStatus === 401 ? "UNAUTHORIZED" : explicitStatus === 403 ? "FORBIDDEN" : "CLIENT_ERROR"),
      err.details
    );
  }

  // -------------------------------------------------------------
  // 10. FALLBACK TO STANDARDIZED INTERNAL ERROR
  // -------------------------------------------------------------
  return new AppError(
    rawMsg || "An unexpected database or server error occurred.",
    500,
    errCode || "INTERNAL_SERVER_ERROR",
    process.env.NODE_ENV !== "production" ? err.stack : undefined
  );
}
