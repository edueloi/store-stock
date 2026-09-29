-- NAO APLICAR AINDA EM PRODUCAO.
-- Esta migration só deve ser aplicada (prisma migrate deploy) DEPOIS de:
--   1) A migration 20260929170000_add_service_categories já ter sido aplicada
--      em produção (cria service_categories + services.category_id).
--   2) O script scripts/migrate-service-categories.ts já ter rodado com sucesso
--      em produção e confirmado 0 serviços com category_id nulo.
--
-- Ela remove a coluna antiga `services.category` (string livre), que só existe
-- por compatibilidade durante a migração para ServiceCategory (category_id).
-- Depois de aplicá-la, remova também o campo `category` de prisma/schema.prisma
-- (hoje mantido só para o schema continuar batendo com o estado do banco antes
-- desta migration rodar) e rode `npx prisma generate`.

ALTER TABLE `services` DROP COLUMN `category`;
