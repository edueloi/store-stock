-- Toda loja passa a enviar e-mails de documentos pelo sistema por padrão.
ALTER TABLE `tenants` ALTER COLUMN `email_sender_mode` SET DEFAULT 'system';

-- Lojas existentes que ainda não conectaram conta própria (e por isso não conseguiam
-- enviar nada) passam para "system". Quem já tem conta própria conectada continua em "own".
UPDATE `tenants`
SET `email_sender_mode` = 'system'
WHERE `email_sender_mode` = 'own'
  AND (`email_config` IS NULL OR JSON_TYPE(`email_config`) = 'NULL');
