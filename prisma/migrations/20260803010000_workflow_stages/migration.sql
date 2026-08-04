-- CreateTable stage_permissions (permissão por papel para mover Orçamento/OS entre etapas)
CREATE TABLE `stage_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `stage_permissions_tenant_id_role_stage_key` ON `stage_permissions`(`tenant_id`, `role`, `stage`);
CREATE INDEX `stage_permissions_tenant_id_idx` ON `stage_permissions`(`tenant_id`);

-- AddForeignKey stage_permissions -> tenants
ALTER TABLE `stage_permissions` ADD CONSTRAINT `stage_permissions_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable quotes: link público de aprovação pelo cliente
ALTER TABLE `quotes`
  ADD COLUMN `approval_token` VARCHAR(191) NULL,
  ADD COLUMN `approved_at` DATETIME(3) NULL,
  ADD COLUMN `approved_by_client` BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX `quotes_approval_token_key` ON `quotes`(`approval_token`);

-- Migra vocabulário de status existente para o novo fluxo unificado de 8 etapas
-- (rascunho | orcamento_enviado | aguardando_aprovacao | aprovado | em_producao | finalizado | nota_emitida | entregue),
-- mantendo estados terminais (cancelada/cancelled/expired/converted) como estão.
UPDATE `quotes` SET `status` = 'orcamento_enviado' WHERE `status` = 'open';

UPDATE `service_orders` SET `status` = 'orcamento_enviado' WHERE `status` = 'aberta';
UPDATE `service_orders` SET `status` = 'aguardando_aprovacao' WHERE `status` = 'em_analise';
UPDATE `service_orders` SET `status` = 'em_producao' WHERE `status` = 'em_conserto';
UPDATE `service_orders` SET `status` = 'finalizado' WHERE `status` = 'pronto_retirada';
