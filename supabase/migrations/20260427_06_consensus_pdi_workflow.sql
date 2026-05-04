-- =====================================================================
-- 20260427_06_consensus_pdi_workflow.sql
-- DFS - Avaliacao de Desempenho 180o
-- Implementa: gestor cego, abertura automatica do consenso, 3 comentarios
-- por questao, pdi_points (1 por questao selecionada), 4 estados de acao,
-- finalizacao com data retroativa controlada, des-finalizacao justificada,
-- views de relatorio (pendencias e atrasos) filtraveis por ciclo.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Enum dos estados de acao do PDI
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'pdi_action_status') then
    create type public.pdi_action_status as enum (
      'nao_iniciada',
      'em_andamento',
      'concluida_colaborador',
      'finalizada'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tres comentarios por questao (self/manager/consensus)
--    Como answers ja tem evaluation_id (que carrega o tipo), basta
--    garantir uma coluna comment textual rica.
-- ---------------------------------------------------------------------
alter table public.answers
  add column if not exists comment text;

-- ---------------------------------------------------------------------
-- 3. Tabela pdi_points: 1 linha por questao selecionada no consenso
-- ---------------------------------------------------------------------
create table if not exists public.pdi_points (
  id uuid primary key default gen_random_uuid(),
  pdi_id uuid not null references public.pdi(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  consensus_score numeric(3,1),
  position smallint not null default 1,
  source text not null default 'auto_suggested'
    check (source in ('auto_suggested','manager_added')),
  created_at timestamptz not null default now(),
  unique (pdi_id, question_id)
);

create index if not exists idx_pdi_points_pdi on public.pdi_points(pdi_id);

-- ---------------------------------------------------------------------
-- 4. pdi_actions: vincular a um ponto + colunas de finalizacao
-- Nota: start_date e end_date sao adicionados se nao existirem
-- (podem vir do schema 00 como deadline, que sera descartado)
-- ---------------------------------------------------------------------
alter table public.pdi_actions
  add column if not exists pdi_point_id uuid references public.pdi_points(id) on delete cascade,
  add column if not exists status public.pdi_action_status not null default 'nao_iniciada',
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists completed_at_employee timestamptz,
  add column if not exists manager_finalized boolean not null default false,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references public.profiles(id),
  add column if not exists finalization_note text;

create index if not exists idx_pdi_actions_point on public.pdi_actions(pdi_point_id);
create index if not exists idx_pdi_actions_status on public.pdi_actions(status);

-- Popula start_date e end_date baseado em deadline se vazio
update public.pdi_actions
  set start_date = (current_date - 30),
      end_date = deadline
where start_date is null and deadline is not null;

-- ---------------------------------------------------------------------
-- 5. Historico de des-finalizacao (gestor reverteu uma acao finalizada)
-- ---------------------------------------------------------------------
create table if not exists public.pdi_action_unfinalize_history (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.pdi_actions(id) on delete cascade,
  reverted_by uuid not null references public.profiles(id),
  reverted_at timestamptz not null default now(),
  reason text not null check (length(reason) >= 10),
  prev_finalized_at timestamptz,
  prev_finalization_note text
);

-- ---------------------------------------------------------------------
-- 6. RLS: gestor nao ve answers do tipo self enquanto sua propria
--    avaliacao do colaborador nao estiver finalizada.
-- ---------------------------------------------------------------------
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

drop policy if exists "answers_select" on public.answers;
create policy "answers_select" on public.answers
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.evaluations e
       where e.id = answers.evaluation_id
         and (
           -- proprio dono
           e.employee_id = auth.uid()
              and e.type in ('self','consensus')
           -- gestor da avaliacao
           or e.evaluator_id = auth.uid()
           -- gestor olhando a self do seu liderado, mas SO depois de fechar a propria
           or (
             e.type = 'self'
             and public.is_manager_of(e.employee_id)
             and public.manager_can_see_self_eval(e.id)
           )
         )
    )
  );

-- ---------------------------------------------------------------------
-- 7. Trava de edicao apos submit (status='finalizado'): nao pode UPDATE
--    em answers nem qualitative_answers se a evaluation correspondente
--    estiver finalizada (excecao: admin via RPC).
-- ---------------------------------------------------------------------
create or replace function public.tg_block_edit_finalized_eval()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.evaluations where id = new.evaluation_id;
  if v_status = 'finalizado' and not public.is_admin() then
    raise exception 'Avaliacao finalizada. Edicao bloqueada.';
  end if;
  return new;
end;
$$;

drop trigger if exists tg_block_edit_answers on public.answers;
create trigger tg_block_edit_answers
  before update on public.answers
  for each row
  execute function public.tg_block_edit_finalized_eval();

drop trigger if exists tg_block_edit_qual_answers on public.qualitative_answers;
create trigger tg_block_edit_qual_answers
  before update on public.qualitative_answers
  for each row
  execute function public.tg_block_edit_finalized_eval();

-- ---------------------------------------------------------------------
-- 8. RPC: finalize_self_evaluation
-- ---------------------------------------------------------------------
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
  if v_eval.employee_id <> auth.uid() and not public.is_admin() then
    raise exception 'Sem permissao';
  end if;
  update public.evaluations
     set status = 'finalizado', submitted_at = now()
   where id = p_eval_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. RPC: finalize_manager_evaluation
--    Finaliza a manager_eval. Se a self ja estiver finalizada, abre o consenso.
-- ---------------------------------------------------------------------
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

  -- Busca status da self-evaluation usando evaluee_id
  v_eval := (select * from public.evaluations where id = p_eval_id);

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

-- ---------------------------------------------------------------------
-- 10. Sugestao automatica das 3 piores notas para PDI
-- ---------------------------------------------------------------------
create or replace function public.suggest_pdi_points(p_consensus_eval uuid)
returns table (question_id uuid, question_text text, score numeric)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.text, a.score
    from public.answers a
    join public.questions q on q.id = a.question_id
   where a.evaluation_id = p_consensus_eval
     and a.score is not null
   order by a.score asc, q.position asc
   limit 3;
$$;

-- ---------------------------------------------------------------------
-- 11. RPC: finalize_consensus
--    Recebe o consensus_eval_id, lista de question_ids selecionadas (>=3),
--    finaliza o consenso, cria o pdi e popula pdi_points.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 12. Trigger: garante que apos ack do PDI, gestor nao edita mais pontos
--     (so via reabertura/admin)
-- ---------------------------------------------------------------------
create or replace function public.tg_block_pdi_points_after_ack()
returns trigger
language plpgsql
as $$
declare v_ack timestamptz;
begin
  select acknowledged_at into v_ack
    from public.pdi
   where id = coalesce(new.pdi_id, old.pdi_id);
  if v_ack is not null and not public.is_admin() then
    raise exception 'PDI ja recebeu ciencia do colaborador. Edicao bloqueada.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists tg_pdi_points_ack_guard on public.pdi_points;
create trigger tg_pdi_points_ack_guard
  before insert or update or delete on public.pdi_points
  for each row execute function public.tg_block_pdi_points_after_ack();

-- Função auxiliar para converter status do schema 00 para migration 06
create or replace function public.convert_action_status(p_schema00_status text)
returns public.pdi_action_status
language sql
immutable
as $$
  select case p_schema00_status
    when 'planejada' then 'nao_iniciada'::public.pdi_action_status
    when 'em_andamento' then 'em_andamento'::public.pdi_action_status
    when 'concluida' then 'concluida_colaborador'::public.pdi_action_status
    when 'atrasada' then 'em_andamento'::public.pdi_action_status
    when 'cancelada' then 'nao_iniciada'::public.pdi_action_status
    when 'nao_iniciada' then 'nao_iniciada'::public.pdi_action_status
    when 'concluida_colaborador' then 'concluida_colaborador'::public.pdi_action_status
    when 'finalizada' then 'finalizada'::public.pdi_action_status
    else 'nao_iniciada'::public.pdi_action_status
  end;
$$;

-- RPC: update_action_status (compatível com schema 00 e migration 06)
create or replace function public.update_action_status(
  p_action_id uuid,
  p_status text,
  p_progress_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.pdi_actions%rowtype;
  v_pdi public.pdi%rowtype;
  v_converted_status public.pdi_action_status;
begin
  select * into v_action from public.pdi_actions where id = p_action_id;
  if not found then raise exception 'Acao nao encontrada'; end if;
  select * into v_pdi from public.pdi where id = v_action.pdi_id;

  if v_pdi.employee_id <> auth.uid() and not public.is_admin() then
    raise exception 'Apenas o colaborador pode atualizar o andamento';
  end if;

  -- Converte status schema 00 para migration 06 se necessário
  v_converted_status := public.convert_action_status(p_status);

  if v_converted_status = 'finalizada' then
    raise exception 'Use finalize_action para finalizar';
  end if;
  if v_action.status = 'finalizada' then
    raise exception 'Acao ja finalizada. Solicite des-finalizacao ao gestor.';
  end if;

  update public.pdi_actions
     set status = v_converted_status,
         progress_note = coalesce(p_progress_note, progress_note),
         completed_at_employee = case when v_converted_status = 'concluida_colaborador'
                                      then now() else completed_at_employee end,
         updated_at = now()
   where id = p_action_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 14. RPC: finalize_action (gestor)
--     Aceita data retroativa: completion_date >= start_date AND <= now()
-- ---------------------------------------------------------------------
create or replace function public.finalize_action(
  p_action_id uuid,
  p_completion_date timestamptz default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.pdi_actions%rowtype;
  v_pdi public.pdi%rowtype;
  v_date timestamptz;
begin
  select * into v_action from public.pdi_actions where id = p_action_id;
  if not found then raise exception 'Acao nao encontrada'; end if;
  select * into v_pdi from public.pdi where id = v_action.pdi_id;

  if v_pdi.manager_id <> auth.uid() and not public.is_admin() then
    raise exception 'Apenas o gestor responsavel pode finalizar';
  end if;
  if v_action.status = 'finalizada' then
    raise exception 'Acao ja finalizada';
  end if;

  v_date := coalesce(p_completion_date, now());
  if v_date > now() then
    raise exception 'Data de finalizacao nao pode ser futura';
  end if;
  if v_action.start_date is not null and v_date::date < v_action.start_date then
    raise exception 'Data de finalizacao nao pode ser anterior ao inicio da acao (% )', v_action.start_date;
  end if;

  update public.pdi_actions
     set status = 'finalizada',
         manager_finalized = true,
         finalized_at = v_date,
         finalized_by = auth.uid(),
         finalization_note = p_note,
         updated_at = now()
   where id = p_action_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 15. RPC: unfinalize_action (gestor reverte com justificativa)
-- ---------------------------------------------------------------------
create or replace function public.unfinalize_action(
  p_action_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.pdi_actions%rowtype;
  v_pdi public.pdi%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'Justifique a des-finalizacao com pelo menos 10 caracteres';
  end if;

  select * into v_action from public.pdi_actions where id = p_action_id;
  if not found then raise exception 'Acao nao encontrada'; end if;
  select * into v_pdi from public.pdi where id = v_action.pdi_id;

  if v_pdi.manager_id <> auth.uid() and not public.is_admin() then
    raise exception 'Apenas o gestor responsavel pode des-finalizar';
  end if;
  if v_action.status <> 'finalizada' then
    raise exception 'Acao nao esta finalizada';
  end if;

  insert into public.pdi_action_unfinalize_history
    (action_id, reverted_by, reason, prev_finalized_at, prev_finalization_note)
  values
    (p_action_id, auth.uid(), p_reason, v_action.finalized_at, v_action.finalization_note);

  update public.pdi_actions
     set status = case when v_action.completed_at_employee is not null
                       then 'concluida_colaborador'
                       else 'em_andamento' end,
         manager_finalized = false,
         finalized_at = null,
         finalized_by = null,
         finalization_note = null,
         updated_at = now()
   where id = p_action_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 16. View: acoes pendentes (filtravel por ciclo)
-- Usa LEFT JOIN para compatibilidade com schema 00 sem pdi_points
-- ---------------------------------------------------------------------
create or replace view public.v_pdi_actions_pending as
select
  a.id            as action_id,
  a.competency,
  a.action,
  a.deadline,
  a.start_date,
  a.end_date,
  a.status,
  a.progress_note,
  a.completed_at_employee,
  pp.id           as point_id,
  pp.question_id,
  q.text          as question_text,
  p.id            as pdi_id,
  p.cycle_id,
  c.name          as cycle_name,
  emp.id          as employee_id,
  emp.full_name   as employee_name,
  emp.email       as employee_email,
  mgr.id          as manager_id,
  mgr.full_name   as manager_name,
  case
    when a.status = 'finalizada' then 0
    else greatest(0, (current_date - coalesce(a.end_date, a.deadline))::int)
  end as days_late
from public.pdi_actions a
left join public.pdi_points pp on pp.id = a.pdi_point_id
left join public.questions q    on q.id = pp.question_id
join public.pdi p          on p.id = a.pdi_id
join public.cycles c       on c.id = p.cycle_id
join public.profiles emp   on emp.id = p.employee_id
join public.profiles mgr   on mgr.id = p.manager_id
where a.status <> 'finalizada';

-- ---------------------------------------------------------------------
-- 17. View: acoes finalizadas com atraso
-- Usa LEFT JOIN para compatibilidade com schema 00 sem pdi_points
-- ---------------------------------------------------------------------
create or replace view public.v_pdi_actions_late as
select
  a.id              as action_id,
  a.competency,
  a.action,
  a.deadline,
  a.start_date,
  a.end_date,
  a.finalized_at::date as finalized_on,
  (a.finalized_at::date - coalesce(a.end_date, a.deadline))::int as days_late,
  pp.question_id,
  q.text            as question_text,
  p.cycle_id,
  c.name            as cycle_name,
  emp.full_name     as employee_name,
  mgr.full_name     as manager_name
from public.pdi_actions a
left join public.pdi_points pp on pp.id = a.pdi_point_id
left join public.questions q    on q.id = pp.question_id
join public.pdi p          on p.id = a.pdi_id
join public.cycles c       on c.id = p.cycle_id
join public.profiles emp   on emp.id = p.employee_id
join public.profiles mgr   on mgr.id = p.manager_id
where a.status = 'finalizada'
  and a.finalized_at::date > coalesce(a.end_date, a.deadline);

-- ---------------------------------------------------------------------
-- 18. View: visao do consenso lado a lado (consumida pelo frontend)
-- ---------------------------------------------------------------------
create or replace view public.v_consensus_side_by_side as
select
  cons.id           as consensus_eval_id,
  cons.evaluee_id   as employee_id,
  cons.evaluator_id as manager_id,
  cons.cycle_id,
  q.id              as question_id,
  q.text            as question_text,
  q.competency_block_id,
  q.position,
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

-- ---------------------------------------------------------------------
-- 19. RLS para pdi_points e historico
-- ---------------------------------------------------------------------
alter table public.pdi_points enable row level security;
alter table public.pdi_action_unfinalize_history enable row level security;

drop policy if exists "pdi_points_select" on public.pdi_points;
create policy "pdi_points_select" on public.pdi_points
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.pdi p
       where p.id = pdi_points.pdi_id
         and (p.employee_id = auth.uid() or p.manager_id = auth.uid())
    )
  );

drop policy if exists "pdi_points_write" on public.pdi_points;
create policy "pdi_points_write" on public.pdi_points
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.pdi p
       where p.id = pdi_points.pdi_id and p.manager_id = auth.uid()
    )
  ) with check (
    public.is_admin()
    or exists (
      select 1 from public.pdi p
       where p.id = pdi_points.pdi_id and p.manager_id = auth.uid()
    )
  );

drop policy if exists "unfin_history_select" on public.pdi_action_unfinalize_history;
create policy "unfin_history_select" on public.pdi_action_unfinalize_history
  for select using (
    public.is_admin()
    or exists (
      select 1
        from public.pdi_actions a
        join public.pdi p on p.id = a.pdi_id
       where a.id = pdi_action_unfinalize_history.action_id
         and (p.employee_id = auth.uid() or p.manager_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 20. Grants
-- ---------------------------------------------------------------------
grant select on public.v_pdi_actions_pending  to authenticated;
grant select on public.v_pdi_actions_late     to authenticated;
grant select on public.v_consensus_side_by_side to authenticated;
grant execute on function public.finalize_self_evaluation(uuid) to authenticated;
grant execute on function public.finalize_manager_evaluation(uuid) to authenticated;
grant execute on function public.finalize_consensus(uuid, uuid[]) to authenticated;
grant execute on function public.suggest_pdi_points(uuid) to authenticated;
grant execute on function public.convert_action_status(text) to authenticated;
grant execute on function public.update_action_status(uuid, text, text) to authenticated;
grant execute on function public.finalize_action(uuid, timestamptz, text) to authenticated;
grant execute on function public.unfinalize_action(uuid, text) to authenticated;

commit;
