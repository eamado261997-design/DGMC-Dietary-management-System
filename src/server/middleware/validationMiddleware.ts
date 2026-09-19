import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  findEndpointSchema,
  validateRequestBody,
  ValidationResult
} from "../api.js";
import {
  LoginSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
  DepartmentSchema,
  UpdateDepartmentSchema,
  EmployeeSchema,
  ScheduleSchema,
  ToggleScheduleSchema,
  BatchScheduleSchema,
  BatchScheduleItemSchema,
  ScanSchema,
  CashierProcessSchema,
  DecryptFieldSchema,
  SettingsUpdateSchema,
  LogoUploadSchema
} from "../schemas.js";
import { SchemaFieldRule } from "../utils/securityUtils.js";

/**
 * Route-to-Zod schema registry mapping endpoint patterns to their corresponding Zod validation schema.
 */
export const zodRouteSchemaMap: Record<string, z.ZodType<any>> = {
  "POST:/api/auth/login": LoginSchema,
  "POST:/api/auth/change-password": ChangePasswordSchema,
  "POST:/api/admin/people": CreateUserSchema,
  "PUT:/api/admin/people/:id": UpdateUserSchema,
  "POST:/api/admin/people/:id/reset-password": ResetPasswordSchema,
  "POST:/api/admin/decrypt-field": DecryptFieldSchema,
  "POST:/api/departments": DepartmentSchema,
  "PUT:/api/departments/:id": UpdateDepartmentSchema,
  "POST:/api/employees": EmployeeSchema,
  "POST:/api/manager/schedules": ScheduleSchema,
  "POST:/api/manager/toggle-schedule": ToggleScheduleSchema,
  "POST:/api/manager/batch-schedules": BatchScheduleSchema,
  "POST:/api/cashier/scan": ScanSchema,
  "POST:/api/cashier/process": CashierProcessSchema,
  "PUT:/api/settings": SettingsUpdateSchema,
  "POST:/api/settings/logo": LogoUploadSchema
};

/**
 * Resolves the appropriate Zod schema for an incoming HTTP method and request path.
 * Supports exact route matching as well as parameterized routes (e.g., :id).
 */
export function getZodSchemaForRoute(method: string, path: string): z.ZodType<any> | null {
  const normalizedMethod = (method || "GET").toUpperCase();
  const normalizedPath = (path || "/").split("?")[0].replace(/\/+/g, "/");
  const directKey = `${normalizedMethod}:${normalizedPath}`;

  if (zodRouteSchemaMap[directKey]) {
    return zodRouteSchemaMap[directKey];
  }

  // Check parameterized route patterns
  for (const [routePatternKey, schema] of Object.entries(zodRouteSchemaMap)) {
    const [m, pattern] = routePatternKey.split(":");
    if (m !== normalizedMethod) continue;
    if (pattern.includes(":")) {
      const regex = new RegExp("^" + pattern.replace(/:[a-zA-Z0-9_]+/g, "[^/]+") + "$");
      if (regex.test(normalizedPath)) {
        return schema;
      }
    }
  }

  // Fallback to core api.ts endpointSchemas if available as a Zod schema
  const generalSchema = findEndpointSchema(normalizedMethod, normalizedPath);
  if (generalSchema && typeof (generalSchema as any).safeParse === "function") {
    return generalSchema as z.ZodType<any>;
  }

  return null;
}

/**
 * Validates any given request payload against a Zod schema or route-mapped schema.
 * Returns structured validation result with error messages, field path, and sanitized data.
 */
export function validateRequestBodyWithZod<T = any>(
  body: any,
  schemaOrRoute: z.ZodType<T> | { method: string; path: string }
): ValidationResult<T> {
  let schema: z.ZodType<any> | null = null;

  if (typeof (schemaOrRoute as any).safeParse === "function") {
    schema = schemaOrRoute as z.ZodType<T>;
  } else if ("method" in schemaOrRoute && "path" in schemaOrRoute) {
    schema = getZodSchemaForRoute(schemaOrRoute.method, schemaOrRoute.path);
  }

  if (!schema) {
    // If no schema is registered for this route, allow the payload
    return { ok: true, data: body };
  }

  return validateRequestBody<T>(body, schema);
}

/**
 * Express Middleware: Automatically validates incoming request bodies against Zod schemas
 * based on the incoming request HTTP method and URL path.
 * 
 * If validation fails, immediately sends a 400 Bad Request response with detailed issue diagnostics.
 * If validation succeeds, req.body is replaced with the sanitized and parsed data.
 */
export function validateBodyMiddleware(customSchema?: z.ZodType<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    
    // Only state-modifying requests with payload require body validation
    if (!["POST", "PUT", "PATCH"].includes(method)) {
      return next();
    }

    const schema = customSchema || getZodSchemaForRoute(method, req.path);
    if (!schema) {
      return next();
    }

    const validation = validateRequestBody(req.body, schema);
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        statusCode: 400,
        code: "VALIDATION_ERROR",
        error: validation.error || "Bad Request: Request payload validation failed",
        field: validation.field,
        details: validation.details
      });
      return;
    }

    // Attach parsed and sanitized payload back to request
    req.body = validation.data;
    next();
  };
}

/**
 * Higher-order utility function to validate a payload explicitly inside a controller or route handler.
 */
export function validatePayload<T>(
  schema: z.ZodType<T> | Record<string, SchemaFieldRule>,
  data: any
): { success: true; data: T } | { success: false; statusCode: 400; error: string; field?: string; details?: any } {
  const result = validateRequestBody<T>(data, schema);
  if (!result.ok) {
    return {
      success: false,
      statusCode: 400,
      error: result.error || "Validation error",
      field: result.field,
      details: result.details
    };
  }
  return {
    success: true,
    data: result.data as T
  };
}
