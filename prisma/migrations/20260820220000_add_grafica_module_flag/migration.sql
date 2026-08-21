-- Módulo "Gráfica" liberado por tenant pelo Super Admin — controla se as etapas
-- "Aguardando arte"/"Arte finalizada" do fluxo de Ordem de Serviço ficam disponíveis
-- (só faz sentido pra lojas do ramo gráfico). Desligado por padrão.
ALTER TABLE `tenants` ADD COLUMN `grafica_enabled` BOOLEAN NOT NULL DEFAULT false;
