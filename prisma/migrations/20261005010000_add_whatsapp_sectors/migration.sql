-- Setores configuráveis para organizar handoff e atendentes do WhatsApp.
CREATE TABLE `whatsapp_sectors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace_id` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `whatsapp_sectors_workspace_id_key_key`(`workspace_id`, `key`),
    INDEX `whatsapp_sectors_workspace_id_is_active_sort_order_idx`(`workspace_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_sectors`
    ADD CONSTRAINT `whatsapp_sectors_workspace_id_fkey`
    FOREIGN KEY (`workspace_id`) REFERENCES `whatsapp_workspaces`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
