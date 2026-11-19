-- Nome da obra / cliente final em cada pedido.
ALTER TABLE `orders` ADD COLUMN `order_label` VARCHAR(120) NULL;
