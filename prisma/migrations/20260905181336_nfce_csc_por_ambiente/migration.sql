-- CSC/idCSC são registros SEPARADOS por ambiente na SEFAZ (o de homologação não vale
-- em produção, e vice-versa) — campos legados nfce_csc_id/nfce_csc_token mantidos como
-- fallback pra tenants configurados antes desta separação existir.
ALTER TABLE `tenants`
  ADD COLUMN `nfce_csc_id_homologacao` VARCHAR(191) NULL,
  ADD COLUMN `nfce_csc_token_homologacao` VARCHAR(191) NULL,
  ADD COLUMN `nfce_csc_id_producao` VARCHAR(191) NULL,
  ADD COLUMN `nfce_csc_token_producao` VARCHAR(191) NULL;
