-- ========================================================================
-- DEMO DATA — DFS Avaliação de Desempenho
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor)
-- IMPORTANTE: Execute SOMENTE em ambiente de demonstração/homologação.
-- Requer que os 3 usuários de teste já existam em auth.users:
--   rh.teste2@dfsdigital.com.br  (admin)
--   gestor@dfsdigital.com.br     (gestor)
--   colaborador@dfsdigital.com.br (colaborador)
-- ========================================================================

-- ========== 1. DEPARTAMENTOS E CARGOS (upsert) ==========
insert into public.departments(name) values
  ('Diretoria'), ('RH'), ('Tecnologia'), ('Comercial'),
  ('Financeiro'), ('Operacoes'), ('Marketing')
on conflict(name) do nothing;

insert into public.positions(name) values
  ('Assistente'), ('Analista Jr'), ('Analista Pleno'), ('Analista Senior'),
  ('Coordenador'), ('Gerente'), ('Diretor')
on conflict(name) do nothing;

-- ========== 2. PERFIS DOS USUÁRIOS DE TESTE ==========

update public.profiles
   set full_name            = 'Ana Paula (RH Admin)',
       role                 = 'admin',
       status               = 'ativo',
       must_change_password = false,
       department_id        = (select id from public.departments where name = 'RH'),
       position_id          = (select id from public.positions    where name = 'Gerente'),
       admission_date       = '2022-01-10'
 where email = 'rh.teste2@dfsdigital.com.br';

update public.profiles
   set full_name            = 'Carlos Gestor',
       role                 = 'gestor',
       status               = 'ativo',
       must_change_password = false,
       department_id        = (select id from public.departments where name = 'Tecnologia'),
       position_id          = (select id from public.positions    where name = 'Coordenador'),
       admission_date       = '2021-03-15'
 where email = 'gestor@dfsdigital.com.br';

update public.profiles
   set full_name            = 'Julia Colaboradora',
       role                 = 'colaborador',
       status               = 'ativo',
       must_change_password = false,
       department_id        = (select id from public.departments where name = 'Tecnologia'),
       position_id          = (select id from public.positions    where name = 'Analista Pleno'),
       admission_date       = '2023-06-01',
       manager_id           = (select id from public.profiles where email = 'gestor@dfsdigital.com.br')
 where email = 'colaborador@dfsdigital.com.br';

-- ========== 3. COMPETENCY BLOCKS E PERGUNTAS ==========
insert into public.competency_blocks(name, kind, sort_order) values
  ('Competencias Globais',         'global',         1),
  ('Competencias Comportamentais', 'comportamental', 2),
  ('Competencias Tecnicas',        'tecnica',        3),
  ('Aderencia Cultural',           'cultural',       4)
on conflict do nothing;

do $$
declare
  bid_global uuid;
  bid_comp   uuid;
  bid_tec    uuid;
  bid_cult   uuid;
begin
  select id into bid_global from public.competency_blocks where kind = 'global'         limit 1;
  select id into bid_comp   from public.competency_blocks where kind = 'comportamental' limit 1;
  select id into bid_tec    from public.competency_blocks where kind = 'tecnica'        limit 1;
  select id into bid_cult   from public.competency_blocks where kind = 'cultural'       limit 1;

  if (select count(*) from public.questions where block_id = bid_global) = 0 then
    insert into public.questions(block_id, text, sort_order) values
      (bid_global, 'Demonstra comprometimento com objetivos da empresa e foco no cliente', 1),
      (bid_global, 'Atua com autonomia e responsabilidade na execucao das atividades', 2),
      (bid_global, 'Adapta-se a mudancas e novos desafios', 3),
      (bid_global, 'Resolve problemas e toma decisoes com visao de impacto no negocio', 4);
  end if;

  if (select count(*) from public.questions where block_id = bid_comp) = 0 then
    insert into public.questions(block_id, text, sort_order) values
      (bid_comp, 'Comunica-se de forma clara, objetiva e respeitosa', 1),
      (bid_comp, 'Trabalha de forma colaborativa, construindo parcerias', 2),
      (bid_comp, 'Demonstra proatividade e iniciativa diante de novas demandas', 3),
      (bid_comp, 'Recebe feedbacks de forma positiva e busca evolucao continua', 4),
      (bid_comp, 'Mantem postura profissional compativel com o ambiente corporativo', 5),
      (bid_comp, 'Atua com etica, respeito e aderencia as normas e valores da empresa', 6);
  end if;

  if (select count(*) from public.questions where block_id = bid_tec) = 0 then
    insert into public.questions(block_id, text, sort_order) values
      (bid_tec, 'Possui habilidades necessarias e dominio das ferramentas da area', 1),
      (bid_tec, 'Conhece e executa os processos com precisao e atencao aos detalhes', 2),
      (bid_tec, 'Entrega resultados com qualidade, dentro do prazo e com analise critica', 3),
      (bid_tec, 'Demonstra capacidade para lidar com volume e priorizacao de demandas', 4),
      (bid_tec, 'Aplica conhecimentos para inovacao e melhoria de resultados e processos', 5),
      (bid_tec, 'Busca atualizacao continua e desenvolvimento profissional constante', 6);
  end if;

  if bid_cult is not null and (select count(*) from public.questions where block_id = bid_cult) = 0 then
    insert into public.questions(block_id, text, sort_order) values
      (bid_cult, 'Incorpora os valores e a cultura da empresa no dia a dia', 1),
      (bid_cult, 'Promove um ambiente de trabalho positivo e inclusivo', 2),
      (bid_cult, 'Inspira e motiva colegas pelo exemplo e postura', 3);
  end if;
end $$;

insert into public.qualitative_questions(text, sort_order) values
 ('Quais sao os principais pontos fortes e quais competencias podem ser desenvolvidas?', 1),
 ('Quais foram as principais contribuicoes no periodo avaliado?', 2),
 ('Quais desafios ou dificuldades foram enfrentados e como foram conduzidos?', 3),
 ('Como voce avalia o desempenho geral no periodo, considerando resultados, comportamento e desenvolvimento?', 4),
 ('Quais acoes podem potencializar ainda mais a performance no proximo ciclo?', 5)
on conflict do nothing;

-- ========== 4. CICLOS EM TODOS OS STATUS ==========

insert into public.cycles(name, period_start, period_end, self_manager_start, self_manager_deadline,
  consolidation_start, consolidation_deadline, status, created_by)
values (
  'Avaliacao de Desempenho 2024.1', '2024-01-01', '2024-06-30',
  '2024-07-01', '2024-07-31', '2024-08-01', '2024-08-15',
  'encerrado',
  (select id from public.profiles where email = 'rh.teste2@dfsdigital.com.br')
) on conflict(period_start, period_end) do nothing;

insert into public.cycles(name, period_start, period_end, self_manager_start, self_manager_deadline,
  consolidation_start, consolidation_deadline, status, created_by)
values (
  'Avaliacao de Desempenho 2024.2', '2024-07-01', '2024-12-31',
  '2025-01-02', '2025-01-31', '2025-02-01', '2025-02-15',
  'encerrado',
  (select id from public.profiles where email = 'rh.teste2@dfsdigital.com.br')
) on conflict(period_start, period_end) do nothing;

insert into public.cycles(name, period_start, period_end, self_manager_start, self_manager_deadline,
  consolidation_start, consolidation_deadline, status, created_by)
values (
  'Avaliacao de Desempenho 2025.1', '2025-01-01', '2025-06-30',
  '2025-07-01', '2025-07-31', '2025-08-01', '2025-08-20',
  'aberto_consolidacao',
  (select id from public.profiles where email = 'rh.teste2@dfsdigital.com.br')
) on conflict(period_start, period_end) do nothing;

insert into public.cycles(name, period_start, period_end, self_manager_start, self_manager_deadline,
  consolidation_start, consolidation_deadline, status, created_by)
values (
  'Avaliacao de Desempenho 2025.2', '2025-07-01', '2025-12-31',
  '2026-01-05', '2026-02-05', null, null,
  'aberto_auto_gestor',
  (select id from public.profiles where email = 'rh.teste2@dfsdigital.com.br')
) on conflict(period_start, period_end) do nothing;

insert into public.cycles(name, period_start, period_end, self_manager_start, self_manager_deadline,
  status, created_by)
values (
  'Avaliacao de Desempenho 2026.1', '2026-01-01', '2026-06-30',
  '2026-07-01', '2026-07-31',
  'planejado',
  (select id from public.profiles where email = 'rh.teste2@dfsdigital.com.br')
) on conflict(period_start, period_end) do nothing;

-- ========== 5. AVALIAÇÕES DEMO ==========
do $$
declare
  v_gestor_id     uuid;
  v_colab_id      uuid;
  v_cycle_enc1    uuid;
  v_cycle_enc2    uuid;
  v_cycle_cons    uuid;
  v_cycle_open    uuid;
  v_eval_id       uuid;
  q               record;
  v_score         smallint;
begin
  select id into v_gestor_id from public.profiles where email = 'gestor@dfsdigital.com.br';
  select id into v_colab_id  from public.profiles where email = 'colaborador@dfsdigital.com.br';
  select id into v_cycle_enc1 from public.cycles where period_start = '2024-01-01';
  select id into v_cycle_enc2 from public.cycles where period_start = '2024-07-01';
  select id into v_cycle_cons from public.cycles where period_start = '2025-01-01';
  select id into v_cycle_open from public.cycles where period_start = '2025-07-01';

  -- Garante que os IDs foram encontrados antes de continuar
  if v_gestor_id is null or v_colab_id is null then
    raise notice 'AVISO: Usuarios de teste nao encontrados. Verifique os emails na tabela profiles.';
    return;
  end if;

  -- ---- CICLO 2024.1: tudo finalizado ----
  -- Self colaborador
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_enc1 and evaluee_id = v_colab_id and type = 'self') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_enc1, v_colab_id, v_colab_id, 'self', 'finalizado', '2024-07-20 10:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := (3 + (q.sort_order % 2))::smallint;
      insert into public.answers(evaluation_id, question_id, score) values (v_eval_id, q.id, v_score) on conflict do nothing;
    end loop;
  end if;

  -- Manager eval
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_enc1 and evaluee_id = v_colab_id and type = 'manager') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_enc1, v_colab_id, v_gestor_id, 'manager', 'finalizado', '2024-07-22 14:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := greatest(1, least(4, (2 + (q.sort_order % 3))::smallint));
      insert into public.answers(evaluation_id, question_id, score) values (v_eval_id, q.id, v_score) on conflict do nothing;
    end loop;
  end if;

  -- Consenso finalizado
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_enc1 and evaluee_id = v_colab_id and type = 'consensus') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_enc1, v_colab_id, v_gestor_id, 'consensus', 'finalizado', '2024-08-05 09:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := greatest(1, least(4, (3 + (q.sort_order % 2))::smallint));
      insert into public.answers(evaluation_id, question_id, score) values (v_eval_id, q.id, v_score) on conflict do nothing;
    end loop;
  end if;

  -- PDI do ciclo 2024.1
  if not exists(select 1 from public.pdi where cycle_id = v_cycle_enc1 and employee_id = v_colab_id) then
    insert into public.pdi(cycle_id, employee_id, manager_id, acknowledged_at, created_at)
    values (v_cycle_enc1, v_colab_id, v_gestor_id, '2024-08-10 11:00:00', '2024-08-05 09:30:00');
  end if;

  -- ---- CICLO 2024.2: self e manager finalizados ----
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_enc2 and evaluee_id = v_colab_id and type = 'self') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_enc2, v_colab_id, v_colab_id, 'self', 'finalizado', '2025-01-15 10:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := greatest(1, least(4, (2 + (q.sort_order % 3))::smallint));
      insert into public.answers(evaluation_id, question_id, score) values (v_eval_id, q.id, v_score) on conflict do nothing;
    end loop;
  end if;

  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_enc2 and evaluee_id = v_colab_id and type = 'manager') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_enc2, v_colab_id, v_gestor_id, 'manager', 'finalizado', '2025-01-18 15:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := greatest(1, least(4, (2 + (q.sort_order % 3))::smallint));
      insert into public.answers(evaluation_id, question_id, score) values (v_eval_id, q.id, v_score) on conflict do nothing;
    end loop;
  end if;

  -- ---- CICLO 2025.1: consolidacao — self+manager finalizados, consenso em andamento ----
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_cons and evaluee_id = v_colab_id and type = 'self') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_cons, v_colab_id, v_colab_id, 'self', 'finalizado', '2025-07-20 08:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := greatest(1, least(4, (3 + (q.sort_order % 2))::smallint));
      insert into public.answers(evaluation_id, question_id, score, comment)
      values (v_eval_id, q.id, v_score,
        case when q.sort_order = 1 then 'Evolui muito no atendimento ao cliente este semestre.'
             when q.sort_order = 3 then 'Busco sempre aprender novas tecnologias para me adaptar.'
             else null end)
      on conflict do nothing;
    end loop;
  end if;

  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_cons and evaluee_id = v_colab_id and type = 'manager') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status, submitted_at)
    values (v_cycle_cons, v_colab_id, v_gestor_id, 'manager', 'finalizado', '2025-07-25 10:00:00')
    returning id into v_eval_id;
    for q in select id, sort_order from public.questions order by sort_order loop
      v_score := greatest(1, least(4, (2 + (q.sort_order % 3))::smallint));
      insert into public.answers(evaluation_id, question_id, score) values (v_eval_id, q.id, v_score) on conflict do nothing;
    end loop;
  end if;

  -- Consenso em andamento (etapa atual do ciclo 2025.1)
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_cons and evaluee_id = v_colab_id and type = 'consensus') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
    values (v_cycle_cons, v_colab_id, v_gestor_id, 'consensus', 'em_andamento');
  end if;

  -- ---- CICLO 2025.2: aberto — avaliações em andamento ----
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_open and evaluee_id = v_colab_id and type = 'self') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
    values (v_cycle_open, v_colab_id, v_colab_id, 'self', 'em_andamento');
  end if;

  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_open and evaluee_id = v_colab_id and type = 'manager') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
    values (v_cycle_open, v_colab_id, v_gestor_id, 'manager', 'nao_iniciado');
  end if;

  -- Self do próprio gestor no ciclo 2025.2
  if not exists(select 1 from public.evaluations where cycle_id = v_cycle_open and evaluee_id = v_gestor_id and type = 'self') then
    insert into public.evaluations(cycle_id, evaluee_id, evaluator_id, type, status)
    values (v_cycle_open, v_gestor_id, v_gestor_id, 'self', 'nao_iniciado');
  end if;

end $$;

-- ========== 6. PDI ATIVO (2025.1) — 3 ações em variados status ==========
do $$
declare
  v_gestor_id  uuid;
  v_colab_id   uuid;
  v_cycle_cons uuid;
  v_pdi_id     uuid;
  v_q1         uuid;
  v_q2         uuid;
  v_q3         uuid;
  v_pp1        uuid;
  v_pp2        uuid;
  v_pp3        uuid;
  v_cons_id    uuid;
begin
  select id into v_gestor_id  from public.profiles where email = 'gestor@dfsdigital.com.br';
  select id into v_colab_id   from public.profiles where email = 'colaborador@dfsdigital.com.br';
  select id into v_cycle_cons from public.cycles    where period_start = '2025-01-01';

  -- Cria o PDI se não existir
  if not exists(select 1 from public.pdi where cycle_id = v_cycle_cons and employee_id = v_colab_id) then
    insert into public.pdi(cycle_id, employee_id, manager_id, created_at)
    values (v_cycle_cons, v_colab_id, v_gestor_id, now())
    returning id into v_pdi_id;
  else
    select id into v_pdi_id from public.pdi where cycle_id = v_cycle_cons and employee_id = v_colab_id;
    update public.pdi set manager_id = v_gestor_id where id = v_pdi_id;
  end if;

  -- Só insere pdi_points se a tabela existir (migration 06)
  if exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'pdi_points') then

    -- Seleciona 3 questões
    select id into v_q1 from public.questions order by sort_order limit 1 offset 0;
    select id into v_q2 from public.questions order by sort_order limit 1 offset 1;
    select id into v_q3 from public.questions order by sort_order limit 1 offset 2;

    insert into public.pdi_points(pdi_id, question_id, consensus_score, position, source)
    values (v_pdi_id, v_q1, 2, 1, 'auto_suggested')
    on conflict(pdi_id, question_id) do nothing;

    insert into public.pdi_points(pdi_id, question_id, consensus_score, position, source)
    values (v_pdi_id, v_q2, 2, 2, 'auto_suggested')
    on conflict(pdi_id, question_id) do nothing;

    insert into public.pdi_points(pdi_id, question_id, consensus_score, position, source)
    values (v_pdi_id, v_q3, 3, 3, 'auto_suggested')
    on conflict(pdi_id, question_id) do nothing;

    select id into v_pp1 from public.pdi_points where pdi_id = v_pdi_id and question_id = v_q1;
    select id into v_pp2 from public.pdi_points where pdi_id = v_pdi_id and question_id = v_q2;
    select id into v_pp3 from public.pdi_points where pdi_id = v_pdi_id and question_id = v_q3;

    -- Ações com status variados (pdi_actions com pdi_point_id)
    if not exists(select 1 from public.pdi_actions where pdi_id = v_pdi_id and pdi_point_id = v_pp1) then
      insert into public.pdi_actions(pdi_id, pdi_point_id, competency, objective, action, deadline, responsible_id, status, progress_note)
      values (
        v_pdi_id, v_pp1,
        (select text from public.questions where id = v_q1),
        'Desenvolver habilidade de comunicacao clara e assertiva',
        'Participar de workshop de comunicacao executiva e aplicar tecnicas em reunioes semanais',
        '2025-10-31', v_colab_id, 'em_andamento',
        'Ja concluí o módulo 1 do workshop. Aplicando os conceitos nas daily meetings.'
      );
    end if;

    if not exists(select 1 from public.pdi_actions where pdi_id = v_pdi_id and pdi_point_id = v_pp2) then
      insert into public.pdi_actions(pdi_id, pdi_point_id, competency, objective, action, deadline, responsible_id, status)
      values (
        v_pdi_id, v_pp2,
        (select text from public.questions where id = v_q2),
        'Aprimorar entrega de resultados com qualidade',
        'Implementar checklist de qualidade antes de cada entrega e realizar code review',
        '2025-09-30', v_colab_id, 'nao_iniciada'
      );
    end if;

    if not exists(select 1 from public.pdi_actions where pdi_id = v_pdi_id and pdi_point_id = v_pp3) then
      insert into public.pdi_actions(pdi_id, pdi_point_id, competency, objective, action, deadline, responsible_id, status)
      values (
        v_pdi_id, v_pp3,
        (select text from public.questions where id = v_q3),
        'Buscar atualizacao tecnica em tecnologias de cloud',
        'Concluir certificacao AWS Cloud Practitioner',
        '2025-11-30', v_colab_id, 'nao_iniciada'
      );
    end if;

  else
    -- migration 06 não aplicada: insere ações sem pdi_point_id
    if not exists(select 1 from public.pdi_actions where pdi_id = v_pdi_id) then
      insert into public.pdi_actions(pdi_id, competency, objective, action, deadline, responsible_id, status, progress_note)
      values
        (v_pdi_id, 'Comunicacao', 'Desenvolver habilidade de comunicacao clara e assertiva',
         'Participar de workshop de comunicacao executiva', '2025-10-31', v_colab_id, 'em_andamento',
         'Ja concluí o módulo 1 do workshop.'),
        (v_pdi_id, 'Qualidade de Entrega', 'Aprimorar entrega de resultados com qualidade',
         'Implementar checklist de qualidade e realizar code review', '2025-09-30', v_colab_id, 'planejada', null),
        (v_pdi_id, 'Desenvolvimento Tecnico', 'Buscar atualizacao tecnica em cloud',
         'Concluir certificacao AWS Cloud Practitioner', '2025-11-30', v_colab_id, 'planejada', null);
    end if;
  end if;

end $$;

-- ========== 7. AUDITORIA DE EXEMPLO ==========
insert into public.audit_log(actor_id, action, table_name, record_id, payload, created_at)
select
  (select id from public.profiles where email = 'rh.teste2@dfsdigital.com.br'),
  'CYCLE_OPENED',
  'cycles',
  id,
  jsonb_build_object('name', name, 'status', status::text),
  now() - interval '30 days'
from public.cycles
where status in ('aberto_auto_gestor', 'aberto_consolidacao');

-- ========== RESULTADO ==========
select 'Ciclos criados' as entidade, count(*)::text as total from public.cycles
union all
select 'Colaboradores ativos', count(*)::text from public.profiles where status = 'ativo'
union all
select 'Avaliacoes', count(*)::text from public.evaluations
union all
select 'PDIs', count(*)::text from public.pdi
union all
select 'Acoes de PDI', count(*)::text from public.pdi_actions
union all
select 'Perguntas de avaliacao', count(*)::text from public.questions;
