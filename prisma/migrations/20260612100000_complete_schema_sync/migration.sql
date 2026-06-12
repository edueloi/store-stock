-- ============================================================
-- Complete schema sync: adds all columns/tables missing from
-- previous migrations. Uses PROCEDURE wrappers to safely skip
-- columns that already exist (MySQL does not support
-- ADD COLUMN IF NOT EXISTS before MariaDB 10.x).
-- ============================================================

-- Helper: add a column only if it doesn't already exist
DROP PROCEDURE IF EXISTS add_column_if_missing;
CREATE PROCEDURE add_column_if_missing(
  IN tbl   VARCHAR(64),
  IN col   VARCHAR(64),
  IN def   TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl
      AND COLUMN_NAME  = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END;

-- Helper: add a unique index only if it doesn't already exist
DROP PROCEDURE IF EXISTS add_unique_index_if_missing;
CREATE PROCEDURE add_unique_index_if_missing(
  IN tbl   VARCHAR(64),
  IN idx   VARCHAR(64),
  IN col   VARCHAR(64)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl
      AND INDEX_NAME   = idx
  ) THEN
    SET @sql = CONCAT('CREATE UNIQUE INDEX `', idx, '` ON `', tbl, '`(`', col, '`)');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END;

-- ── orders: client_sale_id ──────────────────────────────────────────────────
CALL add_column_if_missing('orders', 'client_sale_id', 'VARCHAR(191) NULL');
CALL add_unique_index_if_missing('orders', 'orders_client_sale_id_key', 'client_sale_id');

-- ── orders: customer_id ────────────────────────────────────────────────────
CALL add_column_if_missing('orders', 'customer_id', 'INTEGER NULL');

-- ── products: extra JSON columns ───────────────────────────────────────────
CALL add_column_if_missing('products', 'images',     'JSON NULL');
CALL add_column_if_missing('products', 'attributes', 'JSON NULL');
CALL add_column_if_missing('products', 'skus',       'JSON NULL');

-- ── customers: birth_date ──────────────────────────────────────────────────
CALL add_column_if_missing('customers', 'birth_date', 'DATETIME(3) NULL');

-- ── tenants: extra columns ─────────────────────────────────────────────────
CALL add_column_if_missing('tenants', 'payment_methods',      'JSON NULL');
CALL add_column_if_missing('tenants', 'policies',             'JSON NULL');
CALL add_column_if_missing('tenants', 'pass_fee_to_customer', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('tenants', 'max_installments',     'INTEGER NOT NULL DEFAULT 12');
CALL add_column_if_missing('tenants', 'enabled_brands',       'JSON NULL');
CALL add_column_if_missing('tenants', 'pass_fee_by_method',   'JSON NULL');
CALL add_column_if_missing('tenants', 'business_hours',       'JSON NULL');
CALL add_column_if_missing('tenants', 'featured_limit',       'INTEGER NOT NULL DEFAULT 4');
CALL add_column_if_missing('tenants', 'bestseller_limit',     'INTEGER NOT NULL DEFAULT 8');

-- ── Cleanup procedures ─────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_unique_index_if_missing;

-- ── order_services ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_services` (
  `id`         INT            NOT NULL AUTO_INCREMENT,
  `order_id`   INT            NOT NULL,
  `service_id` INT            NOT NULL,
  `name`       VARCHAR(191)   NOT NULL,
  `unit_price` DECIMAL(10,2)  NOT NULL,
  `quantity`   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  CONSTRAINT `order_services_order_id_fkey`
    FOREIGN KEY (`order_id`)   REFERENCES `orders`(`id`)   ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `order_services_service_id_fkey`
    FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── quote_services ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `quote_services` (
  `id`         INT            NOT NULL AUTO_INCREMENT,
  `quote_id`   INT            NOT NULL,
  `service_id` INT            NOT NULL,
  `name`       VARCHAR(191)   NOT NULL,
  `unit_price` DECIMAL(10,2)  NOT NULL,
  `quantity`   INT            NOT NULL DEFAULT 1,
  `total`      DECIMAL(10,2)  NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `quote_services_quote_id_fkey`
    FOREIGN KEY (`quote_id`)   REFERENCES `quotes`(`id`)   ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `quote_services_service_id_fkey`
    FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── user_preferences ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id`         INT            NOT NULL AUTO_INCREMENT,
  `user_id`    INT            NOT NULL,
  `pref_key`   VARCHAR(191)   NOT NULL,
  `value`      JSON           NOT NULL,
  `created_at` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_preferences_user_id_pref_key_key`(`user_id`, `pref_key`),
  CONSTRAINT `user_preferences_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── password_reset_tokens ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id`         INT            NOT NULL AUTO_INCREMENT,
  `user_id`    INT            NOT NULL,
  `token`      VARCHAR(191)   NOT NULL,
  `expires_at` DATETIME(3)    NOT NULL,
  `used_at`    DATETIME(3)    NULL,
  `created_at` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
  CONSTRAINT `password_reset_tokens_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── loyalty_programs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `loyalty_programs` (
  `id`                 INT            NOT NULL AUTO_INCREMENT,
  `tenant_id`          INT            NOT NULL,
  `is_active`          TINYINT(1)     NOT NULL DEFAULT 1,
  `name`               VARCHAR(191)   NOT NULL DEFAULT 'Programa de Fidelidade',
  `spend_per_point`    DECIMAL(10,2)  NOT NULL DEFAULT 10.00,
  `points_expiry_days` INT            NOT NULL DEFAULT 0,
  `season_start`       DATETIME(3)    NULL,
  `season_end`         DATETIME(3)    NULL,
  `created_at`         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `loyalty_programs_tenant_id_key`(`tenant_id`),
  CONSTRAINT `loyalty_programs_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── loyalty_rewards ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `loyalty_rewards` (
  `id`             INT            NOT NULL AUTO_INCREMENT,
  `program_id`     INT            NOT NULL,
  `tenant_id`      INT            NOT NULL,
  `name`           VARCHAR(191)   NOT NULL,
  `type`           VARCHAR(191)   NOT NULL,
  `discount_value` DECIMAL(10,2)  NULL,
  `discount_type`  VARCHAR(191)   NULL,
  `product_id`     INT            NULL,
  `product_qty`    INT            NULL DEFAULT 1,
  `points_cost`    INT            NOT NULL,
  `is_active`      TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `loyalty_rewards_tenant_id_idx`(`tenant_id`),
  CONSTRAINT `loyalty_rewards_program_id_fkey`
    FOREIGN KEY (`program_id`) REFERENCES `loyalty_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── customer_points ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `customer_points` (
  `id`            INT            NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT            NOT NULL,
  `customer_id`   INT            NOT NULL,
  `order_id`      INT            NULL,
  `delta`         INT            NOT NULL,
  `balance_after` INT            NOT NULL,
  `description`   VARCHAR(191)   NULL,
  `expires_at`    DATETIME(3)    NULL,
  `created_at`    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `customer_points_customer_id_idx`(`customer_id`),
  INDEX `customer_points_tenant_id_idx`(`tenant_id`),
  CONSTRAINT `customer_points_customer_id_fkey`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── point_redemptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `point_redemptions` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `tenant_id`   INT            NOT NULL,
  `customer_id` INT            NOT NULL,
  `reward_id`   INT            NOT NULL,
  `order_id`    INT            NULL,
  `points_used` INT            NOT NULL,
  `created_at`  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `point_redemptions_customer_id_idx`(`customer_id`),
  INDEX `point_redemptions_tenant_id_idx`(`tenant_id`),
  CONSTRAINT `point_redemptions_customer_id_fkey`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `point_redemptions_reward_id_fkey`
    FOREIGN KEY (`reward_id`) REFERENCES `loyalty_rewards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
