-- CreateTable: order_actions — audit log for order lifecycle events
CREATE TABLE `order_actions` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `tenant_id`  INT NOT NULL,
  `order_id`   INT NOT NULL,
  `action`     VARCHAR(191) NOT NULL,
  `actor`      VARCHAR(191) NULL,
  `note`       TEXT NULL,
  `meta`       JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `order_actions_order_id_idx` (`order_id`),
  INDEX `order_actions_tenant_id_idx` (`tenant_id`),

  CONSTRAINT `order_actions_order_id_fkey`  FOREIGN KEY (`order_id`)  REFERENCES `orders`  (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_actions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
