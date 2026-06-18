-- AlterTable: add source and order_id to finance for filtering by PDV vs services vs manual
ALTER TABLE `finance`
  ADD COLUMN `source`   VARCHAR(191) NULL,
  ADD COLUMN `order_id` INT NULL;
