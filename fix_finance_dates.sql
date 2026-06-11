-- ============================================================
-- SCRIPT: Corrigir datas do fluxo de caixa (bug UTC -> local)
-- SEGURO: apenas UPDATE, nenhum DELETE ou DROP
-- RODAR: mysql -u <user> -p <banco> < fix_finance_dates.sql
-- ============================================================

-- 1. Visualizar ANTES da correção (quantos registros e intervalo de datas)
SELECT
  COUNT(*)          AS total_registros,
  MIN(date)         AS data_mais_antiga,
  MAX(date)         AS data_mais_recente
FROM finance;

-- 2. Aplicar correção: adiciona 1 dia em TODOS os registros
UPDATE finance
SET date = DATE_ADD(date, INTERVAL 1 DAY);

-- 3. Confirmar DEPOIS da correção
SELECT
  COUNT(*)          AS total_registros,
  MIN(date)         AS data_mais_antiga,
  MAX(date)         AS data_mais_recente
FROM finance;
