-- =============================================================================
-- 20260507_08_restore_rls.sql
-- HOTFIX: a migration anterior fez DROP FUNCTION ... CASCADE em is_admin() e
-- is_manager(), o que removeu TODAS as RLS policies que dependiam delas.
-- Sem policies, com RLS habilitado, todas as queries retornam 0 linhas
-- (incluindo o select do próprio profile no login → erro PGRST116/406).
-- Este script recria todas as policies do source.
-- =============================================================================

begin;

-- Garante helpers atualizados (recriação idempotente)
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

create or replace function public.is_manager_of(target_user uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_user and p.manager_id = auth.uid()
  );
$$;

-- ============== PROFILES ==============
drop policy if exists "profiles_select_self_team_admin" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

create policy "profiles_select_self_team_admin"
on public.profiles for select using (
  id = auth.uid()
  or manager_id = auth.uid()
  or public.is_admin()
);

create policy "profiles_update_self"
on public.profiles for update using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_admin_all"
on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- ============== CATALOGOS ==============
drop policy if exists "departments_read"   on public.departments;
drop policy if exists "departments_admin"  on public.departments;
drop policy if exists "positions_read"     on public.positions;
drop policy if exists "positions_admin"    on public.positions;
drop policy if exists "blocks_read"        on public.competency_blocks;
drop policy if exists "blocks_admin"       on public.competency_blocks;
drop policy if exists "questions_read"     on public.questions;
drop policy if exists "questions_admin"    on public.questions;
drop policy if exists "qual_questions_read"  on public.qualitative_questions;
drop policy if exists "qual_questions_admin" on public.qualitative_questions;

create policy "departments_read"   on public.departments       for select using (auth.role() = 'authenticated');
create policy "positions_read"     on public.positions         for select using (auth.role() = 'authenticated');
create policy "blocks_read"        on public.competency_blocks for select using (auth.role() = 'authenticated');
create policy "questions_read"     on public.questions         for select using (auth.role() = 'authenticated');
create policy "qual_questions_read" on public.qualitative_questions for select using (auth.role() = 'authenticated');

create policy "departments_admin"   on public.departments       for all using (public.is_admin()) with check (public.is_admin());
create policy "positions_admin"     on public.positions         for all using (public.is_admin()) with check (public.is_admin());
create policy "blocks_admin"        on public.competency_blocks for all using (public.is_admin()) with check (public.is_admin());
create policy "questions_admin"     on public.questions         for all using (public.is_admin()) with check (public.is_admin());
create policy "qual_questions_admin" on public.qualitative_questions for all using (public.is_admin()) with check (public.is_admin());

-- ============== CYCLES ==============
drop policy if exists "cycles_read"  on public.cycles;
drop policy if exists "cycles_admin" on public.cycles;
create policy "cycles_read"  on public.cycles for select using (auth.role() = 'authenticated');
create policy "cycles_admin" on public.cycles for all using (public.is_admin()) with check (public.is_admin());

-- ============== EVALUATIONS ==============
drop policy if exists "eval_select"       on public.evaluations;
drop policy if exists "eval_admin_insert" on public.evaluations;
drop policy if exists "eval_update_own"   on public.evaluations;

create policy "eval_select"
on public.evaluations for select using (
  public.is_admin()
  or evaluator_id = auth.uid()
  or (evaluee_id  = auth.uid() and type in ('self','consensus'))
  or (
    type = 'self'
    and status = 'finalizado'
    and exists (select 1 from public.profiles p where p.id = evaluations.evaluee_id and p.manager_id = auth.uid())
  )
);

create policy "eval_admin_insert" on public.evaluations for insert with check (public.is_admin());

create policy "eval_update_own"
on public.evaluations for update using (
  (evaluator_id = auth.uid() and status <> 'finalizado')
  or public.is_admin()
) with check (
  (evaluator_id = auth.uid() and status <> 'finalizado')
  or public.is_admin()
);

-- ============== ANSWERS ==============
drop policy if exists "answers_access"  on public.answers;
drop policy if exists "qanswers_access" on public.qualitative_answers;

create policy "answers_access"
on public.answers for all using (
  public.is_admin()
  or exists (
    select 1 from public.evaluations e
    where e.id = answers.evaluation_id
      and (e.evaluator_id = auth.uid() or (e.evaluee_id = auth.uid() and e.type = 'self'))
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.evaluations e
    where e.id = answers.evaluation_id
      and e.evaluator_id = auth.uid()
      and e.status <> 'finalizado'
  )
);

create policy "qanswers_access"
on public.qualitative_answers for all using (
  public.is_admin()
  or exists (
    select 1 from public.evaluations e
    where e.id = qualitative_answers.evaluation_id
      and (e.evaluator_id = auth.uid() or (e.evaluee_id = auth.uid() and e.type = 'self'))
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.evaluations e
    where e.id = qualitative_answers.evaluation_id
      and e.evaluator_id = auth.uid()
      and e.status <> 'finalizado'
  )
);

-- ============== FEEDBACK MEETINGS ==============
drop policy if exists "fb_meetings_access" on public.feedback_meetings;
create policy "fb_meetings_access"
on public.feedback_meetings for all using (
  public.is_admin()
  or manager_id = auth.uid()
  or evaluee_id = auth.uid()
) with check (
  public.is_admin()
  or manager_id = auth.uid()
);

-- ============== PDI ==============
drop policy if exists "pdi_access" on public.pdi;
drop policy if exists "pdi_write"  on public.pdi;

create policy "pdi_access"
on public.pdi for select using (
  public.is_admin()
  or employee_id = auth.uid()
  or manager_id  = auth.uid()
);

create policy "pdi_write"
on public.pdi for all using (
  public.is_admin()
  or manager_id  = auth.uid()
) with check (
  public.is_admin()
  or manager_id  = auth.uid()
);

-- ============== PDI ACTIONS ==============
drop policy if exists "pdi_actions_read"        on public.pdi_actions;
drop policy if exists "pdi_actions_admin_write" on public.pdi_actions;

create policy "pdi_actions_read"
on public.pdi_actions for select using (
  public.is_admin()
  or exists (
    select 1 from public.pdi p
    where p.id = pdi_actions.pdi_id
      and (p.employee_id = auth.uid() or p.manager_id = auth.uid())
  )
);

create policy "pdi_actions_admin_write"
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

-- ============== AUDIT ==============
drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_admin_read" on public.audit_log for select using (public.is_admin());

commit;

-- =============================================================================
-- Após rodar este script, NÃO é preciso reiniciar a aplicação. Basta
-- recarregar (F5) o navegador para refazer as queries com as policies ativas.
--
-- Se você tinha policies CUSTOMIZADAS (criadas fora deste repositório, ex.:
-- pelo Supabase Studio) que também referenciavam is_admin(), elas também
-- foram dropadas pelo CASCADE e precisam ser recriadas manualmente.
-- =============================================================================
