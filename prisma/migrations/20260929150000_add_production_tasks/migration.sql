CREATE TABLE `production_tasks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `number` INTEGER NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `expected_result` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'rascunho',
  `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
  `customer_id` INTEGER NULL,
  `customer_name` VARCHAR(191) NULL,
  `customer_phone` VARCHAR(191) NULL,
  `customer_email` VARCHAR(191) NULL,
  `assignee_id` INTEGER NULL,
  `assignee_name` VARCHAR(191) NULL,
  `created_by_id` INTEGER NULL,
  `created_by_name` VARCHAR(191) NULL,
  `due_at` DATE NULL,
  `planned_items` JSON NULL,
  `service_order_id` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `production_tasks_tenant_id_number_key`(`tenant_id`, `number`),
  UNIQUE INDEX `production_tasks_service_order_id_key`(`service_order_id`),
  INDEX `production_tasks_tenant_id_status_idx`(`tenant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `production_tasks` ADD CONSTRAINT `production_tasks_tenant_id_fkey`
FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
