-- AlterTable
ALTER TABLE `customer_debt_installments` ADD COLUMN `interest_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `interest_applied_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `crediario_grace_days` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `crediario_interest_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0;
