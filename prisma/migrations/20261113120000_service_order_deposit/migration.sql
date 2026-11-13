-- Entrada (sinal) recebida na Ordem de Serviço, com a forma de pagamento. Abate o saldo ao faturar.
ALTER TABLE `service_orders` ADD COLUMN `deposit_amount` DECIMAL(10, 2) NULL;
ALTER TABLE `service_orders` ADD COLUMN `deposit_payment_method` VARCHAR(191) NULL;
ALTER TABLE `service_orders` ADD COLUMN `deposit_paid_at` DATETIME(3) NULL;

-- OS que nasceu de um orçamento com entrada já recebida herda essa entrada (o dinheiro já está no financeiro; não lança de novo).
UPDATE `service_orders` so JOIN `quotes` q ON q.id = so.quote_id
SET so.deposit_amount = q.deposit_amount, so.deposit_payment_method = q.deposit_payment_method, so.deposit_paid_at = q.deposit_paid_at
WHERE q.deposit_amount IS NOT NULL AND q.deposit_amount > 0 AND so.invoiced_order_id IS NULL;
