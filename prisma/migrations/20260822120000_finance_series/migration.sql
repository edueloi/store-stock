-- AlterTable
ALTER TABLE `accounts_payable` ADD COLUMN `installment_number` INTEGER NULL,
    ADD COLUMN `interest_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `interest_applied_at` DATETIME(3) NULL,
    ADD COLUMN `series_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `accounts_receivable` ADD COLUMN `installment_number` INTEGER NULL,
    ADD COLUMN `interest_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `interest_applied_at` DATETIME(3) NULL,
    ADD COLUMN `series_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `finance_series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `party_name` VARCHAR(191) NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `installments_count` INTEGER NOT NULL,
    `interval_unit` VARCHAR(191) NOT NULL,
    `interval_count` INTEGER NOT NULL DEFAULT 1,
    `value_mode` VARCHAR(191) NOT NULL DEFAULT 'fixed',
    `interest_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `interest_period` VARCHAR(191) NOT NULL DEFAULT 'month',
    `interest_grace_days` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `finance_series_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `accounts_payable_series_id_idx` ON `accounts_payable`(`series_id`);

-- CreateIndex
CREATE UNIQUE INDEX `accounts_payable_series_id_installment_number_key` ON `accounts_payable`(`series_id`, `installment_number`);

-- CreateIndex
CREATE INDEX `accounts_receivable_series_id_idx` ON `accounts_receivable`(`series_id`);

-- CreateIndex
CREATE UNIQUE INDEX `accounts_receivable_series_id_installment_number_key` ON `accounts_receivable`(`series_id`, `installment_number`);

-- AddForeignKey
ALTER TABLE `accounts_receivable` ADD CONSTRAINT `accounts_receivable_series_id_fkey` FOREIGN KEY (`series_id`) REFERENCES `finance_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts_payable` ADD CONSTRAINT `accounts_payable_series_id_fkey` FOREIGN KEY (`series_id`) REFERENCES `finance_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finance_series` ADD CONSTRAINT `finance_series_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
