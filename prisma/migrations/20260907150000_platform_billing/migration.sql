CREATE TABLE `platform_subscriptions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `asaas_customer_id` VARCHAR(191) NOT NULL,
  `asaas_subscription_id` VARCHAR(191) NOT NULL,
  `billing_cycle` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY',
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `value` DECIMAL(10, 2) NOT NULL,
  `next_due_date` DATETIME(3) NULL,
  `grace_period_days` INTEGER NOT NULL DEFAULT 5,
  `environment` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
  `suspended_at` DATETIME(3) NULL,
  `cancelled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `platform_subscriptions_tenant_id_key`(`tenant_id`),
  UNIQUE INDEX `platform_subscriptions_asaas_subscription_id_key`(`asaas_subscription_id`),
  INDEX `platform_subscriptions_status_idx`(`status`),
  INDEX `platform_subscriptions_next_due_date_idx`(`next_due_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `platform_invoices` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `platform_subscription_id` INTEGER NOT NULL,
  `asaas_payment_id` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `value` DECIMAL(10, 2) NOT NULL,
  `due_date` DATETIME(3) NOT NULL,
  `payment_date` DATETIME(3) NULL,
  `billing_type` VARCHAR(191) NULL,
  `invoice_url` TEXT NULL,
  `raw_webhook_payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `platform_invoices_asaas_payment_id_key`(`asaas_payment_id`),
  INDEX `platform_invoices_platform_subscription_id_idx`(`platform_subscription_id`),
  INDEX `platform_invoices_status_idx`(`status`),
  INDEX `platform_invoices_due_date_idx`(`due_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `platform_subscriptions` ADD CONSTRAINT `platform_subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `platform_invoices` ADD CONSTRAINT `platform_invoices_platform_subscription_id_fkey` FOREIGN KEY (`platform_subscription_id`) REFERENCES `platform_subscriptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
