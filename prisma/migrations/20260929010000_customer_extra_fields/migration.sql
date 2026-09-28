-- AlterTable
ALTER TABLE `customers` ADD COLUMN `birthplace` VARCHAR(191) NULL,
    ADD COLUMN `contact_name` VARCHAR(191) NULL,
    ADD COLUMN `contact_type` VARCHAR(191) NULL,
    ADD COLUMN `customer_since` DATE NULL,
    ADD COLUMN `external_code` VARCHAR(191) NULL,
    ADD COLUMN `father_document` VARCHAR(191) NULL,
    ADD COLUMN `father_name` VARCHAR(191) NULL,
    ADD COLUMN `fax` VARCHAR(191) NULL,
    ADD COLUMN `gender` VARCHAR(191) NULL,
    ADD COLUMN `marital_status` VARCHAR(191) NULL,
    ADD COLUMN `mother_document` VARCHAR(191) NULL,
    ADD COLUMN `mother_name` VARCHAR(191) NULL,
    ADD COLUMN `next_visit_at` DATE NULL,
    ADD COLUMN `nfe_email` VARCHAR(191) NULL,
    ADD COLUMN `person_type` VARCHAR(191) NULL DEFAULT 'physical',
    ADD COLUMN `profession` VARCHAR(191) NULL,
    ADD COLUMN `segment` VARCHAR(191) NULL,
    ADD COLUMN `seller_id` INTEGER NULL,
    ADD COLUMN `state_registration` VARCHAR(191) NULL,
    ADD COLUMN `state_registration_exempt` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    ADD COLUMN `tax_regime` VARCHAR(191) NULL,
    ADD COLUMN `website` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_seller_id_fkey` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
