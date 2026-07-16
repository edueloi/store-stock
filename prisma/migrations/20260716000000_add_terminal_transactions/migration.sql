-- CreateTable: terminal_transactions — histórico de cobranças na maquininha física
CREATE TABLE `terminal_transactions` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `tenant_id`          INT NOT NULL,
  `order_id`           INT NULL,
  `provider`           VARCHAR(191) NOT NULL,
  `environment`        VARCHAR(191) NOT NULL,
  `status`             VARCHAR(20) NOT NULL DEFAULT 'pending',
  `external_id`        VARCHAR(191) NULL,
  `nsu`                VARCHAR(191) NULL,
  `authorization_code` VARCHAR(191) NULL,
  `brand`              VARCHAR(191) NULL,
  `mode`               VARCHAR(191) NULL,
  `installments`       INT NOT NULL DEFAULT 1,
  `amount`             DECIMAL(10, 2) NOT NULL,
  `fee_amount`         DECIMAL(10, 2) NULL,
  `device_id`          VARCHAR(191) NULL,
  `raw_response`       JSON NULL,
  `error_message`      TEXT NULL,
  `created_at`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`         DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `terminal_transactions_tenant_id_idx` (`tenant_id`),
  INDEX `terminal_transactions_order_id_idx` (`order_id`),
  INDEX `terminal_transactions_status_idx` (`status`),

  CONSTRAINT `terminal_transactions_order_id_fkey`  FOREIGN KEY (`order_id`)  REFERENCES `orders`  (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `terminal_transactions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
