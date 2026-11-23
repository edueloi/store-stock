-- NF-e (modelo 55): serie/numeracao por CNPJ e tabela das notas.
ALTER TABLE `tenants` ADD COLUMN `nfe_series` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `tenants` ADD COLUMN `nfe_next_number` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `nfe_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `order_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `environment` VARCHAR(191) NOT NULL,
    `series` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,
    `access_key` VARCHAR(191) NULL,
    `protocol` VARCHAR(191) NULL,
    `authorized_at` DATETIME(3) NULL,
    `rejection_code` VARCHAR(191) NULL,
    `rejection_reason` TEXT NULL,
    `xml_path` VARCHAR(191) NULL,
    `danfe_path` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_attempt_at` DATETIME(3) NULL,
    `nature` VARCHAR(191) NULL,
    `recipient` JSON NULL,
    `freight` JSON NULL,
    `additional_info` TEXT NULL,
    `ind_pres` VARCHAR(2) NULL,
    `final_consumer` BOOLEAN NOT NULL DEFAULT false,
    `cancel_protocol` VARCHAR(191) NULL,
    `cancel_reason` TEXT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_xml_path` VARCHAR(191) NULL,
    `issuer_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `nfe_invoices_order_id_key`(`order_id`),
    UNIQUE INDEX `nfe_invoices_access_key_key`(`access_key`),
    INDEX `nfe_invoices_tenant_id_idx`(`tenant_id`),
    INDEX `nfe_invoices_status_idx`(`status`),
    INDEX `nfe_invoices_issuer_id_idx`(`issuer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `nfe_invoices` ADD CONSTRAINT `nfe_invoices_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `nfe_invoices` ADD CONSTRAINT `nfe_invoices_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
