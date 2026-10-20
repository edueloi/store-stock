ALTER TABLE `accounts_payable`
  ADD COLUMN `payment_method` VARCHAR(191) NULL,
  ADD COLUMN `document_number` VARCHAR(191) NULL,
  ADD COLUMN `cost_center` VARCHAR(191) NULL,
  ADD COLUMN `payment_details` TEXT NULL,
  ADD COLUMN `recurrence_value_mode` VARCHAR(191) NULL;

ALTER TABLE `accounts_receivable`
  ADD COLUMN `payment_method` VARCHAR(191) NULL,
  ADD COLUMN `document_number` VARCHAR(191) NULL,
  ADD COLUMN `cost_center` VARCHAR(191) NULL,
  ADD COLUMN `payment_details` TEXT NULL,
  ADD COLUMN `recurrence_value_mode` VARCHAR(191) NULL;
