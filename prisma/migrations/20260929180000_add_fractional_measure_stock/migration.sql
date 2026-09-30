-- Estoque físico fracionado para produtos vendidos por metro linear ou m².
-- Mantém `stock_quantity` inteiro para produtos vendidos por unidade.
ALTER TABLE `products`
  ADD COLUMN `measure_stock_quantity` DECIMAL(12,3) NULL,
  ADD COLUMN `measure_min_stock` DECIMAL(12,3) NULL,
  ADD COLUMN `measure_unit` VARCHAR(10) NULL;

-- Preserva o saldo que eventualmente já existia em produtos por medida.
UPDATE `products`
SET `measure_stock_quantity` = `stock_quantity`,
    `measure_min_stock` = `min_stock`
WHERE `sale_unit` IN ('m2', 'linear');

UPDATE `products`
SET `measure_unit` = CASE WHEN `sale_unit` = 'm2' THEN 'm2' ELSE 'm' END
WHERE `sale_unit` IN ('m2', 'linear');

-- Registra quanto saiu fisicamente sem mudar a compatibilidade dos itens antigos.
ALTER TABLE `order_items`
  ADD COLUMN `measured_quantity` DECIMAL(12,3) NULL;

ALTER TABLE `service_order_parts`
  ADD COLUMN `measured_quantity` DECIMAL(12,3) NULL;

ALTER TABLE `stock_movements`
  ADD COLUMN `measured_quantity` DECIMAL(12,3) NULL;
