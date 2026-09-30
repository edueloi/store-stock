-- Dados de entrega separados para exibir e conciliar pedidos da loja online.
ALTER TABLE `orders`
  ADD COLUMN `delivery_method` VARCHAR(32) NULL,
  ADD COLUMN `shipping_amount` DECIMAL(10,2) NULL DEFAULT 0;
