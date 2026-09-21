ALTER TABLE `customers` ADD COLUMN `legal_name` VARCHAR(191) NULL;
ALTER TABLE `customers` ADD COLUMN `trade_name` VARCHAR(191) NULL;
ALTER TABLE `customers` ADD COLUMN `cnae_code` VARCHAR(191) NULL;
ALTER TABLE `customers` ADD COLUMN `cnae_description` VARCHAR(191) NULL;
ALTER TABLE `customers` ADD COLUMN `legal_nature` VARCHAR(191) NULL;
ALTER TABLE `customers` ADD COLUMN `registration_status` VARCHAR(191) NULL;
ALTER TABLE `customers` ADD COLUMN `registration_status_date` DATETIME(3) NULL;
