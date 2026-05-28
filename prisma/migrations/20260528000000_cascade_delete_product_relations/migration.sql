-- Drop existing FK constraints and recreate with ON DELETE CASCADE
-- so that deleting a product automatically removes related stock_movements and order_items

-- stock_movements: drop old FK, add cascade
ALTER TABLE `stock_movements` DROP FOREIGN KEY IF EXISTS `stock_movements_product_id_fkey`;
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- order_items: drop old FK, add cascade
ALTER TABLE `order_items` DROP FOREIGN KEY IF EXISTS `order_items_product_id_fkey`;
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
