-- ========================================================================
-- Migration 01 — RLS (Row Level Security)
-- ========================================================================
alter table public.profiles              enable row level security;
alter table public.departments           enable row level security;
alter table public.positions             enable row level security;
alter table public.competency_blocks     enable row level security;
alter table public.questions             enable row level security;
alter table public.qualitative_questions enable row level security;
alter table public.cycles                enable row level security;
alter table public.evaluations           enable row level security;
alter table public.answers               enable row level security;
alter table public.qualitative_answers   enable row level security;
alter table public.feedback_meetings     enable row level security;
alter table public.pdi                   enable row level security;
alter table public.pdi_actions           enable row level security;
alter table public.audit_log             enable row level security;

-- ============== HELPER FUNCTIONS ==============
create or replace function public.current_user_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.is_manager_of(target_user uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_user and p.manager_id = auth.uid()
  );
$$;

-- ============== PROFILES ==============
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
create policy "cycles_read"  on public.cycles for select using (auth.role() = 'authenticated');
create policy "cycles_admin" on public.cycles for all using (public.is_admin()) with check (public.is_admin());

-- ============== EVALUATIONS ==============
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

-- pdi_actions: leitura para colaborador, gestor e admin
create policy "pdi_actions_read"
on public.pdi_actions for select using (
  public.is_admin()
  or exists (
    select 1 from public.pdi p
    where p.id = pdi_actions.pdi_id
      and (p.employee_id = auth.uid() or p.manager_id = auth.uid())
  )
);

-- pdi_actions: insert/delete e mudanca de status apenas pelo gestor/admin
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
create policy "audit_admin_read" on public.audit_log for select using (public.is_admin());
