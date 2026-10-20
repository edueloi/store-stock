ALTER TABLE `orders`
  ADD COLUMN `customer_email` VARCHAR(191) NULL,
  ADD COLUMN `storefront_details` JSON NULL,
  MODIFY COLUMN `customer_address` TEXT NULL;

ALTER TABLE `order_items`
  ADD COLUMN `selected_options` JSON NULL,
  MODIFY COLUMN `dimensions_label` TEXT NULL;

CREATE TABLE `store_order_emails` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `order_id` INTEGER NOT NULL,
  `audience` VARCHAR(191) NOT NULL,
  `recipient` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_error` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `store_order_emails_order_id_audience_recipient_key` (`order_id`, `audience`, `recipient`),
  INDEX `store_order_emails_status_next_attempt_at_idx` (`status`, `next_attempt_at`),
  INDEX `store_order_emails_tenant_id_order_id_idx` (`tenant_id`, `order_id`),
  CONSTRAINT `store_order_emails_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
