CREATE TABLE `product_history` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `tenant_id`  INT          NOT NULL,
  `product_id` INT          NOT NULL,
  `field`      VARCHAR(191) NOT NULL,
  `old_value`  TEXT         NULL,
  `new_value`  TEXT         NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `product_history_product_id_idx` (`product_id`),
  INDEX `product_history_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `product_history_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
