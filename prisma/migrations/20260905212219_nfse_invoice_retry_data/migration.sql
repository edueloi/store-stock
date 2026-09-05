ALTER TABLE `nfse_invoices`
  ADD COLUMN `codigo_tributacao_nacional` VARCHAR(191) NULL,
  ADD COLUMN `descricao_servico` TEXT NULL,
  ADD COLUMN `valor_servico` DECIMAL(10, 2) NULL;
