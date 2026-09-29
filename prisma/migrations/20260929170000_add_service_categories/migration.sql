-- CreateTable: ServiceCategory (dedicada a Service — separada de `categories`,
-- que é exclusiva de Product)
CREATE TABLE `service_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL DEFAULT 'wrench',
    `color` VARCHAR(191) NULL DEFAULT '#2563eb',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_categories_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `service_categories` ADD CONSTRAINT `service_categories_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: services — adiciona category_id (FK opcional). A coluna antiga
-- `category` (string livre) é mantida por ora — será removida numa segunda
-- migration, DEPOIS que o script scripts/migrate-service-categories.ts rodar
-- com sucesso em produção e popular category_id para todos os registros.
ALTER TABLE `services` ADD COLUMN `category_id` INTEGER NULL;

CREATE INDEX `services_category_id_idx` ON `services`(`category_id`);

ALTER TABLE `services` ADD CONSTRAINT `services_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: service_order_parts — adiciona service_id (FK opcional, mutuamente
-- exclusiva com product_id) para permitir vincular um Service do catálogo
-- diretamente a um item de Ordem de Serviço, reaproveitando o mesmo cálculo de
-- totais/desconto/cortesia já usado para peças (product_id).
ALTER TABLE `service_order_parts` ADD COLUMN `service_id` INTEGER NULL;

CREATE INDEX `service_order_parts_service_id_idx` ON `service_order_parts`(`service_id`);

ALTER TABLE `service_order_parts` ADD CONSTRAINT `service_order_parts_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
