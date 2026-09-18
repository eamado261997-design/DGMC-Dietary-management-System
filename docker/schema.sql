-- ==============================================================================
-- DGMC Hospital Dietary Management System
-- Database Initialization & Performance Schema
-- File: docker/schema.sql
-- Mapped to: /docker-entrypoint-initdb.d/init.sql
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `dgmc_meals` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 1. USER AUTHENTICATION & ACCESS CONFIGURATION
-- ------------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'dgmc_user'@'%' IDENTIFIED WITH mysql_native_password BY 'dgmc_password';
ALTER USER 'dgmc_user'@'%' IDENTIFIED WITH mysql_native_password BY 'dgmc_password';
GRANT ALL PRIVILEGES ON dgmc_meals.* TO 'dgmc_user'@'%';
GRANT ALL PRIVILEGES ON dgmc_meals.* TO 'dgmc_user'@'localhost';

ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'rootpassword';
FLUSH PRIVILEGES;

USE `dgmc_meals`;

-- ------------------------------------------------------------------------------
-- 2. TRANSACTIONS TABLE & INLINE PERFORMANCE INDICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `person_id` INT NOT NULL,
  `cashier_person_id` INT NOT NULL,
  `meal_date` VARCHAR(10) NOT NULL,
  `meal_time` VARCHAR(10) NOT NULL,
  `is_free` TINYINT(1) NOT NULL DEFAULT 0,
  `meal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
  `meal_type` VARCHAR(20) NOT NULL DEFAULT 'paid',
  `created_at` VARCHAR(50) NOT NULL DEFAULT '',
  INDEX `idx_transactions_created_at` (`created_at`),
  INDEX `idx_transactions_person_id` (`person_id`),
  INDEX `idx_transactions_date` (`meal_date`),
  INDEX `idx_transactions_date_status` (`meal_date`, `status`),
  INDEX `idx_transactions_person_created` (`person_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. RECENT ACTIVITIES TABLE & INLINE PERFORMANCE INDICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `recentActivities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `person_id` INT NULL,
  `user_id` INT NULL,
  `action` VARCHAR(255) NOT NULL,
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(100),
  `old_value` TEXT,
  `new_value` TEXT,
  `ip_address` VARCHAR(45),
  `created_at` VARCHAR(50) NOT NULL DEFAULT '',
  INDEX `idx_recent_activities_created_at` (`created_at`),
  INDEX `idx_recent_activities_person_id` (`person_id`),
  INDEX `idx_recent_activities_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. AUDIT LOGS TABLE & INLINE PERFORMANCE INDICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(255) NOT NULL,
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(100),
  `old_value` TEXT,
  `new_value` TEXT,
  `ip_address` VARCHAR(45),
  `created_at` VARCHAR(50) NOT NULL DEFAULT '',
  INDEX `idx_audit_logs_created_at` (`created_at`),
  INDEX `idx_audit_logs_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. IDEMPOTENT INDEX CREATION FOR PRE-EXISTING VOLUMES
-- ------------------------------------------------------------------------------
DELIMITER //

DROP PROCEDURE IF EXISTS `AddIndexIfNotExists`//

CREATE PROCEDURE `AddIndexIfNotExists`(
    IN targetTable VARCHAR(64),
    IN targetIndex VARCHAR(64),
    IN indexColumns VARCHAR(255)
)
BEGIN
    DECLARE indexCount INT;
    
    SELECT COUNT(1) INTO indexCount
    FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name = targetTable
      AND index_name = targetIndex;
      
    IF indexCount = 0 THEN
        SET @sqlQuery = CONCAT('ALTER TABLE `', targetTable, '` ADD INDEX `', targetIndex, '` (', indexColumns, ')');
        PREPARE stmt FROM @sqlQuery;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DELIMITER ;

-- Explicit performance indexes for transactions
CALL AddIndexIfNotExists('transactions', 'idx_transactions_created_at', '`created_at`');
CALL AddIndexIfNotExists('transactions', 'idx_transactions_person_id', '`person_id`');
CALL AddIndexIfNotExists('transactions', 'idx_transactions_date', '`meal_date`');
CALL AddIndexIfNotExists('transactions', 'idx_transactions_date_status', '`meal_date`, `status`');
CALL AddIndexIfNotExists('transactions', 'idx_transactions_person_created', '`person_id`, `created_at`');

-- Explicit performance indexes for recentActivities
CALL AddIndexIfNotExists('recentActivities', 'idx_recent_activities_created_at', '`created_at`');
CALL AddIndexIfNotExists('recentActivities', 'idx_recent_activities_person_id', '`person_id`');
CALL AddIndexIfNotExists('recentActivities', 'idx_recent_activities_user_id', '`user_id`');

-- Explicit performance indexes for audit_logs
CALL AddIndexIfNotExists('audit_logs', 'idx_audit_logs_created_at', '`created_at`');
CALL AddIndexIfNotExists('audit_logs', 'idx_audit_logs_user_id', '`user_id`');

DROP PROCEDURE IF EXISTS `AddIndexIfNotExists`;

FLUSH PRIVILEGES;
