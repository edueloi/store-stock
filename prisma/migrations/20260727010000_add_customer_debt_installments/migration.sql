-- AlterTable customer_debts: add installments_count
ALTER TABLE `customer_debts`
  ADD COLUMN `installments_count` INTEGER NOT NULL DEFAULT 1;

-- CreateTable customer_debt_installments
CREATE TABLE `customer_debt_installments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `debt_id` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `amount_paid` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_debt_installments_debt_id_number_key`(`debt_id`, `number`),
    INDEX `customer_debt_installments_debt_id_idx`(`debt_id`),
    INDEX `customer_debt_installments_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable customer_debt_payments: add installment_id
ALTER TABLE `customer_debt_payments`
  ADD COLUMN `installment_id` INTEGER NULL;

CREATE INDEX `customer_debt_payments_installment_id_idx` ON `customer_debt_payments`(`installment_id`);

-- AddForeignKey customer_debt_installments -> customer_debts
ALTER TABLE `customer_debt_installments` ADD CONSTRAINT `customer_debt_installments_debt_id_fkey`
  FOREIGN KEY (`debt_id`) REFERENCES `customer_debts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey customer_debt_installments -> tenants
ALTER TABLE `customer_debt_installments` ADD CONSTRAINT `customer_debt_installments_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey customer_debt_payments -> customer_debt_installments
ALTER TABLE `customer_debt_payments` ADD CONSTRAINT `customer_debt_payments_installment_id_fkey`
  FOREIGN KEY (`installment_id`) REFERENCES `customer_debt_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
