-- Vários CNPJs emissores por loja (uma mensalidade): o ativo vive nas colunas fiscais do tenant; os demais ficam guardados aqui.
CREATE TABLE `tenant_issuers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `document` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT false,
  `snapshot` JSON NOT NULL,
  `address` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `tenant_issuers_tenant_id_idx`(`tenant_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tenant_issuers` ADD CONSTRAINT `tenant_issuers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- cada nota guarda o CNPJ que a emitiu
ALTER TABLE `nfce_invoices` ADD COLUMN `issuer_id` INTEGER NULL;
ALTER TABLE `nfse_invoices` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `nfce_invoices_issuer_id_idx` ON `nfce_invoices`(`issuer_id`);
CREATE INDEX `nfse_invoices_issuer_id_idx` ON `nfse_invoices`(`issuer_id`);
