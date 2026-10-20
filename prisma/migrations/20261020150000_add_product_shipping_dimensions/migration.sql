-- Peso e dimensões da embalagem para cálculo de frete nas vendas online.
ALTER TABLE `products`
  ADD COLUMN `weight_grams` INTEGER NULL,
  ADD COLUMN `package_length_cm` DECIMAL(8,2) NULL,
  ADD COLUMN `package_width_cm` DECIMAL(8,2) NULL,
  ADD COLUMN `package_height_cm` DECIMAL(8,2) NULL;
