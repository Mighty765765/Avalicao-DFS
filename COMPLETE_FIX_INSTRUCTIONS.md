# 🔧 MIGRATION_06_COMPLETE_FIX_v2 - Instruções de Aplicação

## ❌ Erros Encontrados e Corrigidos

| Erro | Problema | Solução |
|------|----------|---------|
| **Erro 1** | RLS policy bloqueava drop de function | Dropar `answers_select` primeiro |
| **Erro 2** | `manager_can_see_self_eval()` usava `employee_id` (não existe em evaluations) | Usar `evaluee_id` |
| **Erro 3** | `finalize_manager_evaluation()` usava `employee_id` | Usar `evaluee_id` |
| **Erro 4** | `finalize_consensus()` usava `employee_id` | Usar `evaluee_id` |
| **Erro 5** | `v_consensus_side_by_side` referenciava `q.competency_block_id` inexistente | Remover coluna |
| **Erro 6** | `v_consensus_side_by_side` referenciava `q.position` inexistente | Remover coluna |
| **Erro 7** | RLS `answers_select` usava `e.employee_id` | Usar `e.evaluee_id` |

---

## ✅ Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado - Mais Seguro)

1. **Abra Supabase Dashboard**
   ```
   https://app.supabase.com
   ```

2. **Acesse SQL Editor**
   - Menu esquerdo → **SQL Editor**
   - Clique em **+ New Query**

3. **Cole o Script Completo**
   - Abra o arquivo: `MIGRATION_06_COMPLETE_FIX_v2.sql` (versão corrigida)
   - Copie TODO o conteúdo
   - Cole no SQL Editor do Supabase

4. **Execute**
   - Clique no botão **▶ Run** ou pressione `Ctrl+Enter`

5. **Verificação**
   ```
   ✓ Se aparecer "success" no final, tudo correu bem!
   ✗ Se aparecer erro, copie e informe
   ```

---

### Opção 2: Via Node.js Script (Automático)

Se preferir executar via script (requer SUPABASE_SERVICE_ROLE_KEY):

```bash
# 1. Configure a chave (escolha uma forma):

# Windows CMD:
set SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui

# Windows PowerShell:
$env:SUPABASE_SERVICE_ROLE_KEY="sua_chave_aqui"

# Linux/Mac:
export SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui

# 2. Execute o script:
node apply-migration-sdk.js
```

---

## 📋 O que o FIX Faz (8 Passos)

### Passo 1: Droppar RLS Policy
- Remove `answers_select` que dependia das funções a alterar

### Passo 2-4: Corrigir Funções de Evaluations
- ✓ `manager_can_see_self_eval()` → usa `evaluee_id`
- ✓ `finalize_self_evaluation()` → usa `evaluee_id`
- ✓ `finalize_manager_evaluation()` → usa `evaluee_id`

### Passo 5: Corrigir Função finalize_consensus()
- Usa `evaluee_id` ao inserir em `pdi` (que espera `employee_id`)

### Passo 6: Corrigir View v_consensus_side_by_side
- Remove referência a `q.competency_block_id` (coluna não existe)
- Remove referência a `q.position` (coluna não existe)
- Mantém apenas colunas que existem: id, text
- Mantém todas as JOINs de answers (self, manager, consensus)

### Passo 7: Recriar RLS Policy answers_select
- Usa `evaluee_id` agora (não `employee_id`)
- Permite acesso correto a manager_can_see_self_eval()

### Passo 8: ReGrantar Permissões
- Garante que as funções possam ser chamadas por usuários autenticados

**Tempo estimado:** 15-30 segundos

---

## ✔️ Verificação Pós-FIX

Execute estas queries no SQL Editor para confirmar:

```sql
-- 1. Verificar functions existem
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'manager_can_see_self_eval', 
  'finalize_self_evaluation',
  'finalize_manager_evaluation', 
  'finalize_consensus'
)
ORDER BY proname;

-- Esperado: 4 registros

-- 2. Verificar view existe
SELECT table_name 
FROM information_schema.views 
WHERE table_name = 'v_consensus_side_by_side';

-- Esperado: 1 registro (v_consensus_side_by_side)

-- 3. Verificar policy existe
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'answers' AND policyname = 'answers_select';

-- Esperado: 1 registro (answers_select)

-- 4. Testar função (com UUID real):
-- Substitua 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' por um UUID real de evaluation
SELECT public.manager_can_see_self_eval('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid);

-- Esperado: true ou false (sem erro de coluna)
```

Se TODOS retornarem resultados esperados → ✓ **FIX foi aplicado com sucesso!**

---

## 🎯 Próximos Passos

Após aplicar o FIX:

1. **Reinicie o servidor dev**
   ```bash
   npm run dev
   ```

2. **Teste a funcionalidade completa:**
   - ✅ Criar nova avaliação (como colaborador)
   - ✅ Gestor visualizar e finalizar avaliação
   - ✅ Abrir consenso automaticamente
   - ✅ Gestor criar PDI com seleção de questões
   - ✅ Colaborador visualizar e atualizar ações do PDI
   - ✅ Gestor finalizar/desfinalizar ações

3. **Verifique que NÃO aparecem erros:**
   - ❌ "column 'employee_id' does not exist"
   - ❌ "column 'competency_block_id' does not exist"
   - ❌ "Cannot drop function... other objects depend"
   - ❌ Edge Function returned non-2xx status code

---

## 🐛 Se Ainda Houver Erro...

### Cenário 1: "already exists" ao executar
```
⚠️ É normal! O script tenta dropar primeiro
→ Clique **Run** novamente (geralmente funciona na 2ª tentativa)
```

### Cenário 2: Erro sobre coluna que não existe
```
→ Copie a mensagem de erro completa
→ Envie para debug (pode haver outra coluna diferente)
```

### Cenário 3: RLS policy error
```
→ Execute um `SELECT * FROM pg_policies;` 
→ Verifique se 'answers_select' foi dropada
```

---

## 🚀 Resumo

| Item | Status | Detalhes |
|------|--------|----------|
| **Arquivo FIX** | ✅ PRONTO | `MIGRATION_06_COMPLETE_FIX_v2.sql` |
| **Instruções** | ✅ PRONTO | Este arquivo |
| **Erros Corrigidos** | ✅ 7 ERROS | Veja tabela no início |
| **Aplicação** | ✅ FÁCIL | 2 opções (Dashboard ou Script) |
| **Tempo** | ⏱️ 15-30s | Rápido e seguro |

---

**Tudo certo? Execute o FIX agora!** 🚀
