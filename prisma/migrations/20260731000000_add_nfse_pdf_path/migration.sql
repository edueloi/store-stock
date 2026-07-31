-- AlterTable nfse_invoices: add nfse_pdf_path
ALTER TABLE `nfse_invoices`
  ADD COLUMN `nfse_pdf_path` VARCHAR(255) NULL;
