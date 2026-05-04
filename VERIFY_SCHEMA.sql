-- Script de diagnóstico: Quais colunas REALMENTE existem em questions?

-- 1. Listar TODAS as colunas de questions
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'questions'
ORDER BY ordinal_position;

-- 2. Listar todas as colunas de evaluations
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'evaluations'
ORDER BY ordinal_position;

-- 3. Listar todas as colunas de pdi_actions
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'pdi_actions'
ORDER BY ordinal_position;
