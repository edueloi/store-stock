-- Desconto por item (ServiceOrderPart) e desconto total (ServiceOrder), mesmo
-- padrão já usado em Quote/QuoteItem.

-- AlterTable service_orders: subtotal + desconto total
ALTER TABLE `service_orders`
  ADD COLUMN `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `discount_type` VARCHAR(191) NOT NULL DEFAULT 'percent',
  ADD COLUMN `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- subtotal existente = total_amount atual (sem desconto aplicado ainda)
UPDATE `service_orders` SET `subtotal` = `total_amount`;

-- AlterTable service_order_parts: desconto por item
ALTER TABLE `service_order_parts`
  ADD COLUMN `total_before_discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `discount_type` VARCHAR(191) NOT NULL DEFAULT 'percent',
  ADD COLUMN `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- total_before_discount existente = total atual (sem desconto por item ainda)
UPDATE `service_order_parts` SET `total_before_discount` = `total`;
