-- AlterTable
ALTER TABLE `services` ADD COLUMN `unit` VARCHAR(191) NOT NULL DEFAULT 'unidade',
                       ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'Geral';
