-- Mantém separadas a taxa interna da adquirente e a taxa cobrada do cliente.
-- Recibos usam somente passed_fee_amount; pedidos existentes ficam nulos e não
-- passam a mostrar a taxa que a loja absorveu.
ALTER TABLE `orders`
  ADD COLUMN `passed_fee_amount` DECIMAL(10, 2) NULL;
