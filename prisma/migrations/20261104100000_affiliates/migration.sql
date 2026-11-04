-- Programa de afiliados: planos de comissão por faixa de mês, afiliados, cliques, leads, indicações,
-- comissões (uma por cobrança paga), metas, links mágicos de login e fila de webhook para a Develoi.

CREATE TABLE `affiliate_plans` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `rules` JSON NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliates` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `whatsapp` VARCHAR(191) NOT NULL,
  `document` VARCHAR(191) NULL,
  `asaas_wallet_id` VARCHAR(191) NULL,
  `wallet_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `plan_id` INTEGER NULL,
  `rules_override` JSON NULL,
  `pitch` TEXT NULL,
  `admin_notes` TEXT NULL,
  `approved_at` DATETIME(3) NULL,
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `affiliates_code_key` (`code`),
  UNIQUE INDEX `affiliates_email_key` (`email`),
  INDEX `affiliates_status_idx` (`status`),
  CONSTRAINT `affiliates_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `affiliate_plans` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_clicks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `affiliate_id` INTEGER NOT NULL,
  `visitor_hash` VARCHAR(191) NULL,
  `landing` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `affiliate_clicks_affiliate_id_created_at_idx` (`affiliate_id`, `created_at`),
  CONSTRAINT `affiliate_clicks_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_leads` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `affiliate_id` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `whatsapp` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `business` VARCHAR(191) NULL,
  `system` VARCHAR(191) NOT NULL DEFAULT 'store',
  `message` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  `admin_notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `affiliate_leads_affiliate_id_status_idx` (`affiliate_id`, `status`),
  CONSTRAINT `affiliate_leads_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_referrals` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `affiliate_id` INTEGER NOT NULL,
  `lead_id` INTEGER NULL,
  `develoi_client_id` VARCHAR(191) NULL,
  `tenant_id` INTEGER NULL,
  `asaas_subscription_id` VARCHAR(191) NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `plan_value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `rules` JSON NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'trial',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cancelled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `affiliate_referrals_develoi_client_id_key` (`develoi_client_id`),
  UNIQUE INDEX `affiliate_referrals_asaas_subscription_id_key` (`asaas_subscription_id`),
  INDEX `affiliate_referrals_affiliate_id_status_idx` (`affiliate_id`, `status`),
  CONSTRAINT `affiliate_referrals_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `affiliate_referrals_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `affiliate_leads` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_commissions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `referral_id` INTEGER NOT NULL,
  `affiliate_id` INTEGER NOT NULL,
  `sequence` INTEGER NOT NULL,
  `asaas_payment_id` VARCHAR(191) NOT NULL,
  `gross_value` DECIMAL(10, 2) NOT NULL,
  `net_value` DECIMAL(10, 2) NULL,
  `commission_value` DECIMAL(10, 2) NOT NULL,
  `rule_type` VARCHAR(191) NOT NULL,
  `rule_value` DECIMAL(10, 4) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `due_date` DATE NULL,
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `affiliate_commissions_asaas_payment_id_key` (`asaas_payment_id`),
  INDEX `affiliate_commissions_affiliate_id_status_idx` (`affiliate_id`, `status`),
  INDEX `affiliate_commissions_referral_id_sequence_idx` (`referral_id`, `sequence`),
  CONSTRAINT `affiliate_commissions_referral_id_fkey` FOREIGN KEY (`referral_id`) REFERENCES `affiliate_referrals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `affiliate_commissions_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_goals` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `affiliate_id` INTEGER NULL,
  `title` VARCHAR(191) NOT NULL,
  `metric` VARCHAR(191) NOT NULL,
  `target` DECIMAL(12, 2) NOT NULL,
  `reward` VARCHAR(191) NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `created_by` VARCHAR(191) NOT NULL DEFAULT 'affiliate',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `affiliate_goals_affiliate_id_period_end_idx` (`affiliate_id`, `period_end`),
  CONSTRAINT `affiliate_goals_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_login_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `affiliate_id` INTEGER NOT NULL,
  `token_hash` VARCHAR(191) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `affiliate_login_tokens_token_hash_key` (`token_hash`),
  CONSTRAINT `affiliate_login_tokens_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `affiliate_events` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL,
  `delivered_at` DATETIME(3) NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `next_try_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_error` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `affiliate_events_delivered_at_next_try_at_idx` (`delivered_at`, `next_try_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
