-- Valor mínimo (R$) cobrado por item de serviço por medida (m² / metro linear).
ALTER TABLE `services` ADD COLUMN `min_charge` DECIMAL(10, 2) NULL;
