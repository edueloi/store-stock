-- Variação escolhida (tamanho, cor...) em itens de orçamento e peças de ordem de serviço.
ALTER TABLE `quote_items` ADD COLUMN `selected_options` JSON NULL;
ALTER TABLE `service_order_parts` ADD COLUMN `selected_options` JSON NULL;
