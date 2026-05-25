ALTER TABLE `tenants`
  ADD COLUMN `subdomain` VARCHAR(191) NULL,
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  ADD COLUMN `trial_days` INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN `trial_starts_at` DATETIME(3) NULL,
  ADD COLUMN `trial_ends_at` DATETIME(3) NULL,
  ADD COLUMN `subscription_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `setup_completed_at` DATETIME(3) NULL;

UPDATE `tenants`
SET `subdomain` = `slug`
WHERE `subdomain` IS NULL OR `subdomain` = '';

ALTER TABLE `tenants`
  MODIFY `subdomain` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `tenants_subdomain_key` ON `tenants`(`subdomain`);

CREATE TABLE `setup_invites` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NULL,
  `token` VARCHAR(191) NOT NULL,
  `store_name` VARCHAR(191) NOT NULL,
  `subdomain` VARCHAR(191) NOT NULL,
  `whatsapp` VARCHAR(191) NOT NULL,
  `owner_name` VARCHAR(191) NULL,
  `owner_email` VARCHAR(191) NULL,
  `trial_days` INTEGER NOT NULL DEFAULT 30,
  `subscription_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `invite_expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `setup_invites_token_key`(`token`),
  INDEX `setup_invites_subdomain_idx`(`subdomain`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `setup_invites`
  ADD CONSTRAINT `setup_invites_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
