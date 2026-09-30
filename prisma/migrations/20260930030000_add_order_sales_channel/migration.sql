-- Separa pedidos originados na vitrine de vendas feitas no PDV.
ALTER TABLE `orders`
  ADD COLUMN `sales_channel` VARCHAR(32) NOT NULL DEFAULT 'pdv';

CREATE INDEX `orders_tenant_id_sales_channel_created_at_idx`
  ON `orders` (`tenant_id`, `sales_channel`, `created_at`);
