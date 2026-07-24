-- CreateTable consignments
CREATE TABLE `consignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,

    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `customer_phone` VARCHAR(191) NULL,

    `seller_id` INTEGER NULL,
    `seller_name` VARCHAR(191) NULL,

    `due_days` INTEGER NOT NULL DEFAULT 7,
    `due_date` DATE NOT NULL,

    `status` VARCHAR(20) NOT NULL DEFAULT 'aberta',
    `notes` TEXT NULL,

    `invoiced_order_id` INTEGER NULL,
    `invoiced_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,

    `cancelled_by` VARCHAR(191) NULL,
    `cancel_reason` VARCHAR(191) NULL,
    `cancelled_at` DATETIME(3) NULL,

    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `consignments_tenant_id_number_key`(`tenant_id`, `number`),
    INDEX `consignments_tenant_id_idx`(`tenant_id`),
    INDEX `consignments_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable consignment_items
CREATE TABLE `consignment_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consignment_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `selected_options` JSON NULL,
    `resolution` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `resolved_at` DATETIME(3) NULL,

    INDEX `consignment_items_consignment_id_idx`(`consignment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable consignment_actions
CREATE TABLE `consignment_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `consignment_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `from_status` VARCHAR(191) NULL,
    `to_status` VARCHAR(191) NULL,
    `actor` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consignment_actions_consignment_id_idx`(`consignment_id`),
    INDEX `consignment_actions_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey consignments -> tenants
ALTER TABLE `consignments` ADD CONSTRAINT `consignments_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey consignments -> sellers
ALTER TABLE `consignments` ADD CONSTRAINT `consignments_seller_id_fkey`
  FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey consignment_items -> consignments
ALTER TABLE `consignment_items` ADD CONSTRAINT `consignment_items_consignment_id_fkey`
  FOREIGN KEY (`consignment_id`) REFERENCES `consignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey consignment_items -> products
ALTER TABLE `consignment_items` ADD CONSTRAINT `consignment_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey consignment_actions -> consignments
ALTER TABLE `consignment_actions` ADD CONSTRAINT `consignment_actions_consignment_id_fkey`
  FOREIGN KEY (`consignment_id`) REFERENCES `consignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey consignment_actions -> tenants
ALTER TABLE `consignment_actions` ADD CONSTRAINT `consignment_actions_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
