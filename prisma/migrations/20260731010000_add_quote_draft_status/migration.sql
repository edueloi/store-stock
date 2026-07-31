-- AlterTable quotes: allow draft creation (empty customer/items) and change default status to "rascunho"
ALTER TABLE `quotes`
  MODIFY COLUMN `customer_name` VARCHAR(191) NOT NULL DEFAULT '',
  MODIFY COLUMN `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  MODIFY COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'rascunho';
