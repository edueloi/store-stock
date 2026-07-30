-- AlterTable tenants: add NFS-e Nacional fields
ALTER TABLE `tenants`
  ADD COLUMN `nfse_environment` VARCHAR(191) NOT NULL DEFAULT 'homologacao',
  ADD COLUMN `nfse_codigo_municipio` VARCHAR(191) NULL,
  ADD COLUMN `nfse_inscricao_municipal` VARCHAR(191) NULL,
  ADD COLUMN `nfse_serie` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `nfse_next_number` INTEGER NOT NULL DEFAULT 1;

-- CreateTable nfse_invoices
CREATE TABLE `nfse_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `service_order_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `environment` VARCHAR(20) NOT NULL,
    `serie` INTEGER NOT NULL,
    `numero` INTEGER NOT NULL,
    `chave_acesso` VARCHAR(60) NULL,
    `codigo_verificacao` VARCHAR(20) NULL,
    `authorized_at` DATETIME(3) NULL,
    `rejection_code` VARCHAR(20) NULL,
    `rejection_reason` TEXT NULL,
    `dps_xml_path` VARCHAR(255) NULL,
    `nfse_xml_path` VARCHAR(255) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_attempt_at` DATETIME(3) NULL,
    `cancel_reason` TEXT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `nfse_invoices_service_order_id_key`(`service_order_id`),
    UNIQUE INDEX `nfse_invoices_chave_acesso_key`(`chave_acesso`),
    INDEX `nfse_invoices_tenant_id_idx`(`tenant_id`),
    INDEX `nfse_invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey nfse_invoices -> tenants
ALTER TABLE `nfse_invoices` ADD CONSTRAINT `nfse_invoices_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey nfse_invoices -> service_orders
ALTER TABLE `nfse_invoices` ADD CONSTRAINT `nfse_invoices_service_order_id_fkey`
  FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
