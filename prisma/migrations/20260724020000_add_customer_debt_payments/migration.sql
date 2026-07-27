-- AlterTable customer_debts: add order_id + amount_paid
ALTER TABLE `customer_debts`
  ADD COLUMN `order_id` INTEGER NULL,
  ADD COLUMN `amount_paid` DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX `customer_debts_order_id_idx` ON `customer_debts`(`order_id`);

ALTER TABLE `customer_debts` ADD CONSTRAINT `customer_debts_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable customer_debt_payments
CREATE TABLE `customer_debt_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `debt_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `payment_method` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_debt_payments_debt_id_idx`(`debt_id`),
    INDEX `customer_debt_payments_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey customer_debt_payments -> customer_debts
ALTER TABLE `customer_debt_payments` ADD CONSTRAINT `customer_debt_payments_debt_id_fkey`
  FOREIGN KEY (`debt_id`) REFERENCES `customer_debts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey customer_debt_payments -> tenants
ALTER TABLE `customer_debt_payments` ADD CONSTRAINT `customer_debt_payments_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
