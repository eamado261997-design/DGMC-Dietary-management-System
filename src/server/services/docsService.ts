import { endpointSchemas } from "../api.js";
import { schemas } from "../utils/securityUtils.js";

export interface ApiDocParameter {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  type: string;
  description?: string;
}

export interface ApiDocEndpoint {
  method: string;
  path: string;
  category: string;
  summary: string;
  description: string;
  authRequired: boolean;
  requiredRoles: string[];
  parameters: ApiDocParameter[];
  requestBody?: {
    required: boolean;
    contentType: string;
    schemaType?: string;
    fields?: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  };
  responses: Record<string, { description: string; sample?: any }>;
}

export interface ApiDocsResult {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  generatedAt: string;
  totalEndpoints: number;
  categories: string[];
  endpoints: ApiDocEndpoint[];
}

/**
 * Route metadata mapping providing semantic descriptions, categories,
 * summaries, parameters, and response expectations for known API endpoints.
 */
const routeMetadata: Record<string, Partial<ApiDocEndpoint>> = {
  // Public & Health
  "GET:/api/health": {
    category: "System & Diagnostics",
    summary: "System Health Status",
    description: "Returns health status, uptime, MySQL/SQLite connection state, CPU/Memory telemetry, and cache status.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Server is healthy or running in degraded fallback mode." }
    }
  },
  "GET:/api/health/db": {
    category: "System & Diagnostics",
    summary: "Database Connection Probe",
    description: "Detailed database connectivity check including MySQL pool statistics and SQLite WAL state.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Database status and pool metrics." }
    }
  },
  "GET:/api/db-status": {
    category: "System & Diagnostics",
    summary: "Database Configuration & Fallback Status",
    description: "Reports whether primary MySQL and secondary SQLite databases are active.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Database connection metadata." }
    }
  },
  "GET:/api/public-stats": {
    category: "Public Portal",
    summary: "Public Hospital Statistics & Branding",
    description: "Cached public metadata including hospital name, support hotline, meal price, and aggregated meal counters.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Public organization metadata." }
    }
  },
  "GET:/api/docs": {
    category: "Developer & Documentation",
    summary: "Dynamic API Route Documentation",
    description: "Reflects upon handleApiRequest, route registries, schemas, and RBAC authorization guards to output dynamic documentation.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Comprehensive API documentation payload (JSON) or interactive UI (HTML)." }
    }
  },
  "GET:/api/openapi.json": {
    category: "Developer & Documentation",
    summary: "OpenAPI 3.0 Specification",
    description: "Returns the OpenAPI 3.0 JSON specification for Swagger and Postman client generation.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "OpenAPI 3.0 spec JSON." }
    }
  },

  // Authentication
  "POST:/api/auth/login": {
    category: "Authentication",
    summary: "User Sign In",
    description: "Authenticates staff or administrator credentials and returns an encrypted JWT session token with CSRF protection.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Authentication successful, token and user profile returned." },
      "400": { description: "Missing username or password." },
      "401": { description: "Invalid credentials or account deactivated." }
    }
  },
  "GET:/api/auth/me": {
    category: "Authentication",
    summary: "Current Authenticated Session",
    description: "Returns the user profile, permissions, and active role for the provided Bearer token.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager", "cashier", "employee"],
    responses: {
      "200": { description: "Authenticated user object." },
      "401": { description: "Invalid or expired token." }
    }
  },
  "POST:/api/auth/change-password": {
    category: "Authentication",
    summary: "Change Own Password",
    description: "Allows an authenticated user to change their account password after validating old password.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager", "cashier", "employee"],
    responses: {
      "200": { description: "Password successfully updated." },
      "400": { description: "Validation error or old password mismatch." },
      "401": { description: "Authentication required." }
    }
  },
  "GET:/api/auth/verify": {
    category: "Authentication",
    summary: "Verify Session Token",
    description: "Validates if the current token is active and unexpired.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager", "cashier", "employee"],
    responses: {
      "200": { description: "Token is valid." }
    }
  },
  "POST:/api/auth/refresh": {
    category: "Authentication",
    summary: "Refresh JWT Token",
    description: "Issues a refreshed JWT token for continuing authenticated user sessions.",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Refreshed session token." }
    }
  },

  // Employees & Staff Management
  "GET:/api/employee/me": {
    category: "Employee Self-Service",
    summary: "Employee Profile & Meal Allowance",
    description: "Returns current employee profile, daily entitlement limits, and today's meal status.",
    authRequired: true,
    requiredRoles: ["employee", "manager", "cashier", "dietary_admin", "admin"],
    responses: {
      "200": { description: "Employee entitlement details." }
    }
  },
  "GET:/api/employee/history": {
    category: "Employee Self-Service",
    summary: "Employee Meal History",
    description: "Retrieves past meal swipes, transaction history, and QR scan timestamps for the logged-in employee.",
    authRequired: true,
    requiredRoles: ["employee", "manager", "cashier", "dietary_admin", "admin"],
    responses: {
      "200": { description: "List of employee meal transactions." }
    }
  },
  "GET:/api/admin/people": {
    category: "Staff Management",
    summary: "List All Staff & Accounts",
    description: "Retrieves complete staff list with role filters, department assignments, and search queries.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager"],
    responses: {
      "200": { description: "Array of staff profiles with decrypted fields." },
      "403": { description: "Forbidden." }
    }
  },
  "POST:/api/admin/people": {
    category: "Staff Management",
    summary: "Create New Staff Account",
    description: "Registers a new hospital employee or staff member with role and department assignments.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    responses: {
      "201": { description: "Staff account created successfully." },
      "400": { description: "Validation error or duplicate username/employee ID." }
    }
  },
  "PUT:/api/admin/people/:id": {
    category: "Staff Management",
    summary: "Update Staff Member Profile",
    description: "Updates employee details, department, active status, or dietary roles.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Staff member ID" }
    ],
    responses: {
      "200": { description: "Updated staff record." },
      "404": { description: "Staff member not found." }
    }
  },
  "DELETE:/api/admin/people/:id": {
    category: "Staff Management",
    summary: "Deactivate or Delete Staff Account",
    description: "Deactivates an employee account and logs the transition to the audit ledger.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Staff member ID" }
    ],
    responses: {
      "200": { description: "Staff member deactivated or removed." }
    }
  },
  "POST:/api/admin/people/:id/reset-password": {
    category: "Staff Management",
    summary: "Admin Password Reset",
    description: "Resets password for target employee and generates an audit log.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Staff member ID" }
    ],
    responses: {
      "200": { description: "Password successfully reset." }
    }
  },
  "GET:/api/admin/people/:id/lifecycle-status": {
    category: "Staff Management",
    summary: "Employee Lifecycle & Live Entitlement Status",
    description: "Detailed report of staff meal entitlements, schedule constraints, and active shift state.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Staff member ID" }
    ],
    responses: {
      "200": { description: "Lifecycle entitlements report." }
    }
  },
  "GET:/api/admin/lifecycle-docs": {
    category: "Staff Management",
    summary: "Employee Lifecycle Rules Documentation",
    description: "Returns reference guidelines for meal entitlement formulas, shift overlaps, and schedule rules.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager"],
    responses: {
      "200": { description: "Lifecycle specification docs." }
    }
  },

  // Cashier POS & Transactions
  "POST:/api/cashier/scan": {
    category: "Cashier POS",
    summary: "Process Meal QR Scan",
    description: "Validates employee QR badge/ID, verifies schedule, and records a free entitlement or paid meal transaction.",
    authRequired: true,
    requiredRoles: ["cashier", "admin"],
    responses: {
      "200": { description: "Meal transaction authorized and recorded." },
      "400": { description: "Invalid QR format or entitlement limit reached." }
    }
  },
  "POST:/api/cashier/process": {
    category: "Cashier POS",
    summary: "Manual POS Transaction Processing",
    description: "Processes custom cafeteria items, guest meals, or non-entitled transactions.",
    authRequired: true,
    requiredRoles: ["cashier", "admin"],
    responses: {
      "200": { description: "Transaction completed." }
    }
  },
  "POST:/api/cashier/transactions/:id/cancel": {
    category: "Cashier POS",
    summary: "Void / Cancel Transaction",
    description: "Voids an erroneous cashier transaction, reverses entitlement deductions, and logs the audit event.",
    authRequired: true,
    requiredRoles: ["cashier", "admin"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Transaction ID" }
    ],
    responses: {
      "200": { description: "Transaction canceled successfully." }
    }
  },
  "GET:/api/transactions/today": {
    category: "Cashier POS",
    summary: "Today's Transaction Log",
    description: "Retrieves list of today's meal transactions for the active cashier shift.",
    authRequired: true,
    requiredRoles: ["cashier", "admin", "manager"],
    responses: {
      "200": { description: "Array of completed transactions today." }
    }
  },

  // Schedules
  "GET:/api/manager/schedules": {
    category: "Duty Rosters & Scheduling",
    summary: "Get Department Schedules",
    description: "Fetches employee duty schedules and meal shift assignments across departments.",
    authRequired: true,
    requiredRoles: ["manager", "admin", "dietary_admin"],
    responses: {
      "200": { description: "List of employee schedule records." }
    }
  },
  "POST:/api/manager/toggle-schedule": {
    category: "Duty Rosters & Scheduling",
    summary: "Toggle Single Duty Day",
    description: "Toggles or sets the duty status for a staff member on a specific calendar date.",
    authRequired: true,
    requiredRoles: ["manager", "admin"],
    responses: {
      "200": { description: "Schedule updated." }
    }
  },
  "POST:/api/manager/batch-schedules": {
    category: "Duty Rosters & Scheduling",
    summary: "Batch Update Department Schedules",
    description: "Applies bulk shift and duty roster updates for multiple staff members simultaneously.",
    authRequired: true,
    requiredRoles: ["manager", "admin"],
    responses: {
      "200": { description: "Batch schedule update applied." }
    }
  },

  // Departments
  "GET:/api/departments": {
    category: "Departments",
    summary: "List Hospital Departments",
    description: "Returns all active hospital departments.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager", "cashier", "employee"],
    responses: {
      "200": { description: "Array of hospital departments." }
    }
  },
  "POST:/api/departments": {
    category: "Departments",
    summary: "Create Hospital Department",
    description: "Registers a new hospital department in the directory.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    responses: {
      "201": { description: "Department created." },
      "400": { description: "Department name duplicate or missing." }
    }
  },
  "PUT:/api/departments/:id": {
    category: "Departments",
    summary: "Update Department",
    description: "Renames or updates configuration of an existing hospital department.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Department ID" }
    ],
    responses: {
      "200": { description: "Department updated." }
    }
  },
  "DELETE:/api/departments/:id": {
    category: "Departments",
    summary: "Delete Department",
    description: "Removes an empty department after verifying no active staff are assigned.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    parameters: [
      { name: "id", in: "path", required: true, type: "number", description: "Department ID" }
    ],
    responses: {
      "200": { description: "Department deleted." }
    }
  },

  // System Settings
  "GET:/api/settings": {
    category: "System Settings",
    summary: "Get System Settings",
    description: "Fetches dietary shift hours, meal prices, daily allowance limits, and branding settings (unauthenticated returns public branding only).",
    authRequired: false,
    requiredRoles: [],
    responses: {
      "200": { description: "Key-value pair settings array." }
    }
  },
  "PUT:/api/settings": {
    category: "System Settings",
    summary: "Update System Configuration",
    description: "Modifies shift time windows, meal costs, daily limits, and security password policies.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    responses: {
      "200": { description: "Settings updated successfully." }
    }
  },
  "POST:/api/settings/logo": {
    category: "System Settings",
    summary: "Upload Hospital Branding Logo",
    description: "Uploads base64 brand logo for cafeteria portals and printed receipts.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    responses: {
      "200": { description: "Logo uploaded and applied." }
    }
  },

  // Reports & Auditing
  "GET:/api/admin/reports/meals": {
    category: "Reports & Analytics",
    summary: "Meal Allowance Consumption Reports",
    description: "Aggregates free and paid meal transaction statistics by date range, department, and shift type.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager", "cashier"],
    responses: {
      "200": { description: "Meal consumption aggregated report." }
    }
  },
  "GET:/api/audit-logs": {
    category: "Reports & Analytics",
    summary: "System Audit Trails",
    description: "Immutable security audit log of user actions, logins, permission updates, and cancellations.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin"],
    responses: {
      "200": { description: "Audit logs array." }
    }
  },

  // AI & Diagnostics
  "POST:/api/admin/ai-insights": {
    category: "AI & Intelligence",
    summary: "Gemini Dietary & Operations AI Advisor",
    description: "Analyzes today's meal consumption trends and cafeteria metrics to produce actionable dietary insights.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager"],
    responses: {
      "200": { description: "Generated AI analysis and recommendations." }
    }
  },
  "GET:/api/admin/sys-health": {
    category: "System & Diagnostics",
    summary: "Detailed Server Health & Telemetry",
    description: "Super Admin diagnostics including cache hit rates, memory pools, and DB performance.",
    authRequired: true,
    requiredRoles: ["admin"],
    responses: {
      "200": { description: "Diagnostics payload." }
    }
  },
  "GET:/api/admin/sys-perf": {
    category: "System & Diagnostics",
    summary: "Live API Benchmarks & Latency Logs",
    description: "Recent API request benchmarks with DB latency and round-trip execution times.",
    authRequired: true,
    requiredRoles: ["admin"],
    responses: {
      "200": { description: "Performance telemetry." }
    }
  },
  "POST:/api/admin/sys-health/cache/clear": {
    category: "System & Diagnostics",
    summary: "Purge System Cache",
    description: "Flushes L1 in-memory cache and L2 Redis keys for immediate consistency.",
    authRequired: true,
    requiredRoles: ["admin"],
    responses: {
      "200": { description: "Cache cleared successfully." }
    }
  },
  "POST:/api/admin/sys-health/failover/trigger": {
    category: "System & Diagnostics",
    summary: "Trigger Storage Failover",
    description: "Forces primary MySQL failover to SQLite backup mirror for high-availability testing.",
    authRequired: true,
    requiredRoles: ["admin"],
    responses: {
      "200": { description: "Failover triggered." }
    }
  },
  "POST:/api/admin/sys-health/failover/recover": {
    category: "System & Diagnostics",
    summary: "Recover Primary Storage",
    description: "Restores primary MySQL connection and syncs SQLite delta changes.",
    authRequired: true,
    requiredRoles: ["admin"],
    responses: {
      "200": { description: "Recovery complete." }
    }
  },
  "POST:/api/admin/decrypt-field": {
    category: "Security & Encryption",
    summary: "Decrypt Sensitive Field",
    description: "Decrypts encrypted AES-256 employee fields for privileged administrative viewing.",
    authRequired: true,
    requiredRoles: ["admin", "dietary_admin", "manager"],
    responses: {
      "200": { description: "Decrypted value." }
    }
  }
};

/**
 * Extracts schema fields and types for documentation.
 */
function extractSchemaDetails(schema: any): { schemaType?: string; fields?: Array<{ name: string; type: string; required: boolean; description?: string }> } {
  if (!schema) return {};

  // Zod Object Schema
  if (schema && schema._def && schema._def.shape) {
    const shape = typeof schema._def.shape === "function" ? schema._def.shape() : schema._def.shape;
    const fields = Object.entries(shape).map(([key, value]: [string, any]) => {
      let typeName = "string";
      let isRequired = true;
      let description: string | undefined;

      let currentDef = value?._def;
      while (currentDef) {
        if (currentDef.typeName === "ZodOptional" || currentDef.typeName === "ZodNullable" || currentDef.typeName === "ZodDefault") {
          isRequired = false;
          currentDef = currentDef.innerType?._def;
        } else if (currentDef.typeName === "ZodString") {
          typeName = "string";
          break;
        } else if (currentDef.typeName === "ZodNumber") {
          typeName = "number";
          break;
        } else if (currentDef.typeName === "ZodBoolean") {
          typeName = "boolean";
          break;
        } else if (currentDef.typeName === "ZodArray") {
          typeName = "array";
          break;
        } else if (currentDef.typeName === "ZodEnum") {
          typeName = `enum (${currentDef.values?.join(", ") || ""})`;
          break;
        } else {
          typeName = currentDef.typeName?.replace("Zod", "").toLowerCase() || "any";
          break;
        }
      }

      return {
        name: key,
        type: typeName,
        required: isRequired,
        description
      };
    });

    return { schemaType: "Zod Schema", fields };
  }

  // SchemaFieldRule Dictionary
  if (typeof schema === "object") {
    const fields = Object.entries(schema).map(([key, rule]: [string, any]) => {
      return {
        name: key,
        type: rule.type || "string",
        required: !!rule.required,
        description: rule.description || (rule.maxLen ? `Max length: ${rule.maxLen}` : undefined)
      };
    });
    return { schemaType: "Validation Rules", fields };
  }

  return { schemaType: "JSON" };
}

/**
 * Dynamically builds the complete API documentation by combining:
 * 1. Registered endpointSchemas
 * 2. Route metadata catalogue
 * 3. Parameter and role authorization rules
 */
export function generateApiDocs(): ApiDocsResult {
  const endpointMap = new Map<string, ApiDocEndpoint>();

  // 1. Seed from known route catalogue
  for (const [key, meta] of Object.entries(routeMetadata)) {
    const [method, path] = key.split(":");
    const schemaKey = `${method}:${path}`;
    const schema = endpointSchemas[schemaKey] || schemas[schemaKey];
    const schemaDetails = extractSchemaDetails(schema);

    // Extract path parameters from route
    const pathParams: ApiDocParameter[] = (meta.parameters || []).concat(
      (path.match(/:([a-zA-Z0-9_]+)/g) || []).map(p => ({
        name: p.replace(":", ""),
        in: "path" as const,
        required: true,
        type: "string",
        description: `Path parameter ${p}`
      }))
    );

    // Deduplicate path params
    const uniqueParams = pathParams.filter((p, index, self) =>
      index === self.findIndex(t => t.name === p.name && t.in === p.in)
    );

    endpointMap.set(key, {
      method,
      path,
      category: meta.category || "General",
      summary: meta.summary || `${method} ${path}`,
      description: meta.description || `Handles ${method} operations for ${path}`,
      authRequired: meta.authRequired ?? true,
      requiredRoles: meta.requiredRoles || [],
      parameters: uniqueParams,
      requestBody: ["POST", "PUT", "PATCH"].includes(method)
        ? {
            required: true,
            contentType: "application/json",
            ...schemaDetails
          }
        : undefined,
      responses: meta.responses || {
        "200": { description: "Successful response." }
      }
    });
  }

  // 2. Discover any additional endpoint schemas not in metadata
  for (const [key, schema] of Object.entries({ ...endpointSchemas, ...schemas })) {
    if (!endpointMap.has(key)) {
      const [method, path] = key.split(":");
      const schemaDetails = extractSchemaDetails(schema);
      endpointMap.set(key, {
        method,
        path,
        category: path.startsWith("/api/admin") ? "Staff & Admin" : path.startsWith("/api/manager") ? "Management" : "General",
        summary: `${method} ${path}`,
        description: `Endpoint dynamically registered with request schema.`,
        authRequired: !path.startsWith("/api/health") && path !== "/api/public-stats",
        requiredRoles: path.startsWith("/api/admin") ? ["admin", "dietary_admin"] : ["employee", "manager", "admin"],
        parameters: (path.match(/:([a-zA-Z0-9_]+)/g) || []).map(p => ({
          name: p.replace(":", ""),
          in: "path" as const,
          required: true,
          type: "string"
        })),
        requestBody: {
          required: true,
          contentType: "application/json",
          ...schemaDetails
        },
        responses: {
          "200": { description: "Successful execution." }
        }
      });
    }
  }

  const endpoints = Array.from(endpointMap.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.path.localeCompare(b.path);
  });

  const categories = Array.from(new Set(endpoints.map(e => e.category)));

  return {
    title: "DGMC Meal Management & Dining Portal REST API Documentation",
    version: "1.0.0",
    description: "Live dynamic API documentation generated from server route registries, Zod validation schemas, and RBAC authorization guards.",
    baseUrl: "/api",
    generatedAt: new Date().toISOString(),
    totalEndpoints: endpoints.length,
    categories,
    endpoints
  };
}

/**
 * Generates a clean, modern HTML documentation view for browser consumption.
 */
export function generateApiDocsHtml(): string {
  const docs = generateApiDocs();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docs.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --method-get: #10b981;
      --method-post: #3b82f6;
      --method-put: #f59e0b;
      --method-delete: #ef4444;
      --font-sans: 'Plus Jakarta Sans', -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 2rem 1.5rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .badge-info { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-auth { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-public { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    h1 { font-size: 2rem; font-weight: 700; margin: 0.5rem 0; color: #ffffff; }
    p.description { color: var(--text-muted); font-size: 1.05rem; max-width: 800px; }
    .stats-bar {
      display: flex;
      gap: 1.5rem;
      margin-top: 1rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .quick-links {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
    .btn-link {
      display: inline-flex;
      align-items: center;
      padding: 0.4rem 0.85rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: border-color 0.2s;
    }
    .btn-link:hover { border-color: var(--accent); color: var(--accent); }
    .category-section {
      margin-bottom: 2.5rem;
    }
    .category-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .endpoint-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
      transition: transform 0.15s, border-color 0.15s;
    }
    .endpoint-card:hover { border-color: #475569; }
    .endpoint-header {
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      background: rgba(15, 23, 42, 0.4);
    }
    .endpoint-path-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.95rem;
    }
    .method-tag {
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .method-GET { background: var(--method-get); color: #000; }
    .method-POST { background: var(--method-post); color: #fff; }
    .method-PUT { background: var(--method-put); color: #000; }
    .method-DELETE { background: var(--method-delete); color: #fff; }
    .endpoint-path { color: #f1f5f9; font-weight: 600; }
    .endpoint-summary {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-left: auto;
    }
    .endpoint-body {
      padding: 1.25rem;
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
    }
    .endpoint-desc { color: #cbd5e1; margin-bottom: 1rem; }
    .section-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 700;
      margin: 0.75rem 0 0.4rem 0;
    }
    .roles-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }
    .role-badge {
      background: #334155;
      color: #e2e8f0;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .fields-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
      font-size: 0.85rem;
    }
    .fields-table th, .fields-table td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    .fields-table th {
      color: var(--text-muted);
      font-weight: 600;
      background: rgba(0, 0, 0, 0.2);
    }
    .field-name { font-family: var(--font-mono); font-weight: 600; color: #38bdf8; }
    .field-type { font-family: var(--font-mono); color: #a78bfa; font-size: 0.8rem; }
    .field-req { color: #f43f5e; font-size: 0.75rem; font-weight: 600; }
    .field-opt { color: #64748b; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span class="badge badge-info">v${docs.version}</span>
        <span class="badge badge-public">Dynamic Reflection</span>
      </div>
      <h1>${docs.title}</h1>
      <p class="description">${docs.description}</p>
      <div class="stats-bar">
        <span><strong>Base URL:</strong> <code>${docs.baseUrl}</code></span>
        <span><strong>Endpoints:</strong> ${docs.totalEndpoints}</span>
        <span><strong>Generated:</strong> ${new Date(docs.generatedAt).toLocaleString()}</span>
      </div>
      <div class="quick-links">
        <a href="/api/docs?format=json" class="btn-link" target="_blank">📥 View JSON Spec</a>
        <a href="/api/openapi.json" class="btn-link" target="_blank">📋 OpenAPI 3.0 Spec</a>
        <a href="/api/swagger-ui" class="btn-link" target="_blank">⚡ Swagger UI Explorer</a>
      </div>
    </header>

    <main>
      ${docs.categories.map(category => {
        const categoryEndpoints = docs.endpoints.filter(e => e.category === category);
        return `
          <div class="category-section">
            <h2 class="category-title">📂 ${category} (${categoryEndpoints.length})</h2>
            ${categoryEndpoints.map(endpoint => `
              <div class="endpoint-card">
                <div class="endpoint-header">
                  <div class="endpoint-path-group">
                    <span class="method-tag method-${endpoint.method}">${endpoint.method}</span>
                    <span class="endpoint-path">${endpoint.path}</span>
                  </div>
                  <div class="endpoint-summary">${endpoint.summary}</div>
                  <div>
                    ${endpoint.authRequired 
                      ? `<span class="badge badge-auth">Protected</span>` 
                      : `<span class="badge badge-public">Public</span>`}
                  </div>
                </div>
                <div class="endpoint-body">
                  <p class="endpoint-desc">${endpoint.description}</p>
                  
                  ${endpoint.authRequired ? `
                    <div class="section-label">Required Roles</div>
                    <div class="roles-list">
                      ${endpoint.requiredRoles.length > 0 
                        ? endpoint.requiredRoles.map(r => `<span class="role-badge">${r}</span>`).join('') 
                        : `<span class="role-badge">Any authenticated user</span>`}
                    </div>
                  ` : ''}

                  ${endpoint.parameters.length > 0 ? `
                    <div class="section-label">Parameters</div>
                    <table class="fields-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>In</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${endpoint.parameters.map(p => `
                          <tr>
                            <td class="field-name">${p.name}</td>
                            <td><code>${p.in}</code></td>
                            <td class="field-type">${p.type}</td>
                            <td>${p.required ? '<span class="field-req">Required</span>' : '<span class="field-opt">Optional</span>'}</td>
                            <td>${p.description || '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}

                  ${endpoint.requestBody?.fields && endpoint.requestBody.fields.length > 0 ? `
                    <div class="section-label">Request Body (${endpoint.requestBody.schemaType || 'JSON'})</div>
                    <table class="fields-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Requirement</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${endpoint.requestBody.fields.map(f => `
                          <tr>
                            <td class="field-name">${f.name}</td>
                            <td class="field-type">${f.type}</td>
                            <td>${f.required ? '<span class="field-req">Required</span>' : '<span class="field-opt">Optional</span>'}</td>
                            <td>${f.description || '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </main>
  </div>
</body>
</html>`;
}
