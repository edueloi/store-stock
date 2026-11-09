-- Parcela do crediário cobrada por boleto ("boleto emitido"): sai do "Em aberto" e aparece em "Boleto emitido" até a baixa.
ALTER TABLE `customer_debt_installments`
  ADD COLUMN `billing_method` VARCHAR(191) NULL;
