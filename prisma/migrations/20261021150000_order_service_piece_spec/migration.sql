-- Peça de vidraçaria (medidas, sangria e margem) nos serviços do pedido.
ALTER TABLE `order_services` ADD COLUMN `piece_spec` JSON NULL;
