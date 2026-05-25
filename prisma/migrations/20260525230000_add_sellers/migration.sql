-- CreateTable sellers
CREATE TABLE `sellers` (
    `id`              INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id`       INTEGER NOT NULL,
    `name`            VARCHAR(191) NOT NULL,
    `email`           VARCHAR(191) NULL,
    `phone`           VARCHAR(191) NULL,
    `document`        VARCHAR(191) NULL,
    `commission_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `is_active`       BOOLEAN NOT NULL DEFAULT true,
    `notes`           TEXT NULL,
    `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`      DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `sellers_tenant_id_idx`(`tenant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey sellers -> tenants
ALTER TABLE `sellers` ADD CONSTRAINT `sellers_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddColumn seller_id to orders
ALTER TABLE `orders` ADD COLUMN `seller_id` INTEGER NULL;

-- AddForeignKey orders -> sellers
ALTER TABLE `orders` ADD CONSTRAINT `orders_seller_id_fkey`
  FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
