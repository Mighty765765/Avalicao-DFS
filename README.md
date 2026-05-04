# DFS — Avaliação de Desempenho 180º

Aplicação web interna para condução do ciclo semestral de avaliação de desempenho 180º da DFS.
Construída em React + Vite + Material UI, com Supabase (Postgres + Auth + Edge Functions) como
backend.

> Identidade visual: Azul DFS principal `#0041C0`, escuro `#012639`, secundário `#006AB0`,
> tipografia **Inter**.

---

## 1. Pré-requisitos

- **Node.js 20+** e **pnpm** (recomendado) ou **npm**
- **Supabase CLI** instalado: `npm i -g supabase`
- Conta na Supabase com projeto criado (project-ref atual: `ehhcgnjcvpgcgcmhaovg`)
- Conta na **Resend** (ou similar) para envio dos e-mails transacionais
- VS Code com a extensão recomendada **Supabase**

---

## 2. Variáveis de ambiente

Há três arquivos:

| Arquivo | Quem usa | Conteúdo |
| --- | --- | --- |
| `.env.example` | template versionado | placeholders |
| `.env.local` | front-end (Vite) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `.env.server` | Edge Functions (não comitar) | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` |

> ⚠️ Apenas `.env.local` e `.env.example` ficam no Git. `.env.server` está em `.gitignore`.

Para configurar os secrets das Edge Functions (em vez de `.env.server`):

```bash
# SMTP corporativo (substituiu o Resend)
supabase secrets set SMTP_HOST=smtp.dfs.com.br
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=avaliacao@dfs.com.br
supabase secrets set SMTP_PASS='SUA_SENHA'
supabase secrets set SMTP_SECURE=false      # true se a porta for 465 (TLS direto)
supabase secrets set SMTP_FROM='DFS RH <avaliacao@dfs.com.br>'

supabase secrets set APP_URL=https://avaliacao.dfs.com.br
supabase secrets set DEFAULT_PASSWORD='Dfs@2026'
```

> A configuração SMTP é única — TI pode criar uma caixa exclusiva (ex.:
> `avaliacao@dfs.com.br`) e fornecer host/usuário/senha. As Edge Functions
> consomem essas variáveis através do helper `_shared/email.ts` (denomailer).

---

## 3. Aplicar migrações no Supabase

A ordem de execução é **obrigatória** (cada arquivo depende das tabelas/funções dos anteriores):

```bash
supabase link --project-ref ehhcgnjcvpgcgcmhaovg
supabase db push
```

Ou, se preferir aplicar manualmente no SQL Editor do Supabase Studio, copie e cole pela ordem:

1. `supabase/migrations/20260101_00_schema.sql` — tabelas, enums, índices
2. `supabase/migrations/20260101_01_rls.sql` — Row Level Security e helpers (`is_admin()`, `is_manager_of()`)
3. `supabase/migrations/20260101_02_functions.sql` — RPC `dispatch_cycle()`, views (`v_evaluation_scores`, `v_ranking_consensus`, etc.)
4. `supabase/migrations/20260101_03_triggers.sql` — `handle_new_user`, auditoria, status automático
5. `supabase/migrations/20260101_04_seed.sql` — departamentos, cargos, blocos e perguntas DFS
6. `supabase/migrations/20260427_05_access_lifecycle.sql` — troca de senha obrigatória, transferência de gestor, reabertura, ciência de PDI
7. `supabase/migrations/20260427_06_consensus_pdi_workflow.sql` — gestor cego, abertura automática do consenso, sugestão dos 3 piores, `pdi_points`, 4 estados de ação, finalização com data retroativa controlada, des-finalização justificada, views `v_pdi_actions_pending`, `v_pdi_actions_late` e `v_consensus_side_by_side`

---

## 4. Deploy das Edge Functions

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-bulk-import
supabase functions deploy admin-deactivate-user
supabase functions deploy admin-reopen-evaluation
supabase functions deploy notify-pdi-events
```

Cada função valida o JWT e exige `profile.role = 'admin'` antes de qualquer ação sensível.

---

## 5. Bootstrap do primeiro administrador

A primeira conta admin precisa ser criada manualmente no Supabase Studio (Auth → Users → "Add user")
e em seguida o perfil deve ser atualizado:

```sql
update public.profiles
   set role = 'admin',
       status = 'ativo',
       must_change_password = false,
       full_name = 'Daniel Silva'
 where email = 'danielsilva765@gmail.com';
```

A partir desse usuário, todos os demais podem ser criados via tela **Administração → Colaboradores**
(que usa a Edge Function `admin-create-user`).

---

## 6. Rodar o frontend

```bash
pnpm install
pnpm dev
```

Aplicação disponível em `http://localhost:5173`.

Build de produção:

```bash
pnpm build
pnpm preview   # serve o build estático para validação
```

---

## 7. Estrutura de pastas

```
dfs-avaliacao/
├── public/
│   └── brand/                 # logos e ícones DFS
├── src/
│   ├── components/            # componentes reutilizáveis (banners, cards, layout)
│   ├── context/               # AuthContext
│   ├── lib/                   # supabase client, helpers
│   ├── pages/
│   │   ├── auth/              # login, troca de senha, recuperação
│   │   ├── admin/             # auditoria, transferência de gestor, etc.
│   │   ├── colaborador/       # autoavaliação, PDI, histórico
│   │   ├── gestor/            # avaliações da equipe, consenso, PDI
│   │   └── diretoria/         # dashboards e ranking
│   ├── routes/                # ProtectedRoute, RoleRoute
│   ├── theme/                 # dfsTheme.ts (paleta, tipografia)
│   ├── types/                 # tipos compartilhados
│   ├── App.tsx                # rotas
│   └── main.tsx               # bootstrap React
├── supabase/
│   ├── functions/             # Edge Functions (Deno)
│   └── migrations/            # SQL migrations
├── .env.example
├── .env.local
├── .env.server                # (gitignored)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 8. Fluxos principais

### 8.1 Provisionamento de usuário
1. Admin abre **Administração → Colaboradores → Novo**.
2. Front chama `admin-create-user` (Edge Function) passando nome, e-mail, perfil, gestor.
3. Função cria o usuário em `auth.users` com senha padrão `Dfs@2026`, atualiza `public.profiles`
   (com `must_change_password = true`) e dispara e-mail Resend de boas-vindas.
4. No primeiro login o usuário é redirecionado para `/trocar-senha-obrigatorio`.

### 8.2 Transferência de gestor
1. Admin acessa `/app/admin/colaboradores/:id/transferir-gestor`.
2. Seleciona novo gestor, motivo, decide se migra avaliações em andamento.
3. Front chama RPC `transfer_employee_manager(p_employee_id, p_new_manager, p_reason, p_migrate_open)`.
4. RPC atualiza `profiles.manager_id`, registra em `assignment_history` e (se aplicável) atualiza
   `evaluations.evaluator_id` para tipos `manager` e `consensus` ainda não finalizados.

### 8.3 Reabertura de avaliação
1. Apenas admin. Tela `/app/admin/avaliacoes/:id/reabrir`.
2. Justificativa obrigatória (≥30 caracteres).
3. Edge Function `admin-reopen-evaluation` valida e chama RPC `reopen_evaluation()` que muda status
   para `em_andamento`, registra no `audit_log` e e-mails são disparados ao avaliador.

### 8.4 Ciência do PDI
1. Após o consenso, gestor preenche o PDI no `/app/gestor/equipe/:id/pdi`.
2. Colaborador vê banner amarelo na home do PDI até clicar em **Dou ciência**.
3. RPC `acknowledge_pdi(pdi_id, note)` grava `acknowledged_at` + nota.
4. Antes da ciência, colaborador não consegue editar `progress_note` (trigger
   `tg_pdi_actions_employee_guard`).

### 8.5 Desligamento / desativação
1. Admin marca colaborador como inativo (Edge Function `admin-deactivate-user`).
2. Função: define `profiles.status='inativo'`, faz ban no auth (90 dias), retorna lista de
   subordinados órfãos para reatribuição imediata.

### 8.6 Ciclo completo: autoavaliação → avaliação do gestor → consenso → PDI
1. **Autoavaliação** (`/app/colaborador/avaliacoes/:id`): colaborador responde,
   salva rascunho, envia. RPC `finalize_self_evaluation()` muda o status para
   `finalizado` e trava edição.
2. **Avaliação do gestor** (`/app/gestor/avaliacoes/:id`): gestor preenche
   **às cegas** — RLS bloqueia leitura das respostas do tipo `self` enquanto
   sua própria avaliação não estiver `finalizado`. Ao enviar, RPC
   `finalize_manager_evaluation()` cria automaticamente a `evaluation` de
   tipo `consensus`.
3. **Consenso** (`/app/gestor/consenso/:id`): tela com a `v_consensus_side_by_side`,
   mostrando lado a lado as respostas de colaborador e gestor + 3 campos de
   comentários separados. Sistema sugere as **3 piores notas** automaticamente
   via `suggest_pdi_points()`. Gestor pode aceitar ou trocar (mín. 3, alerta
   acima de 8). Ao fechar, `finalize_consensus()` cria o PDI e popula
   `pdi_points`.
4. **Construção do PDI** (`/app/gestor/pdi/:pdiId`): gestor define ações para
   cada ponto (mínimo 1, sem teto). Ao publicar, `notify-pdi-events` dispara
   o e-mail SMTP de notificação ao colaborador.
5. **Ciência do PDI** (`/app/colaborador/pdi`): banner amarelo com botão
   **Dou ciência** (RPC `acknowledge_pdi`). Antes da ciência, o gestor pode
   continuar editando livremente.
6. **Execução das ações**: colaborador atualiza status (`nao_iniciada` →
   `em_andamento` → `concluida_colaborador`) via `update_action_status()`.
   Quando marca como concluída, dispara e-mail ao gestor.
7. **Validação pelo gestor** (`/app/gestor/pdi/validar`): finaliza com
   `finalize_action()` (aceita data retroativa entre `start_date` e hoje;
   nunca futura). Pode des-finalizar com `unfinalize_action()` mediante
   justificativa de pelo menos 10 caracteres, gravada em
   `pdi_action_unfinalize_history`.
8. **Relatórios** (`/app/admin/acoes-pendentes`): DataGrid com filtros por
   ciclo, status, busca livre e flag para "ações que se estendem além do
   ciclo". Aba separada para "Finalizadas com atraso". Export CSV em ambas.

---

## 9. Convenções de código

- **TypeScript estrito** (`strict: true` no `tsconfig.json`).
- Componentes em **PascalCase**, hooks em `useCamelCase`, RPC em `snake_case`.
- Estado de servidor: chamadas diretas ao Supabase client; nada de Redux.
- Datas: `date-fns` formatadas em `pt-BR`.
- Mensagens de erro/sucesso: `notistack` (`enqueueSnackbar`).
- Tabelas/grids: `@mui/x-data-grid` com header `bgcolor: #012639`.
- Gráficos: `@mui/x-charts` ou `recharts`.

---

## 10. Auditoria

Todas as ações sensíveis (alteração de papel, transferência de gestor, reabertura, desativação,
edição de avaliação) são gravadas em `public.audit_log`. A página
`/app/admin/auditoria` permite filtrar por ação, buscar por payload e exportar CSV.

---

## 11. Suporte

Dúvidas funcionais: RH DFS · `rh@dfs.com.br`
Dúvidas técnicas: TI DFS · `ti@dfs.com.br`
