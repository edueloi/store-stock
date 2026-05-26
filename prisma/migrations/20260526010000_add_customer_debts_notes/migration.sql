-- Add risk_flag and credit_limit to customers
ALTER TABLE `customers`
  ADD COLUMN `credit_limit`  DECIMAL(10,2) NULL        AFTER `notes`,
  ADD COLUMN `risk_flag`     TINYINT(1)    NOT NULL DEFAULT 0 AFTER `credit_limit`,
  ADD COLUMN `risk_reason`   TEXT          NULL        AFTER `risk_flag`;

-- CreateTable customer_debts (fiado / crédito avulso)
CREATE TABLE `customer_debts` (
    `id`           INTEGER       NOT NULL AUTO_INCREMENT,
    `tenant_id`    INTEGER       NOT NULL,
    `customer_id`  INTEGER       NOT NULL,
    `description`  VARCHAR(255)  NOT NULL,
    `amount`       DECIMAL(10,2) NOT NULL,
    `due_date`     DATE          NULL,
    `paid_at`      DATETIME(3)   NULL,
    `status`       VARCHAR(20)   NOT NULL DEFAULT 'open',
    `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`   DATETIME(3)   NOT NULL,

    INDEX `customer_debts_tenant_idx`(`tenant_id`),
    INDEX `customer_debts_customer_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable customer_notes (histórico interno)
CREATE TABLE `customer_notes` (
    `id`           INTEGER       NOT NULL AUTO_INCREMENT,
    `tenant_id`    INTEGER       NOT NULL,
    `customer_id`  INTEGER       NOT NULL,
    `body`         TEXT          NOT NULL,
    `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_notes_customer_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey customer_debts -> customers
ALTER TABLE `customer_debts`
  ADD CONSTRAINT `customer_debts_customer_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_debts`
  ADD CONSTRAINT `customer_debts_tenant_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey customer_notes -> customers
ALTER TABLE `customer_notes`
  ADD CONSTRAINT `customer_notes_customer_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_notes`
  ADD CONSTRAINT `customer_notes_tenant_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
