# Atualização Fase 06 — Consenso, PDI e SMTP corporativo

> **Tempo estimado:** 25 a 40 minutos. Faça uma vez, do começo ao fim.
> **Pré-requisitos:** projeto Supabase já criado, fases 00 a 05 já aplicadas, Node 20+, Supabase CLI instalada (`npm i -g supabase`).

Este documento é o playbook desta atualização. Se já tiver feito uma seção, marque como `[x]` e siga adiante.

---

## Parte A — Supabase

### A.1. Atualizar a Supabase CLI e fazer link com o projeto

Abra um terminal **na raiz do projeto** (`dfs-avaliacao/`):

```bash
# Atualiza a CLI (apenas se ainda não fez)
npm i -g supabase

# Login interativo (abre o browser)
supabase login

# Link com o projeto da DFS
supabase link --project-ref ehhcgnjcvpgcgcmhaovg
```

> Se já estiver linkado, pode pular. Em caso de dúvida, `supabase status` mostra o link ativo.

### A.2. Aplicar a migration 06

A migration 06 (`20260427_06_consensus_pdi_workflow.sql`) **assume que as 00–05 já foram aplicadas**. Se você ainda não rodou as anteriores, execute primeiro:

```bash
supabase db push
```

Isso aplica todas as migrations pendentes em ordem. Saída esperada:

```
Applying migration 20260427_06_consensus_pdi_workflow.sql...
NOTICE:  ...
Finished supabase db push.
```

**Plano B (manual via SQL Editor):** se `db push` falhar por qualquer motivo (rede, política de IP), abra o Supabase Studio → SQL Editor → New query → cole o conteúdo de `supabase/migrations/20260427_06_consensus_pdi_workflow.sql` → Run. Confira que terminou em `COMMIT` sem erros.

### A.3. Configurar os secrets de SMTP corporativo

Peça ao TI da DFS estes 5 dados (ou crie a caixa `avaliacao@dfs.com.br` e gere a senha SMTP):

```bash
supabase secrets set SMTP_HOST=smtp.dfs.com.br
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=avaliacao@dfs.com.br
supabase secrets set SMTP_PASS='SUA_SENHA_AQUI'
supabase secrets set SMTP_SECURE=false
supabase secrets set SMTP_FROM='DFS RH <avaliacao@dfs.com.br>'
supabase secrets set APP_URL=https://avaliacao.dfs.com.br
supabase secrets set DEFAULT_PASSWORD='Dfs@2026'
```

Para conferir: `supabase secrets list` deve mostrar todas as chaves acima (os valores ficam ocultos).

> **Quando usar `SMTP_SECURE=true`?** Apenas quando a porta for **465** (TLS direto). Para a porta padrão **587** (STARTTLS), deixe `false`.

### A.4. Re-deployar as Edge Functions

```bash
# Atualizadas (passaram a usar SMTP)
supabase functions deploy admin-create-user
supabase functions deploy admin-reopen-evaluation

# Novas
supabase functions deploy notify-pdi-events

# Garantir que as outras já estão no ar (pode rodar de novo sem dano)
supabase functions deploy admin-bulk-import
supabase functions deploy admin-deactivate-user
```

Saída esperada para cada uma: `Deployed Function <name> on project ehhcgnjcvpgcgcmhaovg`.

### A.5. Smoke test do SMTP

No SQL Editor do Supabase, faça um teste rápido invocando `notify-pdi-events` por curl ou pela aba **Functions → Invoke** com um payload de evento real, **ou** simplesmente crie um usuário novo via app — o `admin-create-user` vai mandar o e-mail de boas-vindas. Se o e-mail não chegar:

- Veja os logs: Supabase Studio → Functions → admin-create-user → **Logs**.
- Erros típicos: `SMTP_HOST` errado, `SMTP_USER`/`SMTP_PASS` inválidos, `SMTP_SECURE` em desacordo com a porta.

---

## Parte B — VS Code (frontend)

### B.1. Conferir os arquivos novos

Todos os arquivos desta fase já estão no disco. Confirme:

```bash
# Ainda no terminal, na pasta dfs-avaliacao/
ls -la src/pages/colaborador/
ls -la src/pages/gestor/
ls -la src/pages/admin/AcoesPendentesPage.tsx
ls -la supabase/migrations/20260427_06_consensus_pdi_workflow.sql
ls -la supabase/functions/notify-pdi-events/index.ts
ls -la supabase/functions/_shared/email.ts
```

Esperado: cada um existe.

### B.2. Instalar dependências (se ainda não instalou)

```bash
pnpm install
# ou, se preferir npm:
npm install
```

> Não há dependência nova no `package.json` — as bibliotecas usadas (MUI, MUI X DataGrid, Supabase JS, notistack, react-router) já estavam declaradas. O `denomailer` da Edge Function é Deno (executa só no servidor), não vai pro `package.json`.

### B.3. Conferir variáveis do front (`.env.local`)

```dotenv
VITE_SUPABASE_URL=https://ehhcgnjcvpgcgcmhaovg.supabase.co
VITE_SUPABASE_ANON_KEY=<sua publishable/anon key>
VITE_APP_URL=http://localhost:5173
```

### B.4. Rodar o app em modo dev

```bash
pnpm dev
# abre em http://localhost:5173
```

### B.5. Rotas novas que existem agora

| Caminho | Quem acessa | O que faz |
| --- | --- | --- |
| `/app/colaborador/avaliacoes/:evaluationId` | colaborador | autoavaliação com trava no submit |
| `/app/colaborador/pdi` | colaborador | banner de ciência + atualização das ações |
| `/app/gestor/avaliacoes/:evaluationId` | gestor | avaliação às cegas |
| `/app/gestor/consenso/:evaluationId` | gestor | consenso lado a lado, sugestão das 3 piores, fechamento gera PDI |
| `/app/gestor/pdi/:pdiId` | gestor | construção do PDI (pontos + ações) |
| `/app/gestor/pdi/validar` | gestor | finalizar/des-finalizar ações |
| `/app/admin/acoes-pendentes` | admin | relatório com filtros e CSV |

---

## Parte C — Validação end-to-end (smoke test do fluxo)

Faça este teste **com 2 contas** (ou abra em duas janelas anônimas com perfis diferentes) para validar o fluxo. Considere que admin já existe e que você criou Maria (gestor) e João (colaborador, manager_id=Maria).

1. **Admin** abre Supabase Studio → SQL Editor → roda:
   ```sql
   insert into public.cycles (name, start_date, end_date, deadline_date, status)
   values ('2026-01 (teste)', '2026-01-01', '2026-06-30', '2026-08-15', 'em_andamento')
   returning id;
   ```
   Anote o `cycle_id`.

2. Ainda no SQL Editor, dispare manualmente a criação das `evaluations` para o João:
   ```sql
   select public.dispatch_cycle('<cycle_id_do_passo_1>');
   ```
   Isso cria a `self` (João) e a `manager` (Maria) em `em_andamento`.

3. **João** loga, vai em `/app/colaborador/avaliacoes/<id_self>`, preenche tudo, clica **Enviar autoavaliação**. ✅
   - Tente reabrir a tela e editar — deve estar bloqueada.

4. **Maria** loga, vai em `/app/gestor/avaliacoes/<id_manager>`. Note que ela **não vê** as respostas do João (banner de aviso). Preenche tudo e envia. ✅
   - Após enviar, no banco a `evaluations` tipo `consensus` foi criada automaticamente.

5. **Maria** vai em `/app/gestor/consenso/<id_consensus>`:
   - Vê as 3 sugestões automáticas (3 piores notas) já marcadas.
   - Lê os comentários de João, ajusta a nota final, escreve o comentário do consenso.
   - Confirma 3+ pontos e clica **Fechar consenso e gerar PDI**.

6. **Maria** é redirecionada para `/app/gestor/pdi/<pdi_id>`:
   - Para cada ponto, escreve a 1ª ação, define início/fim. Adiciona uma 2ª se quiser.
   - Clica **Publicar PDI** → e-mail é enviado para o João.

7. **João** loga, vai em `/app/colaborador/pdi`:
   - Vê o banner amarelo. Clica **Dou ciência**, deixa um comentário.
   - Agora pode atualizar status: `Em andamento` → salva. Depois `Concluída`.
   - Quando marca `Concluída`, e-mail vai para a Maria.

8. **Maria** vai em `/app/gestor/pdi/validar`:
   - Vê a ação na aba **Pendentes** com chip "Aguarda validação".
   - Clica **Finalizar**. Pode informar data retroativa (não anterior ao início, não futura).
   - Comentário/evidência opcional. Confirma.

9. **Admin** vai em `/app/admin/acoes-pendentes`:
   - Vê a ação migrar entre as abas (Pendentes → Finalizadas com atraso, se a data > prazo).
   - Filtra por ciclo, exporta CSV.

10. Volte na aba **Finalizadas** da Maria e teste a **des-finalização**:
    - Clique **Des-finalizar**, escreva um motivo de pelo menos 10 caracteres, confirme.
    - A ação volta para `Aguarda validação` e o histórico fica em `pdi_action_unfinalize_history` (consultável pelo admin).

Se todos os 10 passos passarem, o fluxo está saudável.

---

## Checklist final

- [ ] `supabase db push` aplicou a migration 06 sem erro
- [ ] `supabase secrets list` mostra todas as 8 variáveis de SMTP/APP/DEFAULT_PASSWORD
- [ ] `supabase functions list` mostra `notify-pdi-events` ativa
- [ ] E-mail de teste chegou na caixa do RH
- [ ] Front-end compila e roda (`pnpm dev`)
- [ ] Smoke test (passos 1 a 10) passou
- [ ] CSV do relatório baixou corretamente

Se algum item falhar, anote o erro e me chama de volta — eu te ajudo a debugar.

---

## Rollback (se precisar voltar atrás)

Se a migration 06 quebrar algo, você pode reverter manualmente no SQL Editor:

```sql
-- Reverter PDI points e historico
drop table if exists public.pdi_action_unfinalize_history cascade;
drop table if exists public.pdi_points cascade;

-- Remover colunas adicionadas em pdi_actions
alter table public.pdi_actions
  drop column if exists pdi_point_id,
  drop column if exists status,
  drop column if exists completed_at_employee,
  drop column if exists manager_finalized,
  drop column if exists finalized_at,
  drop column if exists finalized_by,
  drop column if exists finalization_note;

-- Remover RPCs
drop function if exists public.finalize_self_evaluation(uuid);
drop function if exists public.finalize_manager_evaluation(uuid);
drop function if exists public.finalize_consensus(uuid, uuid[]);
drop function if exists public.suggest_pdi_points(uuid);
drop function if exists public.update_action_status(uuid, public.pdi_action_status, text);
drop function if exists public.finalize_action(uuid, timestamptz, text);
drop function if exists public.unfinalize_action(uuid, text);
drop function if exists public.manager_can_see_self_eval(uuid);

-- Remover views
drop view if exists public.v_pdi_actions_pending;
drop view if exists public.v_pdi_actions_late;
drop view if exists public.v_consensus_side_by_side;

-- Remover enum (apenas se nao houver dados que dependam)
drop type if exists public.pdi_action_status;
```

> **Aviso:** rollback apaga `pdi_points` e o histórico de des-finalização. Faça backup antes.
