-- ========================================================================
-- Migration 05 — Access & Lifecycle
-- ------------------------------------------------------------------------
-- Decisoes:
--   1. Senha padrao Dfs@2026 + must_change_password = true (forca troca)
--   2. Transferencia de gestor migra avaliacoes em aberto + history
--   3. Reabertura: apenas admin com motivo (>=30 chars) em audit_log
--   4. PDI: gestor cria, colaborador da ciencia, status muda so com gestor
-- ========================================================================

-- ========== 1) PROFILES: must_change_password ==========
alter table public.profiles
  add column if not exists must_change_password boolean not null default true,
  add column if not exists last_password_change timestamptz;

-- Quando a senha e trocada via Supabase Auth, o trigger no auth.users
-- atualiza o flag para false. Configuracao via edge function tambem suportada.

-- ========== 2) ASSIGNMENT HISTORY ==========
create table if not exists public.assignment_history (
  id            uuid primary key default uuid_generate_v4(),
  employee_id   uuid not null references public.profiles(id) on delete cascade,
  manager_id    uuid references public.profiles(id) on delete set null,
  valid_from    timestamptz not null default now(),
  valid_to      timestamptz,
  changed_by    uuid references public.profiles(id) on delete set null,
  reason        text
);
create index if not exists idx_ah_employee on public.assignment_history(employee_id);
create index if not exists idx_ah_manager  on public.assignment_history(manager_id);
create index if not exists idx_ah_period   on public.assignment_history(valid_from, valid_to);

alter table public.assignment_history enable row level security;
create policy "ah_read_admin_or_self"
on public.assignment_history for select using (
  public.is_admin()
  or employee_id = auth.uid()
  or manager_id  = auth.uid()
);

-- ========== 3) PDI: ciencia do colaborador ==========
alter table public.pdi
  add column if not exists acknowledged_at      timestamptz,
  add column if not exists acknowledgment_note  text;

-- Reescreve as policies de pdi_actions para permitir colaborador alterar
-- somente progress_note. Dropamos a policy antiga (de migration 01) e
-- criamos as novas.
drop policy if exists "pdi_actions_admin_write" on public.pdi_actions;

-- Gestor/admin: tudo
create policy "pdi_actions_manager_write"
on public.pdi_actions for all using (
  public.is_admin()
  or exists (
    select 1 from public.pdi p
    where p.id = pdi_actions.pdi_id and p.manager_id = auth.uid()
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.pdi p
    where p.id = pdi_actions.pdi_id and p.manager_id = auth.uid()
  )
);

-- Colaborador: pode dar UPDATE apenas em progress_note (validado por trigger)
create policy "pdi_actions_employee_progress"
on public.pdi_actions for update using (
  exists (
    select 1 from public.pdi p
    where p.id = pdi_actions.pdi_id and p.employee_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.pdi p
    where p.id = pdi_actions.pdi_id and p.employee_id = auth.uid()
  )
);

-- Trigger que bloqueia colaborador de alterar campos diferentes de progress_note
create or replace function public.tg_pdi_actions_employee_guard()
returns trigger language plpgsql as $$
declare
  v_role user_role;
  v_is_employee boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'admin' then return new; end if;

  select (p.manager_id = auth.uid()) into v_is_employee
    from public.pdi p where p.id = new.pdi_id;
  if v_is_employee then return new; end if;  -- gestor pode tudo

  -- Eh colaborador: so pode mudar progress_note
  if new.competency      is distinct from old.competency
     or new.objective    is distinct from old.objective
     or new.action       is distinct from old.action
     or new.deadline     is distinct from old.deadline
     or new.responsible_id is distinct from old.responsible_id
     or new.status       is distinct from old.status then
    raise exception 'Colaborador so pode atualizar progress_note';
  end if;
  return new;
end;
$$;

drop trigger if exists t_pdi_actions_employee_guard on public.pdi_actions;
create trigger t_pdi_actions_employee_guard
before update on public.pdi_actions
for each row execute function public.tg_pdi_actions_employee_guard();

-- ========== 4) RPC: TRANSFER EMPLOYEE MANAGER ==========
create or replace function public.transfer_employee_manager(
  p_employee_id  uuid,
  p_new_manager  uuid,
  p_reason       text default null,
  p_migrate_open boolean default true
) returns void
language plpgsql
security definer
as $$
declare
  v_old_manager uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode transferir gestor';
  end if;

  select manager_id into v_old_manager from public.profiles where id = p_employee_id;
  if v_old_manager is not distinct from p_new_manager then
    raise exception 'Novo gestor e igual ao atual';
  end if;

  -- Fecha assignment atual
  update public.assignment_history
     set valid_to = now()
   where employee_id = p_employee_id and valid_to is null;

  -- Abre novo
  insert into public.assignment_history(employee_id, manager_id, changed_by, reason)
  values (p_employee_id, p_new_manager, auth.uid(), p_reason);

  -- Atualiza profile
  update public.profiles set manager_id = p_new_manager where id = p_employee_id;

  -- Migra avaliacoes em aberto (manager + consensus)
  if p_migrate_open then
    update public.evaluations
       set evaluator_id = p_new_manager
     where evaluee_id = p_employee_id
       and type in ('manager','consensus')
       and status <> 'finalizado';
  end if;

  -- Audit
  insert into public.audit_log(actor_id, action, table_name, record_id, payload)
  values (auth.uid(), 'TRANSFER_MANAGER', 'profiles', p_employee_id,
          jsonb_build_object(
            'old_manager', v_old_manager,
            'new_manager', p_new_manager,
            'reason', p_reason,
            'migrated_open', p_migrate_open
          ));
end;
$$;

-- ========== 5) RPC: REOPEN EVALUATION ==========
create or replace function public.reopen_evaluation(
  p_evaluation_id uuid,
  p_reason        text
) returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode reabrir avaliacao';
  end if;
  if p_reason is null or length(trim(p_reason)) < 30 then
    raise exception 'Motivo obrigatorio (minimo 30 caracteres)';
  end if;

  update public.evaluations
     set status = 'em_andamento',
         submitted_at = null,
         updated_at = now()
   where id = p_evaluation_id and status = 'finalizado';

  if not found then
    raise exception 'Avaliacao nao esta finalizada ou nao existe';
  end if;

  insert into public.audit_log(actor_id, action, table_name, record_id, payload)
  values (auth.uid(), 'REOPEN_EVALUATION', 'evaluations', p_evaluation_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ========== 6) RPC: DEACTIVATE USER ==========
create or replace function public.deactivate_user(
  p_user_id uuid,
  p_reason  text default null
) returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode inativar usuario';
  end if;

  update public.profiles set status = 'inativo' where id = p_user_id;

  -- Cancela avaliacoes em aberto
  update public.evaluations
     set status = 'enviado'
   where evaluee_id = p_user_id and status in ('nao_iniciado','em_andamento');

  insert into public.audit_log(actor_id, action, table_name, record_id, payload)
  values (auth.uid(), 'DEACTIVATE_USER', 'profiles', p_user_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ========== 7) RPC: ACKNOWLEDGE PDI ==========
create or replace function public.acknowledge_pdi(
  p_pdi_id uuid,
  p_note   text default null
) returns void
language plpgsql
security definer
as $$
declare
  v_employee uuid;
begin
  select employee_id into v_employee from public.pdi where id = p_pdi_id;
  if v_employee is null or v_employee <> auth.uid() then
    raise exception 'Apenas o proprio colaborador pode dar ciencia';
  end if;

  update public.pdi
     set acknowledged_at = now(),
         acknowledgment_note = p_note,
         updated_at = now()
   where id = p_pdi_id;
end;
$$;

-- ========== 8) RPC: UPDATE PDI ACTION PROGRESS NOTE (colaborador) ==========
create or replace function public.update_pdi_progress_note(
  p_action_id uuid,
  p_note      text
) returns void
language plpgsql
security definer
as $$
declare
  v_pdi_id uuid;
  v_owner  uuid;
begin
  select pa.pdi_id, p.employee_id
    into v_pdi_id, v_owner
    from public.pdi_actions pa
    join public.pdi p on p.id = pa.pdi_id
   where pa.id = p_action_id;

  if v_owner is null then raise exception 'Acao nao encontrada'; end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Apenas o colaborador dono do PDI pode atualizar';
  end if;

  update public.pdi_actions
     set progress_note = p_note,
         updated_at = now()
   where id = p_action_id;
end;
$$;

-- ========== 9) PASSWORD CHANGE TRACKING ==========
-- Quando o usuario muda a senha (via Supabase Auth), atualizamos o flag.
-- Trigger no auth.users para detectar mudanca de encrypted_password.
create or replace function public.tg_track_password_change()
returns trigger language plpgsql security definer as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
       set must_change_password = false,
           last_password_change = now(),
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists t_track_password_change on auth.users;
create trigger t_track_password_change
after update on auth.users
for each row execute function public.tg_track_password_change();

-- ========== 10) HELPER VIEW: PDI ATRASADO ==========
create or replace view public.v_pdi_overdue as
select pa.id, pa.pdi_id, pa.competency, pa.objective, pa.action,
       pa.deadline, pa.status,
       p.employee_id, p.manager_id, p.cycle_id,
       (current_date - pa.deadline) as days_overdue
  from public.pdi_actions pa
  join public.pdi p on p.id = pa.pdi_id
 where pa.status not in ('concluida','cancelada')
   and pa.deadline < current_date;

-- Marca acoes vencidas automaticamente como atrasadas
create or replace function public.mark_overdue_pdi_actions()
returns void language sql security definer as $$
  update public.pdi_actions
     set status = 'atrasada', updated_at = now()
   where status in ('planejada','em_andamento')
     and deadline < current_date;
$$;
