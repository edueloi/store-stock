-- Vidraçaria: produto por m² marcado como peça e a peça gravada nos itens do orçamento.
ALTER TABLE `products` ADD COLUMN `piece_kind` VARCHAR(40) NULL, ADD COLUMN `piece_defaults` JSON NULL;
ALTER TABLE `quote_items` ADD COLUMN `piece_spec` JSON NULL;
