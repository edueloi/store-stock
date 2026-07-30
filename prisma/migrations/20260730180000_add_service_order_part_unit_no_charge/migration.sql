-- AlterTable service_order_parts: add unit and no_charge
ALTER TABLE `service_order_parts`
  ADD COLUMN `unit` VARCHAR(10) NOT NULL DEFAULT 'UN',
  ADD COLUMN `no_charge` BOOLEAN NOT NULL DEFAULT false;
