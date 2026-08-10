import { z } from "zod";

// User Schemas
export const CreateUserSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50),
  last_name: z.string().min(1, "Last name is required").max(50),
  username: z.string().min(3, "Username must be at least 3 characters").max(20).regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric or underscore"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "dietary_admin", "manager", "cashier", "employee"]),
  is_active: z.boolean().optional().default(true),
  department_ids: z.array(z.number()).optional()
});

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Department Schemas
export const DepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10),
  is_active: z.boolean().optional()
});

// Employee Schemas
export const EmployeeSchema = z.object({
  employee_no: z.string().min(1).max(20),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  department_id: z.number(),
  is_active: z.boolean().optional()
});

// Schedule Schemas
export const ScheduleSchema = z.object({
  employee_id: z.number(),
  day_of_week: z.number().min(0).max(6),
  shift_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  shift_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  meal_window_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  meal_window_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  is_free_meal: z.boolean().optional()
});

// Scan Schemas
export const ScanSchema = z.object({
  qr_code: z.string()
    .min(1, "Scan data cannot be empty")
    .max(512, "Scan data too long")
    .regex(/^[a-zA-Z0-9_:.-]+$/, "Scan data contains invalid characters")
});
