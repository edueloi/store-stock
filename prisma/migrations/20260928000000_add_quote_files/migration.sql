-- Anexos de Orçamento (referência do cliente, arte final, prova de aprovação) —
-- Quote não tinha nenhum modelo de arquivo até então (só ServiceOrder tinha fotos).
CREATE TABLE `quote_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `quote_id` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'referencia',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `quote_files_quote_id_idx` ON `quote_files`(`quote_id`);
CREATE INDEX `quote_files_tenant_id_idx` ON `quote_files`(`tenant_id`);

ALTER TABLE `quote_files` ADD CONSTRAINT `quote_files_quote_id_fkey`
  FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
