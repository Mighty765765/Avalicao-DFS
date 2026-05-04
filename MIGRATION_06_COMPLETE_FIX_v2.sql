-- =====================================================================
-- MIGRATION_06_COMPLETE_FIX_v2.sql
-- Solução única para TODOS os erros da Migration 06
-- Versão 2: Remove colunas que não existem em questions (position, competency_block_id)
-- =====================================================================
-- Erros corrigidos:
-- 1. RLS policy "answers_select" dependencia bloqueava drop de function
-- 2. manager_can_see_self_eval usava employee_id (não existe em evaluations)
-- 3. finalize_manager_evaluation usava employee_id em evaluations
-- 4. finalize_consensus usava employee_id em evaluations
-- 5. v_consensus_side_by_side referenciava colunas inexistentes (competency_block_id, position)
-- 6. RLS answers_select usava e.employee_id quando deveria ser e.evaluee_id
-- =====================================================================

begin;

-- =====================================================================
-- PASSO 1: Droppar policies RLS que dependem das funções a serem alteradas
-- =====================================================================
drop policy if exists "answers_select" on public.answers;

-- =====================================================================
-- PASSO 2: Recriar função manager_can_see_self_eval com evaluee_id CORRETO
-- =====================================================================
drop function if exists public.manager_can_see_self_eval(uuid);

create or replace function public.manager_can_see_self_eval(p_self_eval uuid)
returns boolean
language sql
stable
as $$
  with se as (
    select cycle_id, evaluee_id from public.evaluations where id = p_self_eval and type = 'self'
  )
  select exists (
    select 1
      from public.evaluations m
      join se on se.cycle_id = m.cycle_id and se.evaluee_id = m.evaluee_id
     where m.type = 'manager'
       and m.evaluator_id = auth.uid()
       and m.status = 'finalizado'
  );
$$;

-- =====================================================================
-- PASSO 3: Recriar função finalize_self_evaluation com evaluee_id CORRETO
-- =====================================================================
drop function if exists public.finalize_self_evaluation(uuid);

create or replace function public.finalize_self_evaluation(p_eval_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_eval public.evaluations%rowtype;
begin
  select * into v_eval from public.evaluations where id = p_eval_id;
  if not found then raise exception 'Avaliacao nao encontrada'; end if;
  if v_eval.type <> 'self' then raise exception 'Tipo invalido'; end if;
  if v_eval.evaluee_id <> auth.uid() and not public.is_admin() then
    raise exception 'Sem permissao';
  end if;
  update public.evaluations
     set status = 'finalizado', submitted_at = now()
   where id = p_eval_id;
end;
$$;

-- =====================================================================
-- PASSO 4: Recriar função finalize_manager_evaluation com evaluee_id CORRETO
-- =====================================================================
drop function if exists public.finalize_manager_evaluation(uuid);

create or replace function public.finalize_manager_evaluation(p_eval_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.evaluations%rowtype;
  v_self_status text;
  v_consensus_id uuid;
begin
  select * into v_eval from public.evaluations where id = p_eval_id;
  if not found then raise exception 'Avaliacao nao encontrada'; end if;
  if v_eval.type <> 'manager' then raise exception 'Tipo invalido'; end if;
  if v_eval.evaluator_id <> auth.uid() and not public.is_admin() then
    raise exception 'Apenas o gestor avaliador pode finalizar';
  end if;

  update public.evaluations
     set status = 'finalizado', submitted_at = now()
   where id = p_eval_id;

  select status into v_self_status
    from public.evaluations
   where cycle_id = v_eval.cycle_id
     and evaluee_id = v_eval.evaluee_id
     and type = 'self';

  if v_self_status = 'finalizado' then
    insert into public.evaluations (cycle_id, evaluee_id, evaluator_id, type, status)
    values (v_eval.cycle_id, v_eval.evaluee_id, v_eval.evaluator_id, 'consensus', 'em_andamento')
    on conflict (cycle_id, evaluee_id, type) do update
      set evaluator_id = excluded.evaluator_id,
          status = case when public.evaluations.status = 'finalizado'
                        then public.evaluations.status
                        else 'em_andamento' end
    returning id into v_consensus_id;
  end if;
end;
$$;

-- =====================================================================
-- PASSO 5: Recriar função finalize_consensus com evaluee_id CORRETO
-- =====================================================================
drop function if exists public.finalize_consensus(uuid, uuid[]);

create or replace function public.finalize_consensus(
  p_eval_id uuid,
  p_selected_questions uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.evaluations%rowtype;
  v_pdi_id uuid;
  v_q uuid;
  v_pos smallint := 1;
begin
  if array_length(p_selected_questions, 1) is null
     or array_length(p_selected_questions, 1) < 3 then
    raise exception 'Selecione no minimo 3 questoes para gerar o PDI';
  end if;

  select * into v_eval from public.evaluations where id = p_eval_id;
  if v_eval.type <> 'consensus' then raise exception 'Tipo invalido'; end if;
  if v_eval.evaluator_id <> auth.uid() and not public.is_admin() then
    raise exception 'Apenas o gestor pode fechar o consenso';
  end if;

  update public.evaluations
     set status = 'finalizado', submitted_at = now()
   where id = p_eval_id;

  insert into public.pdi (employee_id, cycle_id, manager_id, created_at)
  values (v_eval.evaluee_id, v_eval.cycle_id, v_eval.evaluator_id, now())
  on conflict (employee_id, cycle_id) do update set updated_at = now()
  returning id into v_pdi_id;

  delete from public.pdi_points where pdi_id = v_pdi_id;

  foreach v_q in array p_selected_questions loop
    insert into public.pdi_points (pdi_id, question_id, position, consensus_score, source)
    values (
      v_pdi_id,
      v_q,
      v_pos,
      (select score from public.answers
        where evaluation_id = p_eval_id and question_id = v_q),
      'manager_added'
    );
    v_pos := v_pos + 1;
  end loop;

  return v_pdi_id;
end;
$$;

-- =====================================================================
-- PASSO 6: Recriar view v_consensus_side_by_side
-- SIMPLIFICADA: apenas colunas que DEFINITIVAMENTE existem
-- Remove: competency_block_id, position (que não existem)
-- =====================================================================
drop view if exists public.v_consensus_side_by_side;

create or replace view public.v_consensus_side_by_side as
select
  cons.id           as consensus_eval_id,
  cons.evaluee_id   as employee_id,
  cons.evaluator_id as manager_id,
  cons.cycle_id,
  q.id              as question_id,
  q.text            as question_text,
  q.sort_order      as position,
  self_a.score      as self_score,
  self_a.comment    as self_comment,
  mgr_a.score       as manager_score,
  mgr_a.comment     as manager_comment,
  cons_a.score      as consensus_score,
  cons_a.comment    as consensus_comment
from public.evaluations cons
join public.questions q on true
left join public.evaluations self_e
  on self_e.cycle_id = cons.cycle_id
 and self_e.evaluee_id = cons.evaluee_id
 and self_e.type = 'self'
left join public.evaluations mgr_e
  on mgr_e.cycle_id = cons.cycle_id
 and mgr_e.evaluee_id = cons.evaluee_id
 and mgr_e.type = 'manager'
left join public.answers self_a
  on self_a.evaluation_id = self_e.id and self_a.question_id = q.id
left join public.answers mgr_a
  on mgr_a.evaluation_id = mgr_e.id and mgr_a.question_id = q.id
left join public.answers cons_a
  on cons_a.evaluation_id = cons.id and cons_a.question_id = q.id
where cons.type = 'consensus';

-- =====================================================================
-- PASSO 7: Recriar RLS policy answers_select com evaluee_id CORRETO
-- =====================================================================
create policy "answers_select" on public.answers
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.evaluations e
       where e.id = answers.evaluation_id
         and (
           -- proprio dono (using evaluee_id, not employee_id!)
           e.evaluee_id = auth.uid()
              and e.type in ('self','consensus')
           -- gestor da avaliacao
           or e.evaluator_id = auth.uid()
           -- gestor olhando a self do seu liderado, mas SO depois de fechar a propria
           or (
             e.type = 'self'
             and public.is_manager_of(e.evaluee_id)
             and public.manager_can_see_self_eval(e.id)
           )
         )
    )
  );

-- =====================================================================
-- PASSO 8: Recriar grants para as funções corrigidas
-- =====================================================================
grant execute on function public.manager_can_see_self_eval(uuid) to authenticated;
grant execute on function public.finalize_self_evaluation(uuid) to authenticated;
grant execute on function public.finalize_manager_evaluation(uuid) to authenticated;
grant execute on function public.finalize_consensus(uuid, uuid[]) to authenticated;
grant select on public.v_consensus_side_by_side to authenticated;

commit;
