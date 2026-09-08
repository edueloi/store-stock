-- Item avulso no PDV: OrderItem.product_id vira opcional, ganha name/ncm denormalizados
-- usados só quando product_id é nulo (item que não existe no catálogo).
ALTER TABLE `order_items`
  DROP FOREIGN KEY `order_items_product_id_fkey`;

ALTER TABLE `order_items`
  MODIFY `product_id` INT NULL,
  ADD COLUMN `name` VARCHAR(191) NULL,
  ADD COLUMN `ncm` VARCHAR(8) NULL;

ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
