-- Links nomeados com campanha, origem do contato e contas criadas pela página do Store.
ALTER TABLE `affiliate_clicks`
  ADD COLUMN `campaign` VARCHAR(40) NULL,
  ADD INDEX `affiliate_clicks_affiliate_id_campaign_idx` (`affiliate_id`, `campaign`);

ALTER TABLE `affiliate_leads`
  ADD COLUMN `campaign` VARCHAR(40) NULL,
  ADD COLUMN `origin` VARCHAR(191) NOT NULL DEFAULT 'manual',
  ADD COLUMN `tenant_id` INTEGER NULL,
  ADD COLUMN `trial_ends_at` DATETIME(3) NULL,
  ADD INDEX `affiliate_leads_tenant_id_idx` (`tenant_id`);

CREATE TABLE `affiliate_links` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `affiliate_id` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `campaign` VARCHAR(40) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `affiliate_links_affiliate_id_campaign_key` (`affiliate_id`, `campaign`),
  CONSTRAINT `affiliate_links_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
