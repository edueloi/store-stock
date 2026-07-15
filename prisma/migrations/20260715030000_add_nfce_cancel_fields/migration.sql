ALTER TABLE `nfce_invoices`
  ADD COLUMN `cancel_protocol` VARCHAR(191) NULL,
  ADD COLUMN `cancel_reason` TEXT NULL,
  ADD COLUMN `cancelled_at` DATETIME(3) NULL,
  ADD COLUMN `cancel_xml_path` VARCHAR(191) NULL;
