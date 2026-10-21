-- Peça sob medida (vidraçaria) no serviço do orçamento e origem do orçamento (manual | vitrine).
ALTER TABLE `quote_services` ADD COLUMN `piece_spec` JSON NULL;
ALTER TABLE `quotes` ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'manual';
