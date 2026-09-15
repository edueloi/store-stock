-- Devolução/troca de produto: novas tabelas + colunas aditivas.

ALTER TABLE `order_items` ADD COLUMN `returned_quantity` INT NOT NULL DEFAULT 0;

ALTER TABLE `tenants` ADD COLUMN `return_deadline_days` INT NULL DEFAULT 30;

CREATE TABLE `customer_credits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `balance` DECIMAL(10, 2) NOT NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'order_return',
  `order_return_id` INT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `customer_credits_order_return_id_key`(`order_return_id`),
  INDEX `customer_credits_tenant_id_customer_id_idx`(`tenant_id`, `customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_returns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `order_id` INT NOT NULL,
  `reason` TEXT NULL,
  `credit_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `created_by` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `order_returns_order_id_idx`(`order_id`),
  INDEX `order_returns_tenant_id_idx`(`tenant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_return_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_return_id` INT NOT NULL,
  `order_item_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `restock` BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (`id`),
  INDEX `order_return_items_order_return_id_idx`(`order_return_id`),
  INDEX `order_return_items_order_item_id_idx`(`order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_credit_usages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_credit_id` INT NOT NULL,
  `order_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `customer_credit_usages_customer_credit_id_idx`(`customer_credit_id`),
  INDEX `customer_credit_usages_order_id_idx`(`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_returns` ADD CONSTRAINT `order_returns_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `order_returns` ADD CONSTRAINT `order_returns_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_return_items` ADD CONSTRAINT `order_return_items_order_return_id_fkey`
  FOREIGN KEY (`order_return_id`) REFERENCES `order_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `order_return_items` ADD CONSTRAINT `order_return_items_order_item_id_fkey`
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_credit_usages` ADD CONSTRAINT `customer_credit_usages_customer_credit_id_fkey`
  FOREIGN KEY (`customer_credit_id`) REFERENCES `customer_credits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_credit_usages` ADD CONSTRAINT `customer_credit_usages_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- customer_credits.order_return_id referencia order_returns, mas order_returns
-- ainda nao existia quando customer_credits foi criado acima (dependencia
-- circular) — adicionado por ultimo, depois das duas tabelas existirem.
ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_order_return_id_fkey`
  FOREIGN KEY (`order_return_id`) REFERENCES `order_returns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
