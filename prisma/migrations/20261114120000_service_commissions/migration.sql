-- Comissão sobre serviços (Ordens de Serviço): regra padrão do técnico/vendedor + ajuste por O.S. + controle de pagamento.
ALTER TABLE `sellers` ADD COLUMN `service_commission_type` VARCHAR(191) NOT NULL DEFAULT 'percent';
ALTER TABLE `sellers` ADD COLUMN `service_commission_value` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `technicians` ADD COLUMN `service_commission_type` VARCHAR(191) NOT NULL DEFAULT 'percent';
ALTER TABLE `technicians` ADD COLUMN `service_commission_value` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `service_orders` ADD COLUMN `commission_technician_type` VARCHAR(191) NULL;
ALTER TABLE `service_orders` ADD COLUMN `commission_technician_value` DECIMAL(10, 2) NULL;
ALTER TABLE `service_orders` ADD COLUMN `commission_seller_type` VARCHAR(191) NULL;
ALTER TABLE `service_orders` ADD COLUMN `commission_seller_value` DECIMAL(10, 2) NULL;
ALTER TABLE `service_orders` ADD COLUMN `technician_commission_paid_at` DATETIME(3) NULL;
ALTER TABLE `service_orders` ADD COLUMN `seller_commission_paid_at` DATETIME(3) NULL;
