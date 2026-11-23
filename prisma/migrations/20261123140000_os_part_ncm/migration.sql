-- NCM do item avulso da ordem de servico (item com NCM entra na NFC-e ao faturar).
ALTER TABLE `service_order_parts` ADD COLUMN `ncm` VARCHAR(8) NULL;
