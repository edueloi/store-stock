ALTER TABLE `products`
  ADD COLUMN `max_discount_pct` DECIMAL(5, 2) NULL,
  ADD COLUMN `min_stock` INTEGER NOT NULL DEFAULT 5;
