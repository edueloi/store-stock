CREATE TABLE `subscription_plans` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `billing_cycle` VARCHAR(191) NOT NULL DEFAULT 'monthly',
  `trial_days` INTEGER NOT NULL DEFAULT 14,
  `features` JSON NOT NULL,
  `limits` JSON NULL,
  `color` VARCHAR(191) NOT NULL DEFAULT '#2563eb',
  `is_featured` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tenants` ADD COLUMN `plan_id` INTEGER NULL;
ALTER TABLE `setup_invites` ADD COLUMN `plan_id` INTEGER NULL;

CREATE INDEX `tenants_plan_id_idx` ON `tenants`(`plan_id`);
CREATE INDEX `setup_invites_plan_id_idx` ON `setup_invites`(`plan_id`);

ALTER TABLE `tenants` ADD CONSTRAINT `tenants_plan_id_fkey`
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `setup_invites` ADD CONSTRAINT `setup_invites_plan_id_fkey`
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
