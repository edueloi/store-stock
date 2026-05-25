-- AddColumn: document (CPF/CNPJ), logo_url separado já existe, endereço estruturado
ALTER TABLE `tenants`
  ADD COLUMN `document`       VARCHAR(20)  NULL AFTER `whatsapp`,
  ADD COLUMN `address_street` VARCHAR(191) NULL AFTER `address`,
  ADD COLUMN `address_number` VARCHAR(20)  NULL AFTER `address_street`,
  ADD COLUMN `address_complement` VARCHAR(100) NULL AFTER `address_number`,
  ADD COLUMN `address_district` VARCHAR(100) NULL AFTER `address_complement`,
  ADD COLUMN `address_city`   VARCHAR(100) NULL AFTER `address_district`,
  ADD COLUMN `address_state`  VARCHAR(2)   NULL AFTER `address_city`,
  ADD COLUMN `address_zip`    VARCHAR(10)  NULL AFTER `address_state`;
