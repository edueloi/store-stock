-- Troco da venda em dinheiro, calculado no PDV e persistido para uso no DANFE/recibo.
ALTER TABLE `orders`
  ADD COLUMN `change_amount` DECIMAL(10, 2) NULL;
