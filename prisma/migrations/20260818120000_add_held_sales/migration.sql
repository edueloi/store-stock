-- CreateTable
CREATE TABLE `held_sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,
    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(191) NULL,
    `customer_phone` VARCHAR(191) NULL,
    `seller_id` INTEGER NULL,
    `seller_name` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'held',
    `notes` TEXT NULL,
    `snapshot` JSON NULL,
    `resumed_by` VARCHAR(191) NULL,
    `resumed_at` DATETIME(3) NULL,
    `invoiced_order_id` INTEGER NULL,
    `invoiced_at` DATETIME(3) NULL,
    `cancelled_by` VARCHAR(191) NULL,
    `cancel_reason` VARCHAR(191) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `held_sales_tenant_id_idx`(`tenant_id`),
    INDEX `held_sales_tenant_id_status_idx`(`tenant_id`, `status`),
    UNIQUE INDEX `held_sales_tenant_id_number_key`(`tenant_id`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `held_sale_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `held_sale_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `selected_options` JSON NULL,
    `dimensions_label` VARCHAR(191) NULL,
    `resolution` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `resolved_at` DATETIME(3) NULL,

    INDEX `held_sale_items_held_sale_id_idx`(`held_sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `held_sale_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `held_sale_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `from_status` VARCHAR(191) NULL,
    `to_status` VARCHAR(191) NULL,
    `actor` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `held_sale_actions_held_sale_id_idx`(`held_sale_id`),
    INDEX `held_sale_actions_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `held_sales` ADD CONSTRAINT `held_sales_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `held_sales` ADD CONSTRAINT `held_sales_seller_id_fkey` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `held_sale_items` ADD CONSTRAINT `held_sale_items_held_sale_id_fkey` FOREIGN KEY (`held_sale_id`) REFERENCES `held_sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `held_sale_items` ADD CONSTRAINT `held_sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `held_sale_actions` ADD CONSTRAINT `held_sale_actions_held_sale_id_fkey` FOREIGN KEY (`held_sale_id`) REFERENCES `held_sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `held_sale_actions` ADD CONSTRAINT `held_sale_actions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
