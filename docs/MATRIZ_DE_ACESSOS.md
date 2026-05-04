# DFS - Avaliação de Desempenho 180º
## Matriz de Acessos e Regras por Perfil

**Versão:** 1.0 — 2026-04-29
**Objetivo:** documento de referência para refatoração do frontend e auditoria das políticas de RLS. Define o que cada perfil pode ver, fazer e onde NÃO pode chegar.

---

## 1. Princípios fundamentais

Estas regras valem para qualquer tela, qualquer endpoint, qualquer relatório. Se algum comportamento atual contradiz alguma delas, **a regra prevalece e o código deve ser ajustado**.

1. **Hierarquia rígida de papéis:** `admin (RH)` > `gestor` > `colaborador`. Um usuário tem **um único papel por vez** (campo `profiles.role`). Mudança de papel só por admin via tela de Colaboradores.
2. **Gestor é cego durante a avaliação:** o gestor NUNCA vê a autoavaliação do liderado enquanto não tiver finalizado a própria avaliação. RLS bloqueia (`manager_can_see_self_eval()`).
3. **Colaborador nunca vê a avaliação do gestor:** mesmo após o consenso fechado. Ele vê apenas: a sua própria autoavaliação, a nota final do consenso (sem distinguir o que veio do gestor), e o PDI publicado.
4. **Submit trava edição:** assim que uma avaliação muda para `finalizado`, ninguém edita as respostas. Reabertura só por admin com justificativa ≥ 30 caracteres.
5. **PDI muda de mão na ciência:** antes da ciência, gestor edita livremente. Após a ciência, gestor não edita pontos nem ações; só atualiza status via fluxo de validação.
6. **Tudo sensível é auditado:** transferência de gestor, reabertura, desativação, des-finalização de ação, alteração de papel — todas geram linha em `audit_log` ou tabela específica.
7. **Diretoria como leitor agregado:** atualmente o app usa `admin` como o único papel administrativo. Se a diretoria precisar de acesso somente-leitura aos dashboards, criar uma `role = 'diretoria'` em uma fase futura. **Por ora, diretoria = admin.**
8. **RH = Administrador.** Sempre que este documento mencionar "Administrador", entenda que é o time do RH.

---

## 2. Perfil ADMINISTRADOR (RH)

### 2.1. O que vê no menu lateral

```
[ Início ]                               -> /app/inicio (dashboard global)
[ Ciclos ]                               -> /app/admin/ciclos
[ Colaboradores ]                        -> /app/admin/colaboradores
[ Avaliações ]                           -> /app/admin/avaliacoes
[ PDI ]                                  -> /app/admin/pdi
[ Ações Pendentes ]                      -> /app/admin/acoes-pendentes
[ Auditoria ]                            -> /app/admin/auditoria
[ Configurações ]                        -> /app/admin/configuracoes
  ├─ Blocos e perguntas
  ├─ Departamentos
  └─ Cargos
[ Meu perfil ]                           -> /app/perfil
[ Sair ]
```

### 2.2. Páginas e funcionalidades

| Página | Pode fazer |
| --- | --- |
| **Início (dashboard global)** | KPIs: % autoavaliações concluídas, % avaliações de gestor concluídas, % consensos fechados, % ações finalizadas no prazo, ações em atraso por departamento, gráfico de aderência ao ciclo |
| **Ciclos** | Criar ciclo (nome, datas, deadline). Disparar (`dispatch_cycle`) — gera `evaluations` em massa. Fechar ciclo (status → `encerrado`). Reabrir ciclo (com justificativa) |
| **Colaboradores** | Listar todos, filtrar por departamento/cargo/papel/status. Criar individualmente. **Importar via CSV**. Editar dados cadastrais. **Transferir gestor** (`/app/admin/colaboradores/:id/transferir-gestor`). **Desativar** (admin-deactivate-user). Resetar senha. Mudar papel |
| **Avaliações** | Visualizar TODAS as avaliações (qualquer ciclo, qualquer pessoa). **Reabrir** uma avaliação finalizada com justificativa ≥ 30 chars. Ver histórico de respostas |
| **PDI** | Visualizar TODOS os PDIs. Reabrir PDI fechado. Ver histórico de des-finalizações |
| **Ações Pendentes** | Relatório global filtrável por ciclo, status, departamento, gestor. Aba para "Finalizadas com atraso". Export CSV. Identifica ações que se estendem além do ciclo |
| **Auditoria** | Trilha completa (`audit_log`) com filtros por ação, autor, registro, payload. Export CSV |
| **Configurações** | CRUD de blocos de competência, perguntas, departamentos, cargos. Cuidado: editar pergunta no meio do ciclo gera reabertura forçada de avaliações afetadas |
| **Meu perfil** | Trocar a própria senha, atualizar telefone |

### 2.3. Regras específicas do ADMIN

- Pode ler **qualquer** linha de `profiles`, `evaluations`, `answers`, `pdi`, `pdi_actions`, `audit_log`. (RLS via `is_admin()`).
- Pode chamar **todas as Edge Functions** (`admin-create-user`, `admin-bulk-import`, `admin-deactivate-user`, `admin-reopen-evaluation`).
- Pode chamar **todas as RPCs** sensíveis (`transfer_employee_manager`, `reopen_evaluation`, `deactivate_user`, `finalize_action`, `unfinalize_action` etc.) — embora algumas exijam ownership, o admin sempre passa porque o `is_admin()` é o bypass.
- Não preenche avaliações por padrão. Só preenche se ele próprio for `manager_id` de alguém (caso raro: admin e gestor ao mesmo tempo).
- **Não pode finalizar uma ação do PDI alheio "de fora"** sem justificativa — e mesmo nesse caso, o ideal é admin acionar o gestor responsável, não substituí-lo.

### 2.4. O que admin **NÃO** vê / não tem botão

| Item | Por quê |
| --- | --- |
| Botão "Avaliar como colaborador" em PDI/avaliação alheia | Admin não preenche avaliação dos outros — ele observa, audita, reabre. Quem preenche é o gestor responsável |
| Tela de "minha autoavaliação" se ele não tiver ciclo aberto para si | Mesmo o admin pode ser avaliado como pessoa, mas só aparece se a sua linha em `profiles` tiver `manager_id` configurado |

---

## 3. Perfil GESTOR

### 3.1. O que vê no menu lateral

```
[ Início ]                               -> /app/inicio (dashboard da equipe)
[ Minha Avaliação ]                      -> /app/colaborador/minha-avaliacao
  └─ aparece se ele próprio tem ciclo aberto como avaliado
[ Minha Equipe ]                         -> /app/gestor/equipe
  ├─ Avaliar [João da Silva]            -> /app/gestor/avaliacoes/:id
  ├─ Consenso [João da Silva]           -> /app/gestor/consenso/:id
  └─ PDI [João da Silva]                -> /app/gestor/pdi/:id
[ Validar Ações ]                        -> /app/gestor/pdi/validar
[ Histórico da Equipe ]                  -> /app/gestor/historico
[ Meu PDI ]                              -> /app/colaborador/pdi (caso ele tenha um)
[ Meu perfil ]
[ Sair ]
```

> **Importante:** o gestor é também um **colaborador para o gestor dele**. Por isso ele tem itens "Minha Avaliação" e "Meu PDI" ao mesmo tempo que tem "Minha Equipe". A UI precisa renderizar ambos os blocos quando aplicável.

### 3.2. Páginas e funcionalidades

| Página | Pode fazer |
| --- | --- |
| **Início** | Dashboard da equipe: status dos liderados (autoavaliação ok? avaliação dele ok? consenso pendente? PDIs em andamento? ações a validar?) |
| **Minha Equipe** | Lista de subordinados diretos (`profiles.manager_id = self`). Para cada um, atalhos para autoavaliação dele (visível apenas após gestor finalizar a manager), avaliação manager (a do gestor), consenso, PDI |
| **Avaliar colaborador** (`/app/gestor/avaliacoes/:evaluationId`) | Preenche **às cegas**. Não vê a autoavaliação do liderado. Salva rascunho, envia. Após envio, abre a `evaluations` de tipo `consensus` automaticamente |
| **Consenso** (`/app/gestor/consenso/:evaluationId`) | Vê lado a lado: nota colaborador / nota gestor / 3 comentários. Define a nota final + comentário do consenso. Sistema sugere as 3 piores notas; pode selecionar mais (alerta acima de 8). Mín. 3 para fechar. Ao fechar, gera o PDI |
| **PDI builder** (`/app/gestor/pdi/:pdiId`) | Cria as ações iniciais para cada ponto (mínimo 1, sem teto, botão `+ ação`). Edita livremente até a ciência do colaborador. Após ciência, visualização somente leitura |
| **Validar Ações** (`/app/gestor/pdi/validar`) | Aba "Pendentes": ações da sua equipe que aguardam validação. Botão **Finalizar** (data padrão = hoje, retroativa só ≥ start_date e ≤ now). Aba "Finalizadas": botão **Des-finalizar** com justificativa ≥ 10 chars |
| **Histórico da Equipe** | Avaliações e PDIs antigos da equipe. Somente leitura |
| **Minha Avaliação / Meu PDI** | Idênticos ao perfil colaborador (item 4) |

### 3.3. Regras específicas do GESTOR

- RLS limita leitura/escrita a registros onde ele é `manager_id` (subordinados diretos). Não vê pessoas de outras equipes mesmo que estejam no mesmo departamento.
- **Não vê** pessoas que pertenciam à equipe dele e foram transferidas para outro gestor (a partir do momento da transferência).
- Vê o histórico **anterior à transferência** porque o `assignment_history` preserva a relação.
- Não pode reabrir avaliação. Não pode reabrir PDI. Não pode mudar `manager_id` de ninguém.
- Ao finalizar uma ação com data retroativa, sistema valida `start_date ≤ data ≤ now()`. Não permite data futura nem anterior ao início da ação.
- Ao des-finalizar, é obrigatório justificar (≥ 10 chars). Histórico vai para `pdi_action_unfinalize_history`.

### 3.4. O que gestor **NÃO** vê / não tem botão

| Item | Por quê |
| --- | --- |
| Equipes de outros gestores | RLS bloqueia |
| Avaliações de pessoas fora da sua equipe direta | RLS bloqueia |
| Botão "Reabrir avaliação" | Só admin |
| Botão "Reabrir PDI" | Só admin |
| Botão "Transferir gestor" | Só admin |
| Auditoria | Só admin |
| Configurações de blocos/perguntas/departamentos | Só admin |
| **Autoavaliação do liderado, ANTES de finalizar a sua avaliação como gestor** | Regra do gestor cego — RLS via `manager_can_see_self_eval()` |
| Importação CSV de colaboradores | Só admin |

---

## 4. Perfil COLABORADOR

### 4.1. O que vê no menu lateral

```
[ Início ]                               -> /app/inicio (dashboard pessoal)
[ Minha Avaliação ]                      -> /app/colaborador/avaliacoes/:id
[ Meu PDI ]                              -> /app/colaborador/pdi
[ Histórico ]                            -> /app/colaborador/historico
[ Meu perfil ]                           -> /app/perfil
[ Sair ]
```

### 4.2. Páginas e funcionalidades

| Página | Pode fazer |
| --- | --- |
| **Início** | Dashboard pessoal: autoavaliação pendente, PDI atual com ações a executar, prazos próximos, banner de ciência se aplicável |
| **Minha Autoavaliação** (`/app/colaborador/avaliacoes/:evaluationId`) | Preenche notas (1-5) e comentários opcionais por questão. Salva rascunho. Envia (chama `finalize_self_evaluation`). Após envio, leitura apenas |
| **Meu PDI** (`/app/colaborador/pdi`) | Banner de ciência (se ainda não deu). Após ciência, vê os pontos a desenvolver e atualiza status das ações: `nao_iniciada` → `em_andamento` → `concluida_colaborador`. Pode adicionar `progress_note`. Não muda para `finalizada` (apenas gestor). Ao marcar `concluida_colaborador`, dispara e-mail ao gestor |
| **Histórico** | Avaliações antigas dele, PDIs encerrados, ações concluídas. Somente leitura |
| **Meu perfil** | Trocar senha, atualizar telefone |

### 4.3. Regras específicas do COLABORADOR

- RLS só libera leitura de:
  - Sua própria `profiles`.
  - Suas `evaluations` do tipo `self` e `consensus` (após o consenso fechado).
  - Seu `pdi`, seus `pdi_points`, suas `pdi_actions`.
  - Suas `qualitative_answers` próprias.
- Pode escrever apenas em:
  - `answers` da sua autoavaliação enquanto status = `em_andamento`.
  - `pdi.acknowledgment_note` ao dar ciência (via RPC).
  - `pdi_actions.progress_note` e `pdi_actions.status` (via RPC `update_action_status`, exceto `finalizada`).
- Não pode editar a descrição da ação, datas, nem deletar ações — isso é do gestor antes da ciência.
- **NÃO PODE** ver:
  - Avaliação do gestor (`evaluations.type = 'manager'`) em momento algum.
  - Notas individuais do gestor no consenso (vê apenas a nota final).
  - PDI/ações de outros colaboradores.
  - Quem é o gestor de outras pessoas.

### 4.4. O que colaborador **NÃO** vê / não tem botão

| Item | Por quê |
| --- | --- |
| Equipe (não tem subordinados) | É o nível mais baixo da hierarquia |
| Avaliações de outras pessoas | RLS bloqueia |
| Reabrir avaliação / PDI | Só admin |
| Adicionar/remover ações no PDI | Só gestor antes da ciência; depois só com reabertura |
| Finalizar ação | Só gestor |
| Auditoria, configurações, ciclos | Só admin |
| Trocar próprio papel ou gestor | Só admin |

---

## 5. Matriz de visibilidade — momento × papel

> Esta tabela é a fonte da verdade para validar RLS e UI.

| Recurso | Colaborador | Gestor (do colaborador) | Outro gestor | Admin |
| --- | :-: | :-: | :-: | :-: |
| `profiles.full_name`, `email`, `role` (lista de pessoas) | Apenas o próprio | Equipe direta | — | Tudo |
| `evaluations.type='self'` enquanto **gestor não submeteu** a `manager` | Edita (se em_andamento) ou lê (se finalizada) | **NÃO VÊ** ⚠️ | — | Vê |
| `evaluations.type='self'` após gestor submeter a `manager` | Lê | Lê (na tela de consenso) | — | Vê |
| `evaluations.type='manager'` | **NUNCA** ⚠️ | Edita/lê (a sua) | — | Vê |
| `evaluations.type='consensus'` enquanto em_andamento | Não vê | Edita | — | Vê |
| `evaluations.type='consensus'` finalizada | Lê (nota final) | Lê | — | Vê |
| `pdi` antes da ciência | Lê (banner) | Edita | — | Vê |
| `pdi` após ciência | Lê | Lê | — | Vê |
| `pdi_actions.progress_note` (própria) | Edita | Lê | — | Vê |
| `pdi_actions.description, dates` | Lê | Edita (antes da ciência) | — | Edita |
| `pdi_actions.status='finalizada'` | Não pode marcar | Marca via `finalize_action` | — | Marca |
| `audit_log` | — | — | — | Lê |
| `assignment_history` | Apenas as próprias linhas | Apenas as suas equipes (atual + passadas) | — | Tudo |

---

## 6. Mapa de rotas (esperado, pós-refatoração)

```
/login
/recuperar-senha
/redefinir-senha
/trocar-senha-obrigatorio

/app                                               (redirect baseado em role)
/app/inicio                                        (dashboard, conteúdo varia por role)
/app/perfil                                        (todos)

# Colaborador (também acessível por gestor e admin se forem avaliados)
/app/colaborador/avaliacoes/:evaluationId          (autoavaliação)
/app/colaborador/pdi                               (meu PDI)
/app/colaborador/historico                         (meus ciclos antigos)

# Gestor (também acessível por admin)
/app/gestor/equipe                                 (lista de subordinados)
/app/gestor/avaliacoes/:evaluationId               (preencher como gestor)
/app/gestor/consenso/:evaluationId                 (consenso)
/app/gestor/pdi/:pdiId                             (builder)
/app/gestor/pdi/validar                            (validar/finalizar/des-finalizar)
/app/gestor/historico                              (histórico da equipe)

# Admin (RH) - exclusivo
/app/admin/ciclos
/app/admin/colaboradores
/app/admin/colaboradores/:id/transferir-gestor
/app/admin/avaliacoes                              (todas as avaliações, reabrir)
/app/admin/avaliacoes/:id/reabrir
/app/admin/pdi
/app/admin/pdi/:id/reabrir
/app/admin/acoes-pendentes
/app/admin/auditoria
/app/admin/configuracoes
/app/admin/configuracoes/blocos
/app/admin/configuracoes/perguntas
/app/admin/configuracoes/departamentos
/app/admin/configuracoes/cargos
```

---

## 7. Componentes de UI que precisam respeitar `role`

### 7.1. `Sidebar` / `AppLayout`

Renderização condicional. Use `useAuth()` para ler `profile.role` e:

```tsx
const isAdmin = profile?.role === "admin";
const isGestor = profile?.role === "gestor" || isAdmin;
const isColaborador = !!profile;  // todo mundo é, no mínimo, colaborador

const menuItems = [
  // Comuns a todos
  { label: "Início", to: "/app/inicio" },

  // Bloco "Eu como colaborador" — visível para todos os roles que tenham
  // ciclo aberto pra si (verificar via query)
  hasOpenCycleAsEvaluatee && { label: "Minha Avaliação", to: `/app/colaborador/avaliacoes/${currentSelfEvalId}` },
  hasActivePdi && { label: "Meu PDI", to: "/app/colaborador/pdi" },
  { label: "Histórico", to: "/app/colaborador/historico" },

  // Bloco "Eu como gestor"
  isGestor && { label: "Minha Equipe", to: "/app/gestor/equipe" },
  isGestor && { label: "Validar Ações", to: "/app/gestor/pdi/validar" },
  isGestor && { label: "Histórico da Equipe", to: "/app/gestor/historico" },

  // Bloco "Administração (RH)"
  isAdmin && { label: "Ciclos", to: "/app/admin/ciclos" },
  isAdmin && { label: "Colaboradores", to: "/app/admin/colaboradores" },
  isAdmin && { label: "Avaliações", to: "/app/admin/avaliacoes" },
  isAdmin && { label: "PDI", to: "/app/admin/pdi" },
  isAdmin && { label: "Ações Pendentes", to: "/app/admin/acoes-pendentes" },
  isAdmin && { label: "Auditoria", to: "/app/admin/auditoria" },
  isAdmin && { label: "Configurações", to: "/app/admin/configuracoes" },

  { label: "Meu perfil", to: "/app/perfil" },
].filter(Boolean);
```

### 7.2. `RoleRoute`

Já existe. Garantir uso em **todas** as rotas de gestor (`roles=["gestor","admin"]`) e admin (`roles=["admin"]`). Colaborador é o default — qualquer rota dentro de `ProtectedRoute` é acessível.

### 7.3. `DashboardPage`

A mesma página deve renderizar **3 versões diferentes** baseado em `profile.role`:

- **admin** → KPIs globais, alertas operacionais (ciclo prestes a expirar, ações em massa atrasadas)
- **gestor** → status da equipe + status pessoal (ele também é avaliado)
- **colaborador** → status pessoal apenas

### 7.4. Botões sensíveis em telas compartilhadas

Em telas que múltiplos roles acessam (ex.: tela de avaliação visualizada), botões como "Reabrir", "Transferir gestor", "Editar pergunta" devem aparecer **somente** se `isAdmin`. Não basta esconder — a Edge Function ou RPC já valida, mas a UI precisa ser coerente.

---

## 8. Plano de refatoração — checklist

Use isto como roteiro. Cada item gera 1 commit.

- [ ] **Sidebar dinâmico:** reescrever `AppLayout`/`Sidebar` para renderizar os 3 grupos (Eu como colaborador / Eu como gestor / Administração RH) baseado em `profile.role`. Itens irrelevantes ao perfil **não aparecem**.
- [ ] **Dashboard por role:** `DashboardPage.tsx` precisa de 3 sub-renderizações. Pode ser arquivos separados (`AdminDashboard`, `GestorDashboard`, `ColaboradorDashboard`) e o `DashboardPage` decide qual instanciar.
- [ ] **Tela "Minha Equipe"** (`/app/gestor/equipe`): listar subordinados diretos, mostrar status (autoavaliação? avaliação manager? consenso? PDI ativo?), atalhos para cada subtela.
- [ ] **Tela "Histórico da Equipe"** (`/app/gestor/historico`): listar avaliações e PDIs encerrados de subordinados (atuais e passados, via `assignment_history`).
- [ ] **Tela "Histórico" do colaborador** (`/app/colaborador/historico`): seus ciclos passados.
- [ ] **Tela "Avaliações" do admin** (`/app/admin/avaliacoes`): listagem global com filtro por ciclo/colaborador/status. Botão "Reabrir" abre dialog com motivo (≥30 chars) e chama Edge Function `admin-reopen-evaluation`.
- [ ] **Tela "PDI" do admin** (`/app/admin/pdi`): listagem global. Botão "Reabrir" análogo.
- [ ] **Tela "Ciclos"** (`/app/admin/ciclos`): CRUD + botão "Disparar" (`dispatch_cycle`). Aviso se ciclo já tem avaliações criadas (não chamar de novo).
- [ ] **Tela "Colaboradores"** (`/app/admin/colaboradores`): listagem com filtros, botão "Novo", "Importar CSV", "Editar", "Transferir gestor", "Desativar".
- [ ] **Tela "Configurações"** (`/app/admin/configuracoes`): hub com 4 sub-abas (blocos, perguntas, departamentos, cargos).
- [ ] **Tela "Meu perfil"** (`/app/perfil`): trocar senha, editar telefone, ver papel atual (somente leitura).
- [ ] **`ProtectedRoute`**: continua redirecionando para `/trocar-senha-obrigatorio` se `profile.must_change_password`.
- [ ] **`RoleRoute`**: aplicado em **todas** as rotas `/app/gestor/*` (com `["gestor","admin"]`) e `/app/admin/*` (com `["admin"]`).
- [ ] **Auditoria de RLS:** rodar query a partir de cada role (admin, gestor, colaborador) e validar que ele só lê o que a tabela 5 prevê. Se não confere, a regra prevalece — corrigir o RLS.
- [ ] **Botões sensíveis:** revisar todas as telas de visualização para esconder ações administrativas para não-admin.
- [ ] **Testes manuais (smoke):** seguir o roteiro do `ATUALIZACAO_FASE_06.md` com 1 admin, 1 gestor e 1 colaborador.

---

## 9. Referências cruzadas

- `supabase/migrations/20260101_01_rls.sql` — políticas base (`is_admin`, `is_manager_of`).
- `supabase/migrations/20260427_05_access_lifecycle.sql` — regras de transferência, reabertura, ciência.
- `supabase/migrations/20260427_06_consensus_pdi_workflow.sql` — gestor cego, fluxo do consenso e PDI.
- Memória persistente em `project_dfs_evaluation_workflow.md` — decisões aprovadas com Daniel em 2026-04-28.
- `README.md` seções 8.1 a 8.6 — fluxo operacional resumido.

---

**Última edição:** 2026-04-29 — após alinhamento com Daniel sobre repercussão dos perfis no menu/UI.
