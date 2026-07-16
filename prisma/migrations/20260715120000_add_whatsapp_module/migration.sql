CREATE TABLE `whatsapp_workspaces` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenant_id` INTEGER NOT NULL,
  `is_enabled` BOOLEAN NOT NULL DEFAULT false,
  `provider` VARCHAR(191) NOT NULL DEFAULT 'evolution',
  `evolution_base_url` VARCHAR(191) NULL,
  `evolution_api_key` TEXT NULL,
  `evolution_instance` VARCHAR(191) NULL,
  `webhook_secret` VARCHAR(191) NULL,
  `fallback_phone` VARCHAR(191) NULL,
  `settings` JSON NULL,
  `menus` JSON NULL,
  `templates` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `whatsapp_workspaces_tenant_id_key`(`tenant_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_agents` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `workspace_id` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `department` VARCHAR(191) NOT NULL DEFAULT 'sales',
  `role` VARCHAR(191) NOT NULL DEFAULT 'agent',
  `phone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `is_online` BOOLEAN NOT NULL DEFAULT true,
  `can_receive_transfer` BOOLEAN NOT NULL DEFAULT true,
  `max_concurrent_chats` INTEGER NOT NULL DEFAULT 3,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `whatsapp_agents_workspace_id_department_is_active_is_online_idx`(`workspace_id`, `department`, `is_active`, `is_online`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_conversations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `workspace_id` INTEGER NOT NULL,
  `remote_jid` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `customer_name` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'bot',
  `current_menu` VARCHAR(191) NOT NULL DEFAULT 'main',
  `department` VARCHAR(191) NULL,
  `assigned_agent_id` INTEGER NULL,
  `queue_position` INTEGER NULL,
  `last_message_preview` TEXT NULL,
  `last_inbound_at` DATETIME(3) NULL,
  `last_outbound_at` DATETIME(3) NULL,
  `closed_reason` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `whatsapp_conversations_workspace_id_remote_jid_key`(`workspace_id`, `remote_jid`),
  INDEX `whatsapp_conversations_workspace_id_status_department_idx`(`workspace_id`, `status`, `department`),
  INDEX `whatsapp_conversations_workspace_id_assigned_agent_id_idx`(`workspace_id`, `assigned_agent_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_message_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversation_id` INTEGER NOT NULL,
  `direction` VARCHAR(191) NOT NULL,
  `message_type` VARCHAR(191) NOT NULL DEFAULT 'text',
  `body` TEXT NULL,
  `external_message_id` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `whatsapp_message_logs_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_workspaces`
  ADD CONSTRAINT `whatsapp_workspaces_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `whatsapp_agents`
  ADD CONSTRAINT `whatsapp_agents_workspace_id_fkey`
  FOREIGN KEY (`workspace_id`) REFERENCES `whatsapp_workspaces`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `whatsapp_conversations`
  ADD CONSTRAINT `whatsapp_conversations_workspace_id_fkey`
  FOREIGN KEY (`workspace_id`) REFERENCES `whatsapp_workspaces`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `whatsapp_conversations_assigned_agent_id_fkey`
  FOREIGN KEY (`assigned_agent_id`) REFERENCES `whatsapp_agents`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `whatsapp_message_logs`
  ADD CONSTRAINT `whatsapp_message_logs_conversation_id_fkey`
  FOREIGN KEY (`conversation_id`) REFERENCES `whatsapp_conversations`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
