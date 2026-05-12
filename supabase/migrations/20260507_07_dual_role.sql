-- =============================================================================
-- 20260507_07_dual_role.sql
-- Permite que um usuário acumule papel de Colaborador + Gestor através da
-- coluna is_manager. O enum user_role passa a ter apenas dois valores
-- semanticamente distintos: 'admin' (RH) e 'colaborador'. Quem hoje é 'gestor'
-- vira colaborador com is_manager = true.
--
-- IMPORTANTE: views/rules que referenciam profiles.role (incluindo as criadas
-- fora do controle deste repositório, ex.: pelo Supabase Studio) precisam ser
-- droppadas antes do ALTER TYPE e recriadas depois. Esta migration faz isso
-- dinamicamente e em seguida recria as views canônicas do source.
-- =============================================================================

begin;

-- 1) Coluna is_manager (idempotente)
alter table public.profiles
  add column if not exists is_manager boolean not null default false;

-- 2) Backfill (idempotente)
update public.profiles set is_manager = true
 where role::text = 'gestor' and is_manager = false;

update public.profiles p
   set is_manager = true
 where exists (select 1 from public.profiles s where s.manager_id = p.id)
   and p.is_manager = false;

-- 3) Drop dinâmico de TODAS as views que dependem de profiles.role.
--    Isso cobre views criadas fora do source (ex.: view_pending_by_manager).
do $$
declare
  v_rec record;
begin
  for v_rec in
    select distinct n.nspname as schema_name, c.relname as view_name
      from pg_depend d
      join pg_rewrite r        on r.oid = d.objid
      join pg_class c          on c.oid = r.ev_class
      join pg_namespace n      on n.oid = c.relnamespace
      join pg_attribute a      on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
      join pg_class tc         on tc.oid = d.refobjid
      join pg_namespace tn     on tn.oid = tc.relnamespace
     where tn.nspname = 'public'
       and tc.relname = 'profiles'
       and a.attname = 'role'
       and c.relkind in ('v','m')
  loop
    execute format('drop view if exists %I.%I cascade', v_rec.schema_name, v_rec.view_name);
    raise notice 'Dropped dependent view: %.%', v_rec.schema_name, v_rec.view_name;
  end loop;
end $$;

-- 4) Renomeia o tipo enum antigo e cria o novo
do $$
begin
  if exists (select 1 from pg_type where typname = 'user_role')
     and not exists (select 1 from pg_type where typname = 'user_role_old') then
    alter type public.user_role rename to user_role_old;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('colaborador','admin');
  end if;
end $$;

-- 5) Migra a coluna profiles.role para o novo tipo
alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type public.user_role using (
    case role::text
      when 'gestor' then 'colaborador'
      else role::text
    end
  )::public.user_role;

alter table public.profiles
  alter column role set default 'colaborador';

-- 6) Drop helper que retorna o tipo enum (precisa cair para recriarmos com a
--    nova assinatura). NÃO usar CASCADE em is_admin/is_manager: eles retornam
--    boolean e podem ser substituídos via CREATE OR REPLACE no passo 8 sem
--    derrubar as policies que dependem deles.
drop function if exists public.current_user_role() cascade;

-- 7) Remove o tipo antigo (se ainda existir e não tiver dependentes)
do $$
begin
  if exists (select 1 from pg_type where typname = 'user_role_old') then
    drop type public.user_role_old;
  end if;
end $$;

-- 8) Recria helpers de RLS
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select is_manager or role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 9) Recria views canônicas que referenciam profiles.
--    Usamos DROP + CREATE (em vez de CREATE OR REPLACE) porque a forma da
--    coluna pode ter divergido entre o source e o que está no DB ao vivo.
drop view if exists public.v_pending_by_manager cascade;
drop view if exists public.v_pending_by_department cascade;
drop view if exists public.v_pdi_overdue cascade;
drop view if exists public.v_pdi_actions_pending cascade;
drop view if exists public.v_pdi_actions_late cascade;
drop view if exists public.v_consensus_side_by_side cascade;

create view public.v_pending_by_manager as
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

create view public.v_pending_by_department as
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

create view public.v_pdi_overdue as
select pa.id, pa.pdi_id, pa.competency, pa.objective, pa.action,
       pa.deadline, pa.status,
       p.employee_id, p.manager_id, p.cycle_id,
       (current_date - pa.deadline) as days_overdue
  from public.pdi_actions pa
  join public.pdi p on p.id = pa.pdi_id
 where pa.status not in ('concluida','cancelada')
   and pa.deadline < current_date;

create view public.v_pdi_actions_pending as
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

create view public.v_pdi_actions_late as
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

create view public.v_consensus_side_by_side as
select
  cons.id           as consensus_eval_id,
  cons.evaluee_id   as employee_id,
  cons.evaluator_id as manager_id,
  cons.cycle_id,
  q.id              as question_id,
  q.text            as question_text,
  q.block_id,
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

-- 10) Trigger de PDI: reescrita sem depender do enum 'gestor'
create or replace function public.tg_pdi_actions_employee_guard()
returns trigger language plpgsql as $$
declare
  v_is_admin boolean;
  v_is_owner boolean;
begin
  select role = 'admin' into v_is_admin from public.profiles where id = auth.uid();
  if v_is_admin then return new; end if;

  select (p.manager_id = auth.uid()) into v_is_owner
    from public.pdi p where p.id = new.pdi_id;
  if v_is_owner then return new; end if;

  if new.competency      is distinct from old.competency
     or new.objective    is distinct from old.objective
     or new.action       is distinct from old.action
     or new.deadline     is distinct from old.deadline
     or new.responsible_id is distinct from old.responsible_id
     or new.status       is distinct from old.status then
    raise exception 'Colaborador só pode atualizar progress_note';
  end if;
  return new;
end;
$$;

-- 11) Índice auxiliar para listagens "quem pode ser gestor"
create index if not exists idx_profiles_is_manager on public.profiles(is_manager) where is_manager = true;

commit;

-- =============================================================================
-- ATENÇÃO: Se você tinha views customizadas (criadas fora deste repositório,
-- ex.: pelo Supabase Studio) que referenciavam profiles.role, elas foram
-- DROPPADAS pelo bloco do passo 3 e NÃO foram recriadas. Verifique no Studio
-- se é preciso recriar alguma manualmente. As views canônicas do source já
-- foram restauradas nos passos 9.
-- =============================================================================
