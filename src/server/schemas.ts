import { z } from "zod";

// User & Authentication Schemas
export const CreateUserSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name must not exceed 50 characters"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name must not exceed 50 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must not exceed 50 characters").regex(/^[a-zA-Z0-9_.-]+$/, "Username must be alphanumeric, period, dash, or underscore"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "dietary_admin", "manager", "cashier", "employee"]),
  email: z.string().email("Invalid email address format").max(150).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  employee_no: z.string().max(50).optional().or(z.literal("")),
  position: z.string().max(100).optional().or(z.literal("")),
  department_id: z.number().optional().nullable(),
  department_ids: z.array(z.number()).optional(),
  managed_department_id: z.number().optional().nullable(),
  hire_date: z.string().max(30).optional().or(z.literal("")),
  employee_status: z.enum(["active", "suspended", "on_leave"]).optional()
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal(""))
});

export const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});

// Department Schemas
export const DepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100, "Department name must not exceed 100 characters"),
  code: z.string().max(20).optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true)
});

export const UpdateDepartmentSchema = DepartmentSchema.partial();

// Employee Schemas
export const EmployeeSchema = z.object({
  employee_no: z.string().min(1, "Employee number is required").max(50),
  first_name: z.string().min(1, "First name is required").max(50),
  last_name: z.string().min(1, "Last name is required").max(50),
  department_id: z.number(),
  is_active: z.boolean().optional().default(true)
});

// Schedule Schemas
export const ScheduleSchema = z.object({
  employee_id: z.number(),
  day_of_week: z.number().min(0).max(6),
  shift_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid shift_start format (HH:MM)"),
  shift_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid shift_end format (HH:MM)"),
  meal_window_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid meal_window_start format (HH:MM)"),
  meal_window_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid meal_window_end format (HH:MM)"),
  is_free_meal: z.boolean().optional()
});

export const ToggleScheduleSchema = z.object({
  person_id: z.number(),
  work_date: z.string().min(1, "work_date is required"),
  shift_type: z.enum(["day", "night"]).optional()
});

export const BatchScheduleItemSchema = z.object({
  person_id: z.number(),
  work_date: z.string().min(1, "work_date is required"),
  shift_type: z.enum(["day", "night"]).optional(),
  action: z.enum(["add", "update", "remove"])
});

export const BatchScheduleSchema = z.object({
  updates: z.array(BatchScheduleItemSchema).min(1, "Updates array must contain at least one item")
});

// Scan & Cashier Schemas
export const ScanSchema = z.object({
  qr_code: z.string()
    .min(1, "Scan data cannot be empty")
    .max(512, "Scan data too long")
    .regex(/^[a-zA-Z0-9_:.-]+$/, "Scan data contains invalid characters")
});

export const CashierProcessSchema = z.object({
  person_id: z.number(),
  is_free: z.boolean().optional(),
  meal_amount: z.number().nonnegative("meal_amount must be non-negative").optional()
});

export const DecryptFieldSchema = z.object({
  ciphertext: z.string().min(1, "ciphertext is required")
});

export const SettingsUpdateSchema = z.object({
  settings: z.array(z.record(z.string(), z.any())).min(1, "settings array must not be empty")
});

export const LogoUploadSchema = z.object({
  logo_base64: z.string().min(1, "logo_base64 is required")
});


