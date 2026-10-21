-- Peça de vidraçaria (medidas, sangria e margem) em itens de serviço da ordem de serviço.
ALTER TABLE `service_order_parts` ADD COLUMN `piece_spec` JSON NULL;
