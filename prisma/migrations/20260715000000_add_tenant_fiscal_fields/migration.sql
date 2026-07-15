ALTER TABLE `tenants`
  ADD COLUMN `razao_social` VARCHAR(191) NULL,
  ADD COLUMN `inscricao_estadual` VARCHAR(191) NULL,
  ADD COLUMN `inscricao_municipal` VARCHAR(191) NULL,
  ADD COLUMN `cnae_fiscal` VARCHAR(191) NULL,
  ADD COLUMN `tax_regime` VARCHAR(191) NOT NULL DEFAULT 'simples_nacional',
  ADD COLUMN `crt` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `nfce_environment` VARCHAR(191) NOT NULL DEFAULT 'homologacao',
  ADD COLUMN `nfce_series` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `nfce_next_number` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `nfce_csc_id` VARCHAR(191) NULL,
  ADD COLUMN `nfce_csc_token` VARCHAR(191) NULL,
  ADD COLUMN `nfce_cert_path` VARCHAR(191) NULL,
  ADD COLUMN `nfce_cert_password` VARCHAR(191) NULL;
