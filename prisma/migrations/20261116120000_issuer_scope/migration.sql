-- CNPJ (empresa) a que cada venda, O.S., lançamento e caixa pertence: base dos relatórios e do fluxo de caixa por CNPJ.
ALTER TABLE `orders` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `orders_issuer_id_idx` ON `orders`(`issuer_id`);
ALTER TABLE `service_orders` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `service_orders_issuer_id_idx` ON `service_orders`(`issuer_id`);
ALTER TABLE `accounts_receivable` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `accounts_receivable_issuer_id_idx` ON `accounts_receivable`(`issuer_id`);
ALTER TABLE `accounts_payable` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `accounts_payable_issuer_id_idx` ON `accounts_payable`(`issuer_id`);
ALTER TABLE `cash_sessions` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `cash_sessions_issuer_id_idx` ON `cash_sessions`(`issuer_id`);
ALTER TABLE `finance` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `finance_issuer_id_idx` ON `finance`(`issuer_id`);
