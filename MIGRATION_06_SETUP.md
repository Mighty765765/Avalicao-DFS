# 🚀 Aplicando Migration 06 - Consenso PDI Workflow

A migration 06 implementa o workflow completo de consenso e PDI com suporte para ações pós-consensus.

## ✅ Alterações Realizadas

1. **Enum `pdi_action_status`**: `nao_iniciada`, `em_andamento`, `concluida_colaborador`, `finalizada`
2. **Tabela `pdi_points`**: Armazena questões selecionadas no consenso (1 por questão)
3. **Colunas em `pdi_actions`**: `start_date`, `end_date`, `status`, `finalized_at`, etc.
4. **RPC Functions**:
   - `finalize_action()`: Finaliza ação com data retroativa (gestor)
   - `unfinalize_action()`: Reverte finalização com justificativa
   - `update_action_status()`: Atualiza andamento (compatível com schema 00)
5. **Views**:
   - `v_pdi_actions_pending`: Ações pendentes por ciclo
   - `v_pdi_actions_late`: Ações finalizadas com atraso
   - `v_consensus_side_by_side`: Visão lado-a-lado do consenso

## 🔧 Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse: https://app.supabase.com
2. Selecione o projeto
3. Vá em **SQL Editor**
4. Cole o conteúdo de `supabase/migrations/20260427_06_consensus_pdi_workflow.sql`
5. Clique em **Run**

### Opção 2: Via Supabase CLI (Local)

```bash
# 1. Fazer login
npx supabase login

# 2. Link ao projeto (use seu PROJECT_ID e DATABASE_PASSWORD)
npx supabase link --project-ref seu_project_id --password sua_db_password

# 3. Aplicar migration
npx supabase migration up
```

### Opção 3: Via aplicação (Dev Mode)

Se estiver em desenvolvimento local com Supabase:

```bash
npx supabase migration up
```

## ⚠️ Pontos Importantes

- **Compatibilidade**: A migration foi corrigida para funcionar com dados do schema 00 (sem pdi_points)
- **Dados Existentes**: Ações antigas receberão `start_date = current_date - 30` e `end_date = deadline`
- **Status Conversion**: Função `convert_action_status()` mapeia valores automaticamente

## 📋 Verificação Pós-Aplicação

```sql
-- Verificar se pdi_points foi criado
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'pdi_points';

-- Verificar se funções foram criadas
SELECT COUNT(*) FROM pg_proc WHERE proname IN (
  'finalize_action', 'unfinalize_action', 'update_action_status', 'convert_action_status'
);

-- Verificar se views foram criadas
SELECT COUNT(*) FROM information_schema.views 
WHERE table_name IN ('v_pdi_actions_pending', 'v_pdi_actions_late');
```

## 🐛 Troubleshooting

### Erro: "column 'start_date' does not exist"
- Migration não foi aplicada completamente
- Verifique se todas as linhas do script foram executadas

### Erro: "function finalize_action does not exist"
- Grants podem não ter sido aplicados
- Execute a seção **20. Grants** da migration

### Erro: "type pdi_action_status does not exist"
- O enum não foi criado
- Execute a seção **1. Enum** da migration manualmente

## ✨ Próximos Passos

Após aplicar a migration:

1. Testar a função `finalize_action()` via ValidarAcoesPage
2. Criar PDIs via PdiBuilderPage (agora com validação de 3 competências)
3. Executar seed script para dados de demo

---

**Questões?** Verifique os logs de erro no Supabase Dashboard → SQL Editor
