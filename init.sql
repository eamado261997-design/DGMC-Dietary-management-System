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
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'rootpassword';

FLUSH PRIVILEGES;
