-- AlterTable: add order_type to distinguish product orders from service-only orders
ALTER TABLE `orders` ADD COLUMN `order_type` VARCHAR(191) NOT NULL DEFAULT 'products';
