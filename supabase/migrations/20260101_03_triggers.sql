-- ========================================================================
-- Migration 03 — Triggers (touch updated_at, status, audit, novo usuario)
-- ========================================================================

-- Touch updated_at
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger t_profiles_upd     before update on public.profiles    for each row execute function public.tg_touch_updated_at();
create trigger t_eval_upd         before update on public.evaluations for each row execute function public.tg_touch_updated_at();
create trigger t_answers_upd      before update on public.answers     for each row execute function public.tg_touch_updated_at();
create trigger t_pdi_upd          before update on public.pdi         for each row execute function public.tg_touch_updated_at();
create trigger t_pdi_actions_upd  before update on public.pdi_actions for each row execute function public.tg_touch_updated_at();

-- Avaliacao em_andamento ao gravar primeira resposta
create or replace function public.update_eval_status()
returns trigger language plpgsql as $$
begin
  update public.evaluations
     set status = 'em_andamento', updated_at = now()
   where id = new.evaluation_id and status = 'nao_iniciado';
  return new;
end;
$$;

create trigger t_answer_status
after insert on public.answers
for each row execute function public.update_eval_status();

-- Cria profile automaticamente ao registrar usuario no auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          new.email,
          'colaborador')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists t_on_auth_user_created on auth.users;
create trigger t_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Audit log para escrita em evaluations
create or replace function public.tg_audit_eval()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log(actor_id, action, table_name, record_id, payload)
  values (auth.uid(), TG_OP, TG_TABLE_NAME,
          coalesce(new.id, old.id),
          jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old)));
  return coalesce(new, old);
end;
$$;

create trigger t_audit_eval
after insert or update or delete on public.evaluations
for each row execute function public.tg_audit_eval();

-- Audit log para profiles (apenas mudanca de role e status)
create or replace function public.tg_audit_profile_role()
returns trigger language plpgsql security definer as $$
begin
  if new.role <> old.role or new.status <> old.status or new.manager_id is distinct from old.manager_id then
    insert into public.audit_log(actor_id, action, table_name, record_id, payload)
    values (auth.uid(), 'PROFILE_CHANGE', 'profiles', new.id,
            jsonb_build_object(
              'old_role', old.role, 'new_role', new.role,
              'old_status', old.status, 'new_status', new.status,
              'old_manager', old.manager_id, 'new_manager', new.manager_id
            ));
  end if;
  return new;
end;
$$;

create trigger t_audit_profile_role
after update on public.profiles
for each row execute function public.tg_audit_profile_role();
