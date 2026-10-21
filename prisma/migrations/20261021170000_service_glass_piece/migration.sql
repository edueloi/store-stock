-- Serviço marcado como peça de vidraçaria (tipo e padrões da peça).
ALTER TABLE `services`
  ADD COLUMN `piece_kind` VARCHAR(191) NULL,
  ADD COLUMN `piece_defaults` JSON NULL;
