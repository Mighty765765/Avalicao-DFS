# 🚀 APLICAR MIGRATION 06 AGORA

## ⚡ Forma Rápida (2 minutos)

### Passo 1: Abrir Supabase Dashboard
Acesse: https://app.supabase.com/

### Passo 2: Selecionar Projeto
Selecione o projeto **DFS - Avaliação de Desempenho**

### Passo 3: SQL Editor
No menu esquerdo:
- Clique em **SQL Editor**
- Clique em **+ New Query**

### Passo 4: Cole a Migration
1. Abra o arquivo: `supabase/migrations/20260427_06_consensus_pdi_workflow.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor

### Passo 5: Execute
Clique no botão **▶ Run** (ou Ctrl+Enter)

**⏱️ Aguarde 30-60 segundos...**

---

## ✅ Verificação Pós-Aplicação

Após executar, rode estas queries para verificar:

```sql
-- 1. Verificar enum
SELECT * FROM pg_type WHERE typname = 'pdi_action_status';

-- 2. Verificar tabela pdi_points
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'pdi_points';

-- 3. Verificar colunas em pdi_actions
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'pdi_actions' 
AND column_name IN ('start_date', 'end_date', 'status', 'finalized_at');

-- 4. Verificar funções
SELECT proname FROM pg_proc 
WHERE proname IN ('finalize_action', 'unfinalize_action', 'update_action_status');

-- 5. Verificar views
SELECT table_name FROM information_schema.views 
WHERE table_name LIKE 'v_pdi%';
```

Se todas retornarem resultados ✓ a migration foi aplicada com sucesso!

---

## 🐛 Se Der Erro...

### Erro: "already exists"
- Significa que parte da migration já existe
- Continuar executando é seguro (tem `if not exists`)

### Erro: "syntax error"
- Copiar novamente, com cuidado (às vezes a página coloca caracteres extras)
- Se persistir, tente em outra aba do navegador

### Erro: "permission denied"
- Você está logado?
- Tem role de **admin** ou **owner** do projeto?
- Tente recarregar a página

---

## 📝 Checklist Pós-Aplicação

- [ ] Migration executada sem erros
- [ ] Verificação queries rodaram OK
- [ ] Servidor React reiniciado (`npm run dev`)
- [ ] Páginas carregando normal
- [ ] Testes:
  - [ ] Criar novo PDI (PdiBuilderPage) - deve exigir 3 competências
  - [ ] Atualizar ação (PdiAcoesPage) - deve funcionar
  - [ ] Finalizar ação (ValidarAcoesPage) - antes dava erro, agora deve funcionar ✓

---

## 🎯 Pronto!

Se tudo deu certo, seu app está 100% funcional com o workflow completo!

Qualquer dúvida, verifique `MIGRATION_06_SETUP.md`
