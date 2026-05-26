-- Add cancel/financial fields to orders table
ALTER TABLE `orders`
  ADD COLUMN `seller_name`     VARCHAR(191) NULL AFTER `seller_id`,
  ADD COLUMN `gross_amount`    DECIMAL(10,2) NULL AFTER `total_amount`,
  ADD COLUMN `discount_amount` DECIMAL(10,2) NULL AFTER `gross_amount`,
  ADD COLUMN `fee_amount`      DECIMAL(10,2) NULL AFTER `discount_amount`,
  ADD COLUMN `cancelled_by`   VARCHAR(191) NULL AFTER `payment_method`,
  ADD COLUMN `cancel_reason`  VARCHAR(500) NULL AFTER `cancelled_by`,
  ADD COLUMN `cancelled_at`   DATETIME NULL AFTER `cancel_reason`;
