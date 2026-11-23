-- Orcamento passa a pertencer a um CNPJ emissor (mesmo mecanismo de ordens de servico e vendas).
ALTER TABLE `quotes` ADD COLUMN `issuer_id` INTEGER NULL;
CREATE INDEX `quotes_issuer_id_idx` ON `quotes`(`issuer_id`);
