-- Contas de checkout próprias por loja. Credenciais são cifradas pela aplicação
-- antes de serem persistidas; esta tabela nunca armazena uma chave global da Boxsys.
CREATE TABLE `store_payment_gateways` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `environment` VARCHAR(16) NOT NULL DEFAULT 'sandbox',
  `credentials` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `store_payment_gateways_tenant_id_provider_key`(`tenant_id`, `provider`),
  INDEX `store_payment_gateways_tenant_id_enabled_idx`(`tenant_id`, `enabled`),
  PRIMARY KEY (`id`),
  CONSTRAINT `store_payment_gateways_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
