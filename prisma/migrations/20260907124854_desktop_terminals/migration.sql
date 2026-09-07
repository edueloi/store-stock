CREATE TABLE `desktop_terminals` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `terminal_uid` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `desktop_terminals_terminal_uid_key`(`terminal_uid`),
  INDEX `desktop_terminals_tenant_id_idx`(`tenant_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `desktop_printers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `terminal_id` INTEGER NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL,
  `config` JSON NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `desktop_printers_terminal_id_idx`(`terminal_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `desktop_pairing_codes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(6) NOT NULL,
  `terminal_uid` VARCHAR(191) NOT NULL,
  `tenant_id` INTEGER NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `paired_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `desktop_pairing_codes_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `desktop_terminals` ADD CONSTRAINT `desktop_terminals_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `desktop_printers` ADD CONSTRAINT `desktop_printers_terminal_id_fkey` FOREIGN KEY (`terminal_id`) REFERENCES `desktop_terminals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
