-- DGMC Hospital System - Database Migration Script
-- Purpose: Add missing indexes on 'created_at' and 'person_id' for 'transactions' and 'recentActivities' tables
-- Improves dashboard data aggregation, telemetry, and reporting speeds.

-- 1. Ensure recentActivities table exists (mirrors audit_logs or standalone activities)
CREATE TABLE IF NOT EXISTS recentActivities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NULL,
  user_id INT NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  created_at VARCHAR(50) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Indexes for 'transactions' table
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_person_id ON transactions(person_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(meal_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date_status ON transactions(meal_date, status);
CREATE INDEX IF NOT EXISTS idx_transactions_person_created ON transactions(person_id, created_at);

-- 3. Indexes for 'recentActivities' table
CREATE INDEX IF NOT EXISTS idx_recent_activities_created_at ON recentActivities(created_at);
CREATE INDEX IF NOT EXISTS idx_recent_activities_person_id ON recentActivities(person_id);
CREATE INDEX IF NOT EXISTS idx_recent_activities_user_id ON recentActivities(user_id);

-- 4. Indexes for 'audit_logs' table (underlying store for recentActivities in dashboard)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
