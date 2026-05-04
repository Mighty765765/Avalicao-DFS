# 🔧 Instruções para Aplicar o FIX da Migration 06

## ❌ Erro Encontrado

```
ERROR:  42703: column "employee_id" does not exist
LINE 100: select cycle_id, employee_id from public.evaluations...
```

**Causa:** A tabela `evaluations` usa `evaluee_id`, não `employee_id`

---

## ✅ Solução: Aplicar o FIX

### Passo 1: Abrir Supabase Dashboard
https://app.supabase.com

### Passo 2: SQL Editor
Menu esquerdo → **SQL Editor** → **+ New Query**

### Passo 3: Cole o FIX
Abra o arquivo: `MIGRATION_06_FIX.sql`

Copie TODO o conteúdo e cole no SQL Editor do Supabase

### Passo 4: Execute
Clique **▶ Run**

---

## 📋 O que o FIX faz

1. ✓ Recria função `manager_can_see_self_eval()` com `evaluee_id`
2. ✓ Recria função `finalize_manager_evaluation()` com `evaluee_id`
3. ✓ Recria função `finalize_consensus()` com `evaluee_id`
4. ✓ Recria view `v_consensus_side_by_side` com `evaluee_id`
5. ✓ Reaplica grants

**Tempo estimado:** 10-20 segundos

---

## ✔️ Verificação Pós-FIX

Execute estas queries para confirmar:

```sql
-- 1. Verificar funções
SELECT proname FROM pg_proc 
WHERE proname IN ('manager_can_see_self_eval', 'finalize_manager_evaluation', 'finalize_consensus');

-- 2. Verificar view
SELECT table_name FROM information_schema.views 
WHERE table_name = 'v_consensus_side_by_side';

-- 3. Testar função (exemplo)
SELECT public.manager_can_see_self_eval('algum-uuid-aqui'::uuid);
```

Se tudo retornar resultados ✓ **o FIX foi aplicado com sucesso!**

---

## 🎯 Próximos Passos

1. ✅ Aplicar FIX
2. ✅ Reiniciar servidor: `npm run dev`
3. ✅ Testar:
   - Criar novo PDI
   - Atualizar ação
   - **Finalizar ação** (antes dava erro, agora deve funcionar!)

---

## 🐛 Se ainda houver erro...

Se receber outro erro ao aplicar o FIX:
1. Copie a mensagem de erro
2. Verifique se é semelhante ao erro anterior
3. Se for diferente, pode ser outro problema (contate o desenvolvedor)

Se receber **"already exists"** ao aplicar FIX:
- É normal! O script tenta dropar a função antes
- Clique **Run** novamente

---

**Tudo certo?** Volte para o app e teste! 🚀
