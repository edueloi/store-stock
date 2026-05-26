-- AddColumn barcode to products (non-destructive)
ALTER TABLE `products` ADD COLUMN `barcode` VARCHAR(191) NULL;

-- Optional index for fast barcode lookup in PDV
CREATE INDEX `products_barcode_idx` ON `products`(`barcode`);
