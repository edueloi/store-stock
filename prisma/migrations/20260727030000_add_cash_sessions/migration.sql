-- AlterTable
ALTER TABLE `orders` ADD COLUMN `cash_session_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `require_cash_session` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `cash_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `opened_by_id` INTEGER NOT NULL,
    `opened_by_name` VARCHAR(191) NOT NULL,
    `closed_by_id` INTEGER NULL,
    `closed_by_name` VARCHAR(191) NULL,
    `opening_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `opening_note` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `counted_amount` DECIMAL(10, 2) NULL,
    `expected_amount` DECIMAL(10, 2) NULL,
    `difference_amount` DECIMAL(10, 2) NULL,
    `payment_breakdown` JSON NULL,
    `closing_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cash_sessions_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `cash_sessions_opened_by_id_idx`(`opened_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_cash_session_id_idx` ON `orders`(`cash_session_id`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_cash_session_id_fkey` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_opened_by_id_fkey` FOREIGN KEY (`opened_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
