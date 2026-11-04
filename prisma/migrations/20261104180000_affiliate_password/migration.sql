-- Afiliados entram com e-mail e senha (o link mágico por e-mail continua como "esqueci minha senha").
ALTER TABLE `affiliates` ADD COLUMN `password_hash` VARCHAR(191) NULL;
