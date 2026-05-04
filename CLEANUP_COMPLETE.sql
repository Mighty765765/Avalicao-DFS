-- ========================================================================
-- LIMPEZA COMPLETA DO BANCO — Manter apenas Admin ativo
-- ========================================================================
-- Executa via: Supabase Dashboard → SQL Editor
-- ATENÇÃO: Esta operação é DESTRUTIVA e irreversível. Fazer backup antes.
-- ========================================================================

BEGIN;

-- ==================== PASSO 1: Deletar dados de PDI ====================
-- Deletar PDI de usuários não-admin (cascata automática para pdi_actions, pdi_points, etc)
DELETE FROM public.pdi
WHERE employee_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- ==================== PASSO 2: Deletar dados de Avaliações ====================
-- Deletar avaliações onde avaliado OU avaliador NÃO é admin (cascata automática para answers)
DELETE FROM public.evaluations
WHERE evaluee_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
)
OR evaluator_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- ==================== PASSO 3: Deletar Ciclos (cascata automática) ====================
-- Todos os ciclos sem avaliações (as avaliações foram deletadas acima)
DELETE FROM public.cycles
WHERE id NOT IN (
  SELECT DISTINCT cycle_id FROM public.evaluations
);

-- ==================== PASSO 4: Deletar dados de Feedback ====================
DELETE FROM public.feedback_meetings
WHERE evaluee_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
)
OR manager_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- ==================== PASSO 5: Deletar histórico de atribuição ====================
DELETE FROM public.assignment_history
WHERE employee_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
)
OR manager_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- ==================== PASSO 6: Limpar auditoria ====================
DELETE FROM public.audit_log
WHERE actor_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- ==================== PASSO 7: Deletar Profiles não-admin ====================
-- Primeiro, remover referências de manager_id que apontam para não-admin
UPDATE public.profiles
SET manager_id = NULL
WHERE manager_id IS NOT NULL
  AND manager_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  );

-- Deletar todos os profiles que NÃO são admin OU não estão ativos
DELETE FROM public.profiles
WHERE role != 'admin' OR status != 'ativo';

COMMIT;

-- ==================== VERIFICAÇÃO ====================
-- Execute estas queries para confirmar a limpeza:

SELECT 'Profiles (deve mostrar apenas admin)' as check_item, COUNT(*) as count FROM public.profiles;
SELECT 'Evaluations (deve ser 0)' as check_item, COUNT(*) as count FROM public.evaluations;
SELECT 'Answers (deve ser 0)' as check_item, COUNT(*) as count FROM public.answers;
SELECT 'PDI (deve ser 0)' as check_item, COUNT(*) as count FROM public.pdi;
SELECT 'PDI Actions (deve ser 0)' as check_item, COUNT(*) as count FROM public.pdi_actions;
SELECT 'Cycles (pode haver 0 ou mais)' as check_item, COUNT(*) as count FROM public.cycles;
SELECT 'Departments (dados mestres)' as check_item, COUNT(*) as count FROM public.departments;
SELECT 'Positions (dados mestres)' as check_item, COUNT(*) as count FROM public.positions;
SELECT 'Competency Blocks (dados mestres)' as check_item, COUNT(*) as count FROM public.competency_blocks;
SELECT 'Questions (dados mestres)' as check_item, COUNT(*) as count FROM public.questions;

-- Detalhe dos admins restantes:
SELECT 'Admins Ativos' as label, id, full_name, email, role, status FROM public.profiles WHERE role = 'admin';
