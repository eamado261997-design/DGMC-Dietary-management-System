-- DGMC MySQL Initialization Script
-- This ensures the dgmc_user has full permissions from any host (bridge network)

CREATE DATABASE IF NOT EXISTS dgmc_meals;

-- Create user if it doesn't exist and grant permissions
-- Note: MySQL 8.0 syntax - enforcing mysql_native_password for better compatibility
CREATE USER IF NOT EXISTS 'dgmc_user'@'%' IDENTIFIED WITH mysql_native_password BY 'dgmc_password';
ALTER USER 'dgmc_user'@'%' IDENTIFIED WITH mysql_native_password BY 'dgmc_password';
GRANT ALL PRIVILEGES ON dgmc_meals.* TO 'dgmc_user'@'%';
GRANT ALL PRIVILEGES ON dgmc_meals.* TO 'dgmc_user'@'localhost';

-- Also ensure root can connect if needed for debugging
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'rootpassword';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'rootpassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'rootpassword';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'rootpassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;

FLUSH PRIVILEGES;

USE dgmc_meals;

-- Performance Indexes and Tables for System Aggregations
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  cashier_person_id INT NOT NULL,
  meal_date VARCHAR(10) NOT NULL,
  meal_time VARCHAR(10) NOT NULL,
  is_free TINYINT(1) NOT NULL DEFAULT 0,
  meal_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  meal_type VARCHAR(20) NOT NULL DEFAULT 'paid',
  created_at VARCHAR(50) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  created_at VARCHAR(50) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Missing indexes on created_at and person_id for dashboard aggregation speeds
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_person_id ON transactions(person_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(meal_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date_status ON transactions(meal_date, status);

CREATE INDEX IF NOT EXISTS idx_recent_activities_created_at ON recentActivities(created_at);
CREATE INDEX IF NOT EXISTS idx_recent_activities_person_id ON recentActivities(person_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

