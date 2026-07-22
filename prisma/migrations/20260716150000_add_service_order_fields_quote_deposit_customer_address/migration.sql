-- ServiceOrder: novos campos (aditivos, nuláveis)
ALTER TABLE `service_orders`
  ADD COLUMN `reported_issue` TEXT NULL,
  ADD COLUMN `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
  ADD COLUMN `promised_at` DATE NULL,
  ADD COLUMN `warranty_days` INTEGER NULL,
  ADD COLUMN `warranty_terms` TEXT NULL;

-- Quote: campos de entrada/sinal (aditivos, nuláveis)
ALTER TABLE `quotes`
  ADD COLUMN `deposit_amount` DECIMAL(10, 2) NULL,
  ADD COLUMN `deposit_payment_method` VARCHAR(191) NULL,
  ADD COLUMN `deposit_paid_at` DATETIME(3) NULL;

-- Customer: endereço estruturado (aditivo, nulável)
ALTER TABLE `customers`
  ADD COLUMN `address_street` VARCHAR(191) NULL,
  ADD COLUMN `address_number` VARCHAR(191) NULL,
  ADD COLUMN `address_complement` VARCHAR(191) NULL,
  ADD COLUMN `address_district` VARCHAR(191) NULL,
  ADD COLUMN `address_city` VARCHAR(191) NULL,
  ADD COLUMN `address_state` CHAR(2) NULL,
  ADD COLUMN `address_zip` VARCHAR(191) NULL,
  ADD COLUMN `address_country` VARCHAR(191) NULL DEFAULT 'Brasil';

-- Novo model QuoteAction (espelho de ServiceOrderAction)
CREATE TABLE `quote_actions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `quote_id` INTEGER NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `from_status` VARCHAR(191) NULL,
  `to_status` VARCHAR(191) NULL,
  `actor` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `meta` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `quote_actions_quote_id_idx`(`quote_id`),
  INDEX `quote_actions_tenant_id_idx`(`tenant_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quote_actions` ADD CONSTRAINT `quote_actions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `quote_actions` ADD CONSTRAINT `quote_actions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
