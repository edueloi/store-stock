-- CreateTable service_orders
CREATE TABLE `service_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,

    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `customer_phone` VARCHAR(191) NULL,

    `equipment_category` VARCHAR(191) NOT NULL,
    `equipment_type` VARCHAR(191) NULL,
    `equipment_brand` VARCHAR(191) NULL,
    `equipment_model` VARCHAR(191) NULL,
    `equipment_serial` VARCHAR(191) NULL,
    `equipment_accessories` TEXT NULL,

    `seller_id` INTEGER NULL,
    `technician_name` VARCHAR(191) NULL,

    `status` VARCHAR(20) NOT NULL DEFAULT 'aberta',

    `service_value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `parts_total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,

    `observations` TEXT NULL,

    `invoiced_order_id` INTEGER NULL,
    `invoiced_at` DATETIME(3) NULL,

    `cancelled_by` VARCHAR(191) NULL,
    `cancel_reason` VARCHAR(191) NULL,
    `cancelled_at` DATETIME(3) NULL,

    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_orders_tenant_id_number_key`(`tenant_id`, `number`),
    INDEX `service_orders_tenant_id_idx`(`tenant_id`),
    INDEX `service_orders_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable service_order_checklist_items
CREATE TABLE `service_order_checklist_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `service_order_id` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `answer` VARCHAR(191) NULL,
    `observation` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_order_checklist_items_service_order_id_idx`(`service_order_id`),
    INDEX `service_order_checklist_items_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable service_order_parts
CREATE TABLE `service_order_parts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_order_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_order_parts_service_order_id_idx`(`service_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable service_order_photos
CREATE TABLE `service_order_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `service_order_id` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'intake',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_order_photos_service_order_id_idx`(`service_order_id`),
    INDEX `service_order_photos_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable service_order_actions
CREATE TABLE `service_order_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `service_order_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `from_status` VARCHAR(191) NULL,
    `to_status` VARCHAR(191) NULL,
    `actor` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_order_actions_service_order_id_idx`(`service_order_id`),
    INDEX `service_order_actions_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey service_orders -> tenants
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey service_orders -> sellers
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_seller_id_fkey`
  FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey service_order_checklist_items -> service_orders
ALTER TABLE `service_order_checklist_items` ADD CONSTRAINT `service_order_checklist_items_service_order_id_fkey`
  FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey service_order_parts -> service_orders
ALTER TABLE `service_order_parts` ADD CONSTRAINT `service_order_parts_service_order_id_fkey`
  FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey service_order_parts -> products
ALTER TABLE `service_order_parts` ADD CONSTRAINT `service_order_parts_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey service_order_photos -> service_orders
ALTER TABLE `service_order_photos` ADD CONSTRAINT `service_order_photos_service_order_id_fkey`
  FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey service_order_actions -> service_orders
ALTER TABLE `service_order_actions` ADD CONSTRAINT `service_order_actions_service_order_id_fkey`
  FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey service_order_actions -> tenants
ALTER TABLE `service_order_actions` ADD CONSTRAINT `service_order_actions_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
