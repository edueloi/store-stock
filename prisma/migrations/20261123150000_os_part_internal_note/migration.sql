-- Observacao interna por item da O.S. (nao sai no PDF do cliente).
ALTER TABLE `service_order_parts` ADD COLUMN `internal_note` VARCHAR(500) NULL;
