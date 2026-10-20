ALTER TABLE `store_payment_gateways`
  ADD COLUMN `wallet_id` VARCHAR(191) NULL,
  ADD COLUMN `fee_percent` DECIMAL(5, 2) NOT NULL DEFAULT 2,
  ADD COLUMN `rules` JSON NULL;

CREATE TABLE `store_charges` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `order_id` INTEGER NULL,
  `asaas_payment_id` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `customer_name` VARCHAR(191) NULL,
  `value` DECIMAL(10, 2) NOT NULL,
  `fee_percent` DECIMAL(5, 2) NOT NULL,
  `fee_amount` DECIMAL(10, 2) NOT NULL,
  `billing_type` VARCHAR(191) NOT NULL DEFAULT 'UNDEFINED',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `due_date` DATE NOT NULL,
  `invoice_url` VARCHAR(191) NULL,
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `store_charges_asaas_payment_id_key`(`asaas_payment_id`),
  INDEX `store_charges_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `store_charges_order_id_idx`(`order_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `store_charges` ADD CONSTRAINT `store_charges_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
