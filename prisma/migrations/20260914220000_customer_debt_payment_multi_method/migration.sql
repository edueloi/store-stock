ALTER TABLE `customer_debt_payments`
  ADD COLUMN `card_brand` VARCHAR(191) NULL,
  ADD COLUMN `installments` INT NULL,
  ADD COLUMN `gross_amount` DECIMAL(10, 2) NULL,
  ADD COLUMN `fee_amount` DECIMAL(10, 2) NULL,
  ADD COLUMN `net_amount` DECIMAL(10, 2) NULL,
  ADD COLUMN `cash_session_id` INT NULL;

CREATE INDEX `customer_debt_payments_cash_session_id_idx` ON `customer_debt_payments`(`cash_session_id`);

ALTER TABLE `customer_debt_payments` ADD CONSTRAINT `customer_debt_payments_cash_session_id_fkey`
  FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
