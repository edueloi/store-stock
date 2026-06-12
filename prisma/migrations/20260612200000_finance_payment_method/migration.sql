-- Add payment_method to finance table
ALTER TABLE `finance` ADD COLUMN `payment_method` VARCHAR(191) NULL;
