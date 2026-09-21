ALTER TABLE `whatsapp_workspaces` ADD COLUMN `finance_alerts_phone` VARCHAR(191) NULL;
ALTER TABLE `whatsapp_workspaces` ADD COLUMN `finance_alerts_enabled` BOOLEAN NOT NULL DEFAULT false;
