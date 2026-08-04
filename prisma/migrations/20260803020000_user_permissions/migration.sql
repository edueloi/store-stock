-- Substitui o modelo de permissão por papel fixo (stage_permissions) por permissão
-- individual por usuário, cobrindo tanto os menus do sistema quanto as etapas do
-- fluxo de Orçamento/OS.

-- DropForeignKey / DropTable stage_permissions (nunca chegou a ser usada por controller algum)
ALTER TABLE `stage_permissions` DROP FOREIGN KEY `stage_permissions_tenant_id_fkey`;
DROP TABLE `stage_permissions`;

-- CreateTable user_menu_permissions
CREATE TABLE `user_menu_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `menu` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `user_menu_permissions_user_id_menu_key` ON `user_menu_permissions`(`user_id`, `menu`);
CREATE INDEX `user_menu_permissions_user_id_idx` ON `user_menu_permissions`(`user_id`);

ALTER TABLE `user_menu_permissions` ADD CONSTRAINT `user_menu_permissions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable user_stage_permissions
CREATE TABLE `user_stage_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `user_stage_permissions_user_id_stage_key` ON `user_stage_permissions`(`user_id`, `stage`);
CREATE INDEX `user_stage_permissions_user_id_idx` ON `user_stage_permissions`(`user_id`);

ALTER TABLE `user_stage_permissions` ADD CONSTRAINT `user_stage_permissions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
