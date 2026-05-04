-- ========================================================================
-- Migration 02 — Funcoes RPC e Views de relatorio
-- ========================================================================

-- Disparo de ciclo: cria self + manager + consensus para cada colaborador ativo
create or replace function public.dispatch_cycle(cycle uuid)
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  for r in (select id, manager_id from public.profiles where status = 'ativo') loop
    -- Self
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
    values (cycle, r.id, r.id, 'self', 'enviado')
    on conflict do nothing;

    -- Manager
    if r.manager_id is not null then
      insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
      values (cycle, r.id, r.manager_id, 'manager', 'enviado')
      on conflict do nothing;
    end if;

    -- Consensus (criada com manager como evaluator)
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
    values (cycle, r.id, r.manager_id, 'consensus', 'nao_iniciado')
    on conflict do nothing;
  end loop;

  update public.cycles set status = 'aberto_auto_gestor' where id = cycle;
end;
$$;

-- ============== VIEWS DE RELATORIO ==============
create or replace view public.v_evaluation_scores as
select e.id as evaluation_id,
       e.cycle_id, e.evaluee_id, e.evaluator_id, e.type, e.status,
       cb.kind as block_kind,
       cb.name as block_name,
       round(avg(a.score)::numeric, 2) as avg_score,
       count(a.id) as answered
  from public.evaluations e
  join public.answers a            on a.evaluation_id = e.id
  join public.questions q          on q.id = a.question_id
  join public.competency_blocks cb on cb.id = q.block_id
 group by e.id, cb.kind, cb.name;

create or replace view public.v_gap_auto_manager as
select self.cycle_id, self.evaluee_id, self.question_id,
       self.score as self_score,
       mgr.score  as manager_score,
       (mgr.score - self.score) as gap
  from (
    select e.cycle_id, e.evaluee_id, a.question_id, a.score
      from public.evaluations e join public.answers a on a.evaluation_id = e.id
     where e.type = 'self' and e.status = 'finalizado'
  ) self
  join (
    select e.cycle_id, e.evaluee_id, a.question_id, a.score
      from public.evaluations e join public.answers a on a.evaluation_id = e.id
     where e.type = 'manager' and e.status = 'finalizado'
  ) mgr on mgr.cycle_id = self.cycle_id
        and mgr.evaluee_id = self.evaluee_id
        and mgr.question_id = self.question_id;

create or replace view public.v_ranking_consensus as
select e.cycle_id, e.evaluee_id,
       round(avg(a.score)::numeric, 2) as score_final,
       rank() over (partition by e.cycle_id order by avg(a.score) desc) as ranking
  from public.evaluations e
  join public.answers a on a.evaluation_id = e.id
 where e.type = 'consensus' and e.status = 'finalizado'
 group by e.cycle_id, e.evaluee_id;

create or replace view public.v_cycle_completion as
select c.id as cycle_id,
       count(*) filter (where e.status = 'finalizado') as concluidas,
       count(*) as total,
       round(100.0 * count(*) filter (where e.status = 'finalizado') / nullif(count(*),0), 2) as pct_concluido
  from public.cycles c
  join public.evaluations e on e.cycle_id = c.id
 group by c.id;

-- View de pendencias por gestor (uso no dashboard admin)
create or replace view public.v_pending_by_manager as
select e.cycle_id,
       p.manager_id,
       mgr.full_name as manager_name,
       count(*) filter (where e.status in ('nao_iniciado','em_andamento','enviado')) as pending,
       count(*) as total
  from public.evaluations e
  join public.profiles p   on p.id = e.evaluee_id
  left join public.profiles mgr on mgr.id = p.manager_id
 where e.type in ('self','manager')
 group by e.cycle_id, p.manager_id, mgr.full_name;

-- View de pendencias por area
create or replace view public.v_pending_by_department as
select e.cycle_id,
       d.id as department_id,
       d.name as department_name,
       count(*) filter (where e.status in ('nao_iniciado','em_andamento','enviado')) as pending,
       count(*) as total
  from public.evaluations e
  join public.profiles p     on p.id = e.evaluee_id
  left join public.departments d on d.id = p.department_id
 where e.type in ('self','manager')
 group by e.cycle_id, d.id, d.name;
