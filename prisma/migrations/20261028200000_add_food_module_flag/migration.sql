-- Módulo para estabelecimentos alimentícios (comandas + cardápio QR), liberado pelo Super Admin
ALTER TABLE `tenants` ADD COLUMN `food_enabled` BOOLEAN NOT NULL DEFAULT false;
