-- Product: venda por medida (m²/metro linear) — aditivo, nulável/defaulted
ALTER TABLE `products`
  ADD COLUMN `sale_unit` VARCHAR(191) NOT NULL DEFAULT 'unidade',
  ADD COLUMN `price_per_measure` DECIMAL(10, 2) NULL,
  ADD COLUMN `min_billable_quantity` DECIMAL(10, 2) NULL;

-- Linhas de item: rótulo de dimensão exibido em recibos/PDFs (aditivo, nulável)
ALTER TABLE `order_items`
  ADD COLUMN `dimensions_label` VARCHAR(191) NULL;

ALTER TABLE `quote_items`
  ADD COLUMN `dimensions_label` VARCHAR(191) NULL;

ALTER TABLE `service_order_parts`
  ADD COLUMN `dimensions_label` VARCHAR(191) NULL;
