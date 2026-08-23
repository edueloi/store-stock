-- AlterTable
ALTER TABLE `accounts_payable` ADD COLUMN `is_recurring` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `recurrence_interval_count` INTEGER NULL,
    ADD COLUMN `recurrence_interval_unit` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `accounts_receivable` ADD COLUMN `is_recurring` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `recurrence_interval_count` INTEGER NULL,
    ADD COLUMN `recurrence_interval_unit` VARCHAR(191) NULL;
