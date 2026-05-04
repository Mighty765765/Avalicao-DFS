# 🧹 Instruções de Limpeza Completa da Base

**Data:** 2026-05-02  
**Status:** ⚠️ OPERAÇÃO DESTRUTIVA  
**Backup:** ✅ OBRIGATÓRIO fazer backup ANTES de prosseguir

---

## 📋 O que será deletado

✅ **DELETARÁ:**
- ❌ Todos os colaboradores (não-admin)
- ❌ Todos os gestores (não-admin)
- ❌ Todas as avaliações (self, manager, consensus)
- ❌ Todas as respostas de avaliações
- ❌ Todos os PDIs e ações de PDI
- ❌ Todos os ciclos de avaliação
- ❌ Todos os registros de feedback
- ❌ Histórico de atribuição de gestores
- ❌ Histórico de auditoria (exceto admin)

✅ **MANTÉM:**
- ✅ Admin (ativo)
- ✅ Departments (Áreas)
- ✅ Positions (Cargos)
- ✅ Competency Blocks (Blocos de Competência)
- ✅ Questions (Perguntas)

---

## 🚀 Passo-a-Passo da Limpeza

### Passo 1️⃣: Backup do Banco (CRÍTICO!)

```bash
# Via Supabase CLI:
supabase db pull --local

# Ou manualmente: Supabase Dashboard → Backups → Request backup
```

### Passo 2️⃣: Executar Limpeza do Public Schema

1. Abra: **Supabase Dashboard → SQL Editor**
2. Abra arquivo: `CLEANUP_COMPLETE.sql`
3. Cole TODO o conteúdo
4. Clique em **Run** (ou Ctrl+Enter)
5. Aguarde conclusão

**Esperado:**
```
Profiles (deve mostrar apenas admin): 1
Evaluations (deve ser 0): 0
Answers (deve ser 0): 0
PDI (deve ser 0): 0
PDI Actions (deve ser 0): 0
```

### Passo 3️⃣: Deploy da Edge Function (admin-cleanup-users)

```bash
cd "Avaliação de Desempenho RH/dfs-avaliacao"
SUPABASE_ACCESS_TOKEN="seu_token_aqui" \
  npx supabase functions deploy admin-cleanup-users
```

### Passo 4️⃣: Executar Cleanup dos auth.users

**Via cURL:**

```bash
curl -X POST https://ehhcgnjcvpgcgcmhaovg.supabase.co/functions/v1/admin-cleanup-users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm_delete": true}'
```

**Ou via Supabase Client (JavaScript):**

```typescript
const { data, error } = await supabase.functions.invoke("admin-cleanup-users", {
  body: { confirm_delete: true }
});

if (error) {
  console.error("Erro na limpeza:", error);
} else {
  console.log("Resultado:", data);
  // Esperado: { deleted_count: X, message: "X usuarios deletados. 1 admins mantidos." }
}
```

### Passo 5️⃣: Verificação Final

1. **Supabase Dashboard → Authentication → Users**
   - Deve mostrar apenas: admin@... (1 usuario)

2. **Supabase Dashboard → SQL Editor** → Execute:
   ```sql
   SELECT role, status, COUNT(*) as count
   FROM public.profiles
   GROUP BY role, status;
   ```
   - Esperado: 1 line com `admin | ativo | 1`

---

## 🔄 Passo-a-Passo para Recriar Usuários Teste

Depois de limpo, crie novos usuários via Admin Panel:

1. Acesse: `/app/admin/colaboradores`
2. Clique em **Novo**
3. Preencha:
   - **Nome:** Ex. "João Silva"
   - **E-mail:** Ex. "joao@example.com"
   - **Papel:** Colaborador / Gestor / Admin
   - **Senha inicial:** Gerar automaticamente

4. Usuário receberá email com senha provisória
5. No primeiro acesso, será obrigado a trocar a senha

---

## ⚠️ Problemas Conhecidos e Soluções

### Erro: "User not found" ao resetar senha
**Causa:** Perfil existe mas não há auth.user
**Solução:** Usar admin panel para recriar o usuário

### Erro: "Permission denied" ao executar SQL
**Causa:** RLS policies bloqueando DELETE
**Solução:** Usar `TEMPORARILY` disable triggers (já feito no script)

### Função não faz nada ao ser chamada
**Causa:** Falta confirmacao (confirm_delete != true)
**Solução:** Enviar `{ "confirm_delete": true }` no body

---

## 📊 Queries de Verificação Úteis

```sql
-- Ver contagem de cada tabela
SELECT 'Profiles' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL SELECT 'Evaluations', COUNT(*) FROM public.evaluations
UNION ALL SELECT 'Answers', COUNT(*) FROM public.answers
UNION ALL SELECT 'PDI', COUNT(*) FROM public.pdi
UNION ALL SELECT 'Cycles', COUNT(*) FROM public.cycles;

-- Ver detalhes dos usuarios (auth.users)
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC;

-- Ver profiles vs auth.users (orphans)
SELECT p.id, p.full_name, p.email, p.role
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;
```

---

## 🆘 Restaurar do Backup

Se algo der errado:

```bash
# Via Supabase CLI:
supabase db push --local

# Ou manualmente: Supabase Dashboard → Backups → Restore
```

---

## ✅ Checklist Final

- [ ] Backup realizado
- [ ] Script SQL executado com sucesso
- [ ] Edge Function deployado
- [ ] admin-cleanup-users chamado com confirm_delete: true
- [ ] Verificação: profiles mostra apenas 1 admin
- [ ] Verificação: evaluations = 0
- [ ] Verificação: pdi = 0
- [ ] Novos usuários teste criados
- [ ] Teste de fluxo: criar avaliação → PDI → Dashboard

---

**Pronto! Base limpa e pronta para testes com dados reais.** 🎉
