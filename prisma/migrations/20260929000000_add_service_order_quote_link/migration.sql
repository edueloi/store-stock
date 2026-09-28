-- Liga a OS ao Orçamento que a originou (lojas de gráfica, ver Tenant.grafica_enabled
-- e createLinkedServiceOrder em quotes.controller.ts). ON DELETE SET NULL: apagar o
-- Orçamento não deve arrastar a OS, que pode ter peças/checklist/fotos próprias.
ALTER TABLE `service_orders`
  ADD COLUMN `quote_id` INTEGER NULL;

CREATE UNIQUE INDEX `service_orders_quote_id_key` ON `service_orders`(`quote_id`);

ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_quote_id_fkey`
  FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
