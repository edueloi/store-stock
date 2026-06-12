-- Add ON DELETE CASCADE on order_items.order_id so deleting an Order
-- automatically removes its items at the database level.
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_order_id_fkey`;
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
