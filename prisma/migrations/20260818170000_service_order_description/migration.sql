-- Descrição livre do serviço realizado na OS (o que foi feito), além do valor fixo de mão de obra.
ALTER TABLE `service_orders`
  ADD COLUMN `service_description` TEXT NULL;
