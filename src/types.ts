export type UserRole = "admin" | "dietary_admin" | "manager" | "cashier" | "employee";
export type ShiftType = "day" | "night";
export type EmployeeStatus = "active" | "inactive";
export type TransactionStatus = "completed" | "cancelled";

export interface Department {
  id: number;
  name: string;
  created_at: string;
}

export interface Person {
  id: number;
  username: string;
  password?: string; // Hidden on response
  role: UserRole;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
  
  // Employee-specific attributes
  employee_no?: string;
  position?: string;
  department_id?: number | null;
  department_name?: string;
  qr_code?: string;
  employee_status?: EmployeeStatus;
  hire_date?: string;
  
  // Manager-specific attributes
  managed_department_id?: number | null;

  // Security protected attributes
  is_protected?: boolean;
  protected?: boolean;
}

export interface Transaction {
  id: number;
  person_id: number;
  cashier_person_id: number;
  meal_date: string; // YYYY-MM-DD
  meal_time: string; // HH:MM:SS
  is_free: boolean;
  meal_amount: number;
  status: TransactionStatus;
  created_at: string;
  meal_type?: string;
  
  // Expanded visual properties
  employee_name?: string;
  employee_no?: string;
  department_name?: string;
  cashier_name?: string;
}

export interface EmployeeSchedule {
  id: number;
  person_id: number;
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
  created_by?: number;
  created_at: string;
}

export interface FreeMealLog {
  id: number;
  person_id: number;
  meal_date: string; // YYYY-MM-DD
  created_at: string;
  claimed_at?: string;
}

export interface AuthState {
  token: string | null;
  user: Person | null;
}

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  updated_at: string;
  updated_by?: number | null;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  username?: string; // For visual convenience
  action: string;
  entity_type?: string;
  entity_id?: string | number | null;
  old_value?: string | null;
  new_value?: string | null;
  ip_address?: string;
  created_at: string;
}

export interface LoginAttempt {
  id: number;
  username: string;
  ip_address?: string;
  timestamp: string;
  success: boolean;
}
