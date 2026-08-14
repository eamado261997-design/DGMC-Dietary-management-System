-- ============================================================
-- DGMC Dietary Management System - Stored Procedures
-- File: src/server/database/procedures.sql
-- ============================================================

DELIMITER //

-- ------------------------------------------------------------
-- PROCEDURE 1: GetEmployeeMealEligibility
-- Checks employee status, shift schedules, and daily meal limits
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS GetEmployeeMealEligibility//

CREATE PROCEDURE GetEmployeeMealEligibility(
    IN p_employee_id INT,
    IN p_check_date DATE,
    OUT p_eligibility_code VARCHAR(50),
    OUT p_message VARCHAR(255)
)
BEGIN
    DECLARE v_emp_status VARCHAR(20);
    DECLARE v_is_deleted BOOLEAN;
    DECLARE v_has_schedule INT;
    DECLARE v_free_meals_claimed INT;
    DECLARE v_max_free_meals INT DEFAULT 1;

    -- 1. Check if employee exists, is active, and not soft-deleted
    SELECT employee_status, (deleted_at IS NOT NULL)
    INTO v_emp_status, v_is_deleted
    FROM Employees
    WHERE id = p_employee_id;

    IF v_emp_status IS NULL OR v_is_deleted THEN
        SET p_eligibility_code = 'EMPLOYEE_NOT_FOUND';
        SET p_message = 'Employee record does not exist or has been deleted.';
    ELSEIF v_emp_status != 'active' THEN
        SET p_eligibility_code = 'EMPLOYEE_INACTIVE';
        SET p_message = CONCAT('Employee status is currently ', v_emp_status, '.');
    ELSE
        -- 2. Fetch daily free meal limit from SystemSettings
        SELECT CAST(setting_value AS UNSIGNED) INTO v_max_free_meals
        FROM SystemSettings
        WHERE setting_key = 'max_free_meals_per_day';
        
        IF v_max_free_meals IS NULL THEN
            SET v_max_free_meals = 1;
        END IF;

        -- 3. Check if employee is scheduled on duty today
        SELECT COUNT(*) INTO v_has_schedule
        FROM MealSchedules
        WHERE employee_id = p_employee_id AND work_date = p_check_date;

        -- 4. Check how many free meals were already claimed today
        SELECT COUNT(*) INTO v_free_meals_claimed
        FROM Transactions
        WHERE employee_id = p_employee_id
          AND DATE(meal_datetime) = p_check_date
          AND meal_type = 'free'
          AND status = 'completed';

        -- 5. Determine eligibility
        IF v_has_schedule = 0 THEN
            SET p_eligibility_code = 'NOT_SCHEDULED';
            SET p_message = 'Employee is not scheduled for work today. Eligible for paid/discount meals only.';
        ELSEIF v_free_meals_claimed >= v_max_free_meals THEN
            SET p_eligibility_code = 'ALREADY_CLAIMED';
            SET p_message = CONCAT('Daily free meal allowance limit reached (', v_free_meals_claimed, '/', v_max_free_meals, '). Eligible for discount/paid meals.');
        ELSE
            SET p_eligibility_code = 'FREE_ELIGIBLE';
            SET p_message = 'Employee is scheduled and eligible for a free meal voucher today.';
        END IF;
    END IF;
END//

-- ------------------------------------------------------------
-- PROCEDURE 2: ProcessMealSwipe
-- Validates meal eligibility, daily limits, records transaction,
-- and writes audit trail in an atomic transaction block.
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS ProcessMealSwipe//

CREATE PROCEDURE ProcessMealSwipe(
    IN p_employee_id INT,
    IN p_cashier_user_id INT,
    IN p_requested_meal_type ENUM('free', 'paid', 'discount'),
    IN p_meal_amount DECIMAL(10,2),
    OUT p_success BOOLEAN,
    OUT p_transaction_id INT,
    OUT p_message VARCHAR(255)
)
proc_main: BEGIN
    DECLARE v_eligibility VARCHAR(50);
    DECLARE v_eligibility_msg VARCHAR(255);
    DECLARE v_today DATE;
    DECLARE v_price_cap DECIMAL(10,2) DEFAULT 15.00;
    
    SET v_today = CURDATE();
    SET p_success = FALSE;
    SET p_transaction_id = NULL;

    -- Start Transaction
    START TRANSACTION;

    -- 1. Check meal price cap for free meals
    IF p_requested_meal_type = 'free' THEN
        SELECT CAST(setting_value AS DECIMAL(10,2)) INTO v_price_cap
        FROM SystemSettings WHERE setting_key = 'free_meal_price_cap';
        
        IF p_meal_amount > v_price_cap THEN
            SET p_message = CONCAT('Free meal amount ($', p_meal_amount, ') exceeds maximum allowed cap ($', v_price_cap, ').');
            ROLLBACK;
            LEAVE proc_main;
        END IF;

        -- Check employee eligibility
        CALL GetEmployeeMealEligibility(p_employee_id, v_today, v_eligibility, v_eligibility_msg);

        IF v_eligibility != 'FREE_ELIGIBLE' THEN
            SET p_message = v_eligibility_msg;
            ROLLBACK;
            LEAVE proc_main;
        END IF;
    END IF;

    -- 2. Insert Transaction
    INSERT INTO Transactions (
        employee_id,
        cashier_user_id,
        meal_datetime,
        meal_type,
        meal_amount,
        status
    ) VALUES (
        p_employee_id,
        p_cashier_user_id,
        NOW(),
        p_requested_meal_type,
        p_meal_amount,
        'completed'
    );

    SET p_transaction_id = LAST_INSERT_ID();

    -- 3. Log into AuditLogs
    INSERT INTO AuditLogs (
        user_id,
        action,
        entity_type,
        entity_id,
        new_value
    ) VALUES (
        p_cashier_user_id,
        'PROCESS_MEAL_SWIPE',
        'Transactions',
        CAST(p_transaction_id AS CHAR),
        JSON_OBJECT(
            'employee_id', p_employee_id,
            'meal_type', p_requested_meal_type,
            'amount', p_meal_amount
        )
    );

    COMMIT;
    SET p_success = TRUE;
    SET p_message = 'Meal swipe processed successfully.';
END//

DELIMITER ;
