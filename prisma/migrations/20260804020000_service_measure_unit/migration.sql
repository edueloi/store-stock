-- Venda de serviço por medida (m²/metro linear), mesmo mecanismo já usado em Product.
ALTER TABLE `services`
  ADD COLUMN `sale_unit` VARCHAR(191) NOT NULL DEFAULT 'unidade',
  ADD COLUMN `price_per_measure` DECIMAL(10, 2) NULL,
  ADD COLUMN `min_billable_quantity` DECIMAL(10, 2) NULL;
