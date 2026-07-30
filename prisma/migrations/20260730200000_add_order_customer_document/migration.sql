-- AlterTable orders: add customer_document (CPF/CNPJ avulso para nota com destinatário identificado)
ALTER TABLE `orders`
  ADD COLUMN `customer_document` VARCHAR(20) NULL;
