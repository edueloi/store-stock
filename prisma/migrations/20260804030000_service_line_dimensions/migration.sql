-- Persiste a metragem (ex: "1.20m × 2.00m = 2.40m²") de um Serviço por medida
-- vendido no PDV ou incluído em um Orçamento, mesmo campo já usado em quote_items.
ALTER TABLE `quote_services` ADD COLUMN `dimensions_label` VARCHAR(191) NULL;
ALTER TABLE `order_services` ADD COLUMN `dimensions_label` VARCHAR(191) NULL;
