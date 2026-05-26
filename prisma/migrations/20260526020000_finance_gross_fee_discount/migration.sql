-- Add gross_amount, fee_amount, discount_amount to finance table
ALTER TABLE `finance`
  ADD COLUMN `gross_amount`    DECIMAL(10,2) NULL AFTER `amount`,
  ADD COLUMN `fee_amount`      DECIMAL(10,2) NULL AFTER `gross_amount`,
  ADD COLUMN `discount_amount` DECIMAL(10,2) NULL AFTER `fee_amount`;
