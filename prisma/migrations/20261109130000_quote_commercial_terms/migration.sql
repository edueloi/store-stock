-- Condições comerciais do orçamento: prazo de entrega, formas de pagamento e entrada (sem/percentual/valor).
ALTER TABLE `quotes`
  ADD COLUMN `delivery_deadline` VARCHAR(191) NULL,
  ADD COLUMN `payment_terms` VARCHAR(255) NULL,
  ADD COLUMN `down_payment_type` VARCHAR(20) NULL,
  ADD COLUMN `down_payment_value` DECIMAL(10, 2) NULL;
