-- Módulo "Fluxo de Produção" (Kanban) liberado por tenant pelo Super Admin —
-- desligado por padrão, precisa ser habilitado explicitamente por loja/plano.
ALTER TABLE `tenants` ADD COLUMN `fluxo_producao_enabled` BOOLEAN NOT NULL DEFAULT false;
