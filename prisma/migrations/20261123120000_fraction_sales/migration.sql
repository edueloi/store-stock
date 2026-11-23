-- Venda de fracao de unidade (ex.: meia barra). O estoque segue em unidades inteiras; a sobra de unidades "abertas" fica em fraction_leftover.
ALTER TABLE `products` ADD COLUMN `allow_fraction` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `products` ADD COLUMN `fraction_leftover` DECIMAL(7, 4) NOT NULL DEFAULT 0;
ALTER TABLE `order_items` ADD COLUMN `fraction` DECIMAL(7, 4) NULL;
