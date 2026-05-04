-- ========================================================================
-- Migration 04 — Seeds (departamentos, cargos, competencias e perguntas)
-- ========================================================================
insert into public.departments(name) values
  ('Diretoria'), ('RH'), ('Tecnologia'), ('Comercial'),
  ('Financeiro'), ('Operacoes'), ('Marketing')
on conflict do nothing;

insert into public.positions(name) values
  ('Assistente'), ('Analista Jr'), ('Analista Pleno'), ('Analista Senior'),
  ('Coordenador'), ('Gerente'), ('Diretor')
on conflict do nothing;

insert into public.competency_blocks(name, kind, sort_order) values
  ('Competencias Globais',         'global',         1),
  ('Competencias Comportamentais', 'comportamental', 2),
  ('Competencias Tecnicas',        'tecnica',        3),
  ('Aderencia Cultural',           'cultural',       4)
on conflict do nothing;

-- Perguntas conforme procedimento DFS
with b as (select id, kind from public.competency_blocks)
insert into public.questions(block_id, text, sort_order)
select (select id from b where kind='global'), q, row_number() over ()
from unnest(array[
  'Demonstra comprometimento com objetivos da empresa e foco no cliente',
  'Atua com autonomia e responsabilidade na execucao das atividades',
  'Adapta-se a mudancas e novos desafios',
  'Resolve problemas e toma decisoes com visao de impacto no negocio'
]) as q
union all
select (select id from b where kind='comportamental'), q, row_number() over ()
from unnest(array[
  'Comunica-se de forma clara, objetiva e respeitosa',
  'Trabalha de forma colaborativa, construindo parcerias com diferentes publicos',
  'Demonstra proatividade e iniciativa diante de novas demandas',
  'Recebe feedbacks de forma positiva e busca evolucao continua',
  'Mantem postura profissional compativel com o ambiente corporativo',
  'Atua com etica, respeito e aderencia as normas e valores da empresa'
]) as q
union all
select (select id from b where kind='tecnica'), q, row_number() over ()
from unnest(array[
  'Possui as habilidades necessarias e dominio das ferramentas e sistemas da area',
  'Conhece e executa os processos com precisao e atencao aos detalhes',
  'Entrega resultados com qualidade, dentro do prazo e com analise critica',
  'Demonstra capacidade para lidar com volume e priorizacao de demandas',
  'Aplica conhecimentos para inovacao e melhoria de resultados e processos',
  'Busca atualizacao continua e desenvolvimento profissional constante'
]) as q;

insert into public.qualitative_questions(text, sort_order) values
 ('Quais sao os principais pontos fortes e quais competencias podem ser desenvolvidas?', 1),
 ('Quais foram as principais contribuicoes no periodo avaliado?',                        2),
 ('Quais desafios ou dificuldades foram enfrentados e como foram conduzidos?',           3),
 ('Como voce avalia o desempenho geral no periodo, considerando resultados, comportamento e desenvolvimento?', 4),
 ('Quais acoes podem potencializar ainda mais a performance no proximo ciclo?',          5)
on conflict do nothing;
