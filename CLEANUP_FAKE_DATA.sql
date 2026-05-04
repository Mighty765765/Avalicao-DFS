-- =====================================================================
-- Script de Limpeza - Remove dados FAKE do desenvolvimento
-- =====================================================================
-- ATENÇÃO: Este script deleta DADOS, não estrutura
-- Mantém: questions, cycles, competencies, departments, positions
-- Limpa: evaluations, pdi, profiles fake
-- =====================================================================

begin;

-- 1. Limpar histórico de des-finalizações de ações
delete from public.pdi_action_unfinalize_history;

-- 2. Limpar pontos do PDI
delete from public.pdi_points;

-- 3. Limpar ações do PDI
delete from public.pdi_actions;

-- 4. Limpar PDIs
delete from public.pdi;

-- 5. Limpar respostas de avaliação
delete from public.qualitative_answers;
delete from public.answers;

-- 6. Limpar avaliações
delete from public.evaluations;

-- 7. Limpar profiles FAKE (mantém admin se existir)
-- Importante: Adapte o WHERE para seus critérios de "fake"
-- Exemplo: deleta profiles com email contendo "test" ou "fake"
delete from public.profiles
where email ilike '%test%'
   or email ilike '%fake%'
   or email ilike '%demo%'
   or email ilike '@example.com%';

-- 8. Verificar quantos registros ainda existem
select
  'profiles' as tabela,
  count(*) as registros
from public.profiles
union all
select 'evaluations', count(*) from public.evaluations
union all
select 'pdi', count(*) from public.pdi
union all
select 'pdi_actions', count(*) from public.pdi_actions
union all
select 'answers', count(*) from public.answers
union all
select 'questions', count(*) from public.questions
union all
select 'cycles', count(*) from public.cycles;

commit;

-- =====================================================================
-- Após executar este script:
-- 1. Verifique os registros restantes acima
-- 2. Admin pode recadastrar colaboradores reais
-- 3. Crie ciclos de avaliação reais
-- =====================================================================
