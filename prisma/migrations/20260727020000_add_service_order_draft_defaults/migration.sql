-- AlterTable service_orders: allow creating a draft with empty customer_name/equipment_category
ALTER TABLE `service_orders`
  MODIFY COLUMN `customer_name` VARCHAR(191) NOT NULL DEFAULT '',
  MODIFY COLUMN `equipment_category` VARCHAR(191) NOT NULL DEFAULT '';
