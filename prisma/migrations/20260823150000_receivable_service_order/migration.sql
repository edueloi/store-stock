-- AlterTable
ALTER TABLE `accounts_receivable` ADD COLUMN `service_order_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `accounts_receivable_service_order_id_idx` ON `accounts_receivable`(`service_order_id`);

-- AddForeignKey
ALTER TABLE `accounts_receivable` ADD CONSTRAINT `accounts_receivable_service_order_id_fkey` FOREIGN KEY (`service_order_id`) REFERENCES `service_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
