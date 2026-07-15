-- CreateTable: nfce_invoices — lifecycle of each NFC-e issued for an order
CREATE TABLE `nfce_invoices` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `tenant_id`        INT NOT NULL,
  `order_id`         INT NOT NULL,
  `status`           VARCHAR(20) NOT NULL DEFAULT 'pending',
  `environment`      VARCHAR(191) NOT NULL,
  `series`           INT NOT NULL,
  `number`           INT NOT NULL,
  `access_key`       VARCHAR(191) NULL,
  `protocol`         VARCHAR(191) NULL,
  `authorized_at`    DATETIME(3) NULL,
  `rejection_code`   VARCHAR(191) NULL,
  `rejection_reason` TEXT NULL,
  `xml_path`         VARCHAR(191) NULL,
  `danfe_path`       VARCHAR(191) NULL,
  `qrcode_url`       TEXT NULL,
  `attempts`         INT NOT NULL DEFAULT 0,
  `last_attempt_at`  DATETIME(3) NULL,
  `created_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `nfce_invoices_order_id_key` (`order_id`),
  UNIQUE INDEX `nfce_invoices_access_key_key` (`access_key`),
  INDEX `nfce_invoices_tenant_id_idx` (`tenant_id`),
  INDEX `nfce_invoices_status_idx` (`status`),

  CONSTRAINT `nfce_invoices_order_id_fkey`  FOREIGN KEY (`order_id`)  REFERENCES `orders`  (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `nfce_invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
