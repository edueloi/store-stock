-- Change default value of is_active from TRUE to FALSE
-- New products will be inactive by default and must be manually activated
ALTER TABLE `products` ALTER COLUMN `is_active` SET DEFAULT false;
