import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getOpenApiSpec } from '../services/openapiService.js';
import {
  mapDatabaseError,
  DuplicateKeyError,
  ForeignKeyViolationError,
  NotNullConstraintError,
  CheckConstraintError
} from '../errors.js';
import {
  validateRequestBody,
  requestValidator,
  findEndpointSchema,
  endpointSchemas,
  checkEndpointAuthorization
} from '../api.js';
import {
  CreateUserSchema,
  LoginSchema,
  DepartmentSchema,
  CashierProcessSchema,
  BatchScheduleSchema
} from '../schemas.js';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/openapi.json', (req, res) => {
  res.json(getOpenApiSpec());
});

app.get('/api/error-test', (req, res, next) => {
  const err: any = new Error('Test error');
  err.status = 400;
  next(err);
});

app.use((err: any, req: any, res: any, next: any) => {
  const appErr = mapDatabaseError(err);
  res.status(appErr.statusCode).json(appErr.toJSON());
});

describe('Server API and OpenAPI Tests', () => {
  it('GET /api/health should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/openapi.json should return valid OpenAPI specification', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toContain('DGMC');
  });

  it('Centralized error handler should catch and return formatted error', async () => {
    const res = await request(app).get('/api/error-test');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Test error');
    expect(res.body.success).toBe(false);
  });
});

describe('Database Constraint Error Wrapper & Standardization Tests', () => {
  it('should map MySQL ER_DUP_ENTRY duplicate key errors to 409 Conflict with human-readable message', () => {
    const rawMySQLErr = {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
      sqlState: '23000',
      sqlMessage: "Duplicate entry 'EMP-1042' for key 'people.employee_id_UNIQUE'"
    };

    const appErr = mapDatabaseError(rawMySQLErr);
    expect(appErr).toBeInstanceOf(DuplicateKeyError);
    expect(appErr.statusCode).toBe(409);
    expect(appErr.code).toBe('DUPLICATE_ENTRY');
    expect(appErr.message).toContain('Employee Number "EMP-1042" already exists');
    
    const json = appErr.toJSON();
    expect(json.success).toBe(false);
    expect(json.statusCode).toBe(409);
    expect(json.code).toBe('DUPLICATE_ENTRY');
  });

  it('should map SQLite UNIQUE constraint failed errors to 409 Conflict', () => {
    const rawSqliteErr = {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
      message: 'UNIQUE constraint failed: people.username'
    };

    const appErr = mapDatabaseError(rawSqliteErr);
    expect(appErr).toBeInstanceOf(DuplicateKeyError);
    expect(appErr.statusCode).toBe(409);
    expect(appErr.message).toContain('Username already exists');
  });

  it('should map foreign key deletion violation (MySQL 1451) to 409 Conflict with explanatory message', () => {
    const rawFkErr = {
      code: 'ER_ROW_IS_REFERENCED_2',
      errno: 1451,
      message: 'Cannot delete or update a parent row: a foreign key constraint fails (`dgmc`.`transactions`, CONSTRAINT `fk_trans_person` FOREIGN KEY (`employee_id`) REFERENCES `people` (`id`))'
    };

    const appErr = mapDatabaseError(rawFkErr);
    expect(appErr).toBeInstanceOf(ForeignKeyViolationError);
    expect(appErr.statusCode).toBe(409);
    expect(appErr.message).toContain('Cannot delete or update this record because other active records');
  });

  it('should map foreign key missing parent violation (MySQL 1452) to 400 Bad Request', () => {
    const rawFkErr = {
      code: 'ER_NO_REFERENCED_ROW_2',
      errno: 1452,
      message: 'Cannot add or update a child row: a foreign key constraint fails (`dgmc`.`people`, CONSTRAINT `fk_person_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`))'
    };

    const appErr = mapDatabaseError(rawFkErr);
    expect(appErr).toBeInstanceOf(ForeignKeyViolationError);
    expect(appErr.statusCode).toBe(400);
    expect(appErr.message).toContain('The referenced parent record');
  });

  it('should map NOT NULL constraint errors to 400 Bad Request with field identification', () => {
    const rawNotNullErr = {
      code: 'ER_BAD_NULL_ERROR',
      errno: 1048,
      message: "Column 'first_name' cannot be null"
    };

    const appErr = mapDatabaseError(rawNotNullErr);
    expect(appErr).toBeInstanceOf(NotNullConstraintError);
    expect(appErr.statusCode).toBe(400);
    expect(appErr.message).toContain('First Name is mandatory');
  });

  it('should map CHECK constraint errors to 400 Bad Request', () => {
    const rawCheckErr = {
      code: 'ER_CHECK_CONSTRAINT_VIOLATED',
      errno: 3819,
      message: "Check constraint 'chk_meal_amount' is violated."
    };

    const appErr = mapDatabaseError(rawCheckErr);
    expect(appErr).toBeInstanceOf(CheckConstraintError);
    expect(appErr.statusCode).toBe(400);
    expect(appErr.message).toContain('violate database validation constraints');
  });
});

describe('API Request Schema Validation Helper Tests', () => {
  it('should match static and parameterized endpoint route schemas correctly', () => {
    const loginSchema = findEndpointSchema('POST', '/api/auth/login');
    expect(loginSchema).toBeDefined();

    const editPersonSchema = findEndpointSchema('PUT', '/api/admin/people/42');
    expect(editPersonSchema).toBeDefined();

    const deptUpdateSchema = findEndpointSchema('PUT', '/api/departments/10');
    expect(deptUpdateSchema).toBeDefined();

    const scanSchema = findEndpointSchema('POST', '/api/cashier/scan');
    expect(scanSchema).toBeDefined();
  });

  it('should successfully validate well-formed user creation payloads with Zod', () => {
    const validUser = {
      first_name: 'Jane',
      last_name: 'Doe',
      username: 'jane_doe',
      password: 'SecurePassword123!',
      role: 'manager',
      email: 'jane@example.com',
      is_active: true
    };

    const res = validateRequestBody(validUser, CreateUserSchema);
    expect(res.ok).toBe(true);
    expect(res.data?.username).toBe('jane_doe');
    expect(res.error).toBeUndefined();
  });

  it('should catch missing required fields and type mismatches with field-level errors', () => {
    const invalidUser = {
      first_name: 'Jane',
      // Missing last_name, username, password, and invalid role
      role: 'super_admin'
    };

    const res = validateRequestBody(invalidUser, CreateUserSchema);
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.details).toBeDefined();
  });

  it('should validate cashier transaction processing payloads with proper numeric types', () => {
    const validProcess = {
      person_id: 15,
      is_free: false,
      meal_amount: 85.50
    };

    const validRes = validateRequestBody(validProcess, CashierProcessSchema);
    expect(validRes.ok).toBe(true);
    expect(validRes.data?.person_id).toBe(15);

    const invalidProcess = {
      person_id: 'not-a-number' as any,
      meal_amount: -20
    };

    const invalidRes = validateRequestBody(invalidProcess, CashierProcessSchema);
    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.error).toBeDefined();
  });

  it('should validate declarative schema field rules dictionary', () => {
    const rules = {
      name: { type: 'string' as const, required: true, min: 2 },
      count: { type: 'number' as const, required: true, min: 1 }
    };

    const validData = { name: 'Cardiology', count: 12 };
    const validRes = validateRequestBody(validData, rules);
    expect(validRes.ok).toBe(true);
    expect(validRes.data?.name).toBe('Cardiology');

    const invalidData = { name: 'C', count: 0 };
    const invalidRes = validateRequestBody(invalidData, rules);
    expect(invalidRes.ok).toBe(false);
  });
});

describe('Role-Based Endpoint Authorization Guard Tests', () => {
  const employeeUser: any = { id: 1, role: 'employee', username: 'emp1', is_active: true };
  const cashierUser: any = { id: 2, role: 'cashier', username: 'cashier1', is_active: true };
  const managerUser: any = { id: 3, role: 'manager', username: 'manager1', is_active: true };
  const dietaryAdminUser: any = { id: 4, role: 'dietary_admin', username: 'dietary1', is_active: true };
  const adminUser: any = { id: 5, role: 'admin', username: 'admin1', is_active: true };

  it('should allow public endpoints without an authenticated user', () => {
    expect(checkEndpointAuthorization('GET', '/api/health', null).authorized).toBe(true);
    expect(checkEndpointAuthorization('GET', '/api/public-stats', null).authorized).toBe(true);
    expect(checkEndpointAuthorization('GET', '/api/docs', null).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/auth/login', null).authorized).toBe(true);
    expect(checkEndpointAuthorization('GET', '/api/settings', null).authorized).toBe(true);
  });

  it('should reject unauthenticated requests to protected endpoints with 401 Unauthorized', () => {
    const res = checkEndpointAuthorization('GET', '/api/admin/people', null);
    expect(res.authorized).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.code).toBe('UNAUTHORIZED');
  });

  it('should reject employees from accessing administrative routes with 403 Forbidden', () => {
    const res = checkEndpointAuthorization('GET', '/api/admin/people', employeeUser);
    expect(res.authorized).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.code).toBe('FORBIDDEN');
    expect(res.requiredRoles).toContain('admin');
  });

  it('should reject employees from accessing manager routes with 403 Forbidden', () => {
    const res = checkEndpointAuthorization('GET', '/api/manager/employees', employeeUser);
    expect(res.authorized).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.code).toBe('FORBIDDEN');
  });

  it('should reject cashiers from accessing manager routes with 403 Forbidden', () => {
    const res = checkEndpointAuthorization('POST', '/api/manager/toggle-schedule', cashierUser);
    expect(res.authorized).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.code).toBe('FORBIDDEN');
  });

  it('should allow cashiers and admins to access cashier routes', () => {
    expect(checkEndpointAuthorization('POST', '/api/cashier/scan', cashierUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/cashier/scan', adminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/cashier/scan', employeeUser).authorized).toBe(false);
  });

  it('should allow managers and admins to access manager routes', () => {
    expect(checkEndpointAuthorization('GET', '/api/manager/stats', managerUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('GET', '/api/manager/stats', adminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('GET', '/api/manager/stats', cashierUser).authorized).toBe(false);
  });

  it('should allow AI insights access for admin, dietary_admin, and manager roles', () => {
    expect(checkEndpointAuthorization('POST', '/api/admin/ai-insights', adminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/admin/ai-insights', dietaryAdminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/admin/ai-insights', managerUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/admin/ai-insights', employeeUser).authorized).toBe(false);
    expect(checkEndpointAuthorization('POST', '/api/admin/ai-insights', cashierUser).authorized).toBe(false);
  });

  it('should restrict super admin diagnostics only to admin role', () => {
    expect(checkEndpointAuthorization('GET', '/api/admin/sys-health', adminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('GET', '/api/admin/sys-health', dietaryAdminUser).authorized).toBe(false);
    expect(checkEndpointAuthorization('GET', '/api/admin/sys-health', managerUser).authorized).toBe(false);
  });

  it('should restrict settings and department modifications to admin / dietary_admin', () => {
    expect(checkEndpointAuthorization('POST', '/api/departments', adminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/departments', dietaryAdminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('POST', '/api/departments', managerUser).authorized).toBe(false);
    expect(checkEndpointAuthorization('POST', '/api/departments', employeeUser).authorized).toBe(false);

    expect(checkEndpointAuthorization('PUT', '/api/settings', adminUser).authorized).toBe(true);
    expect(checkEndpointAuthorization('PUT', '/api/settings', managerUser).authorized).toBe(false);
  });
});

describe('requestValidator Helper Tests', () => {
  it('should return valid data when request body conforms to schema', () => {
    const validPayload = {
      username: 'johndoe',
      password: 'password123'
    };

    const res = requestValidator(LoginSchema, validPayload);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.username).toBe('johndoe');
    }
  });

  it('should return 400 Bad Request errorResponse when required fields are missing or invalid', () => {
    const invalidPayload = {
      username: ''
      // Missing password
    };

    const res = requestValidator(LoginSchema, invalidPayload);
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.errorResponse.status).toBe(400);
      const responseBody = res.errorResponse.body;
      expect(responseBody.statusCode).toBe(400);
      expect(responseBody.code).toBe('VALIDATION_ERROR');
      expect(res.error).toBeDefined();
    }
  });

  it('should validate dictionary schemas and reject incorrect data types', () => {
    const schema = {
      name: { type: 'string' as const, required: true },
      price: { type: 'number' as const, required: true }
    };

    const invalid = { name: 'Soup', price: 'free' };
    const res = requestValidator(schema, invalid);
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.errorResponse.status).toBe(400);
    }
  });
});


