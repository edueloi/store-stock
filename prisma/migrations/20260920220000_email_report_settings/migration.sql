ALTER TABLE `tenants` ADD COLUMN `weekly_report_enabled` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `tenants` ADD COLUMN `monthly_report_enabled` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `tenants` ADD COLUMN `report_recipient_emails` JSON NULL;
