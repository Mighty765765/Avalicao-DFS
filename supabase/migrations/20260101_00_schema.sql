-- ========================================================================
-- DFS AVALIACAO DE DESEMPENHO 180 — SCHEMA COMPLETO
-- Migration 00 — Schema base (tabelas, enums, indices)
-- Ordem de execucao: 00 -> 01 -> 02 -> 03 -> 04 -> 05
-- ========================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------- ENUMS -----------
create type user_role          as enum ('colaborador','gestor','admin');
create type user_status        as enum ('ativo','inativo');
create type cycle_status       as enum ('planejado','aberto_auto_gestor','aberto_consolidacao','encerrado');
create type evaluation_type    as enum ('self','manager','consensus');
create type evaluation_status  as enum ('nao_iniciado','em_andamento','finalizado','enviado');
create type pdi_action_status  as enum ('planejada','em_andamento','concluida','atrasada','cancelada');
create type competency_kind    as enum ('global','comportamental','tecnica','cultural');

-- ----------- DEPARTAMENTOS / CARGOS -----------
create table public.departments (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null unique,
  created_at    timestamptz default now()
);

create table public.positions (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null unique,
  created_at    timestamptz default now()
);

-- ----------- PROFILES -----------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  email          text not null unique,
  role           user_role not null default 'colaborador',
  status         user_status not null default 'ativo',
  department_id  uuid references public.departments(id) on delete set null,
  position_id    uuid references public.positions(id)   on delete set null,
  manager_id     uuid references public.profiles(id)    on delete set null,
  admission_date date,
  phone          text,
  avatar_url     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index idx_profiles_manager on public.profiles(manager_id);
create index idx_profiles_dept    on public.profiles(department_id);
create index idx_profiles_role    on public.profiles(role);

-- ----------- COMPETENCIAS / PERGUNTAS -----------
create table public.competency_blocks (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  kind       competency_kind not null,
  sort_order int not null default 0
);

create table public.questions (
  id         uuid primary key default uuid_generate_v4(),
  block_id   uuid not null references public.competency_blocks(id) on delete cascade,
  text       text not null,
  sort_order int not null default 0,
  active     boolean not null default true
);
create index idx_questions_block on public.questions(block_id);

create table public.qualitative_questions (
  id         uuid primary key default uuid_generate_v4(),
  text       text not null,
  sort_order int not null default 0,
  active     boolean not null default true
);

-- ----------- CICLOS -----------
create table public.cycles (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  period_start            date not null,
  period_end              date not null,
  self_manager_start      date not null,
  self_manager_deadline   date not null,
  consolidation_start     date,
  consolidation_deadline  date,
  status                  cycle_status not null default 'planejado',
  created_by              uuid references public.profiles(id),
  created_at              timestamptz default now(),
  unique (period_start, period_end)
);

-- ----------- AVALIACOES -----------
create table public.evaluations (
  id             uuid primary key default uuid_generate_v4(),
  cycle_id       uuid not null references public.cycles(id)   on delete cascade,
  evaluee_id     uuid not null references public.profiles(id) on delete cascade,
  evaluator_id   uuid references public.profiles(id)          on delete set null,
  type           evaluation_type    not null,
  status         evaluation_status  not null default 'nao_iniciado',
  submitted_at   timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (cycle_id, evaluee_id, type, evaluator_id)
);
create index idx_eval_cycle    on public.evaluations(cycle_id);
create index idx_eval_evaluee  on public.evaluations(evaluee_id);
create index idx_eval_evaluator on public.evaluations(evaluator_id);

-- ----------- RESPOSTAS -----------
create table public.answers (
  id             uuid primary key default uuid_generate_v4(),
  evaluation_id  uuid not null references public.evaluations(id) on delete cascade,
  question_id    uuid not null references public.questions(id)   on delete cascade,
  score          smallint not null check (score between 1 and 4),
  comment        text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (evaluation_id, question_id)
);
create index idx_answers_eval on public.answers(evaluation_id);

create table public.qualitative_answers (
  id                      uuid primary key default uuid_generate_v4(),
  evaluation_id           uuid not null references public.evaluations(id) on delete cascade,
  qualitative_question_id uuid not null references public.qualitative_questions(id) on delete cascade,
  text                    text,
  updated_at              timestamptz default now(),
  unique (evaluation_id, qualitative_question_id)
);

-- ----------- REUNIAO DE FEEDBACK -----------
create table public.feedback_meetings (
  id              uuid primary key default uuid_generate_v4(),
  cycle_id        uuid not null references public.cycles(id)   on delete cascade,
  evaluee_id      uuid not null references public.profiles(id) on delete cascade,
  manager_id      uuid not null references public.profiles(id) on delete cascade,
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  points_strong   text,
  points_improve  text,
  alignment_note  text,
  listening_note  text,
  divergence_note text,
  created_at      timestamptz default now(),
  unique (cycle_id, evaluee_id)
);

-- ----------- PDI -----------
create table public.pdi (
  id           uuid primary key default uuid_generate_v4(),
  cycle_id     uuid not null references public.cycles(id)   on delete cascade,
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  manager_id   uuid references public.profiles(id)          on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (cycle_id, employee_id)
);

create table public.pdi_actions (
  id             uuid primary key default uuid_generate_v4(),
  pdi_id         uuid not null references public.pdi(id) on delete cascade,
  competency     text not null,
  objective      text not null,
  action         text not null,
  deadline       date not null,
  responsible_id uuid references public.profiles(id) on delete set null,
  status         pdi_action_status not null default 'planejada',
  progress_note  text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index idx_pdi_actions_pdi      on public.pdi_actions(pdi_id);
create index idx_pdi_actions_deadline on public.pdi_actions(deadline);

-- ----------- AUDITORIA -----------
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid,
  action      text not null,
  table_name  text not null,
  record_id   uuid,
  payload     jsonb,
  created_at  timestamptz default now()
);
create index idx_audit_actor on public.audit_log(actor_id);
create index idx_audit_action on public.audit_log(action);
create index idx_audit_created on public.audit_log(created_at desc);
