-- Liga a conta a receber à venda que a originou (Boleto à vista): ao dar baixa, a receita entra no Fluxo de Caixa.
ALTER TABLE `accounts_receivable`
  ADD COLUMN `order_id` INTEGER NULL,
  ADD INDEX `accounts_receivable_order_id_idx` (`order_id`);
