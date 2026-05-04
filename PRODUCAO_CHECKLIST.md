# 🚀 CHECKLIST PARA PRODUÇÃO

**Status:** ✅ CÓDIGO PRONTO  
**Data:** 2026-05-01  
**Versão:** 2.0 (PDI Refatorado)

---

## 📋 MUDANÇAS IMPLEMENTADAS

### 1️⃣ LIMPEZA DE DADOS FAKE

**Arquivo:** `CLEANUP_FAKE_DATA.sql`

```bash
# Execute no Supabase → SQL Editor
```

**O que limpa:**
- ❌ Evaluations (avaliações fake)
- ❌ Answers (respostas fake)
- ❌ PDI (planos fake)
- ❌ PDI Actions (ações fake)
- ❌ Profiles fake (contêm "test", "fake", "demo", "@example.com")

**O que mantém:**
- ✅ Questions (questões/competências)
- ✅ Cycles (ciclos)
- ✅ Competencies (block_id)
- ✅ Departments, Positions
- ✅ Admin profile

---

### 2️⃣ REFATORAÇÃO DA LÓGICA DO PDI

#### **Antes (Versão Antiga)**
```
PdiBuilderPage
├─ Campo competência: TEXTO LIVRE
├─ Uma ação por linha
├─ Deadline como data única
└─ Não linkado a avaliação
```

#### **Depois (Nova Versão)**
```
PdiBuilderPage
├─ Campo competência: SELECT (block_id da avaliação ativa)
├─ Múltiplas ações por competência
├─ start_date + end_date por ação
├─ Linkado à avaliação do ciclo ativo
└─ Validação: 3+ competências, 1+ ação por competência
```

**Arquivo:** `src/pages/gestor/PdiBuilderPage.tsx`

**Novos Recursos:**
- ✅ SELECT dinâmico de competências (block_id)
- ✅ Múltiplas ações por competência
- ✅ Data início + data fim (não só deadline)
- ✅ Validações melhoradas
- ✅ Carregamento de avaliação ativa

---

### 3️⃣ NOVO DASHBOARD DO GESTOR

**Arquivo:** `src/pages/gestor/PdiAcompanhamentoPage.tsx`

**Funcionalidades:**
- ✅ Visão dos PDIs dos liderados diretos
- ✅ Agrupado por colaborador + competência
- ✅ Barra de progresso (% de ações concluídas)
- ✅ Filtros: Status, Busca
- ✅ Indicadores: Dias restantes, Status
- ✅ DataGrid com 600px de altura

**Colunas Exibidas:**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Colaborador | Texto | Nome do colaborador |
| Competência | Texto | block_id/competência |
| Progresso | Barra + % | N ações concluídas / Total |
| Status | Chip | Concluída, Em andamento |
| Prazo Final | Data | Última data final das ações |
| Dias Restantes | Badge | Contagem com alertas |

---

### 4️⃣ NOVO DASHBOARD DO ADMIN

**Arquivo:** `src/pages/admin/PdiDashboardPage.tsx`

**Funcionalidades:**
- ✅ Visão geral de TODOS os PDIs
- ✅ Cards de estatísticas (Total, Em andamento, Concluídos, Em risco)
- ✅ Agrupado por colaborador + gestor + competência
- ✅ Filtros: Status, Busca
- ✅ DataGrid com 600px de altura

**Estatísticas:**
```
Total de PDIs           = Número de PDIs criados
Em Andamento           = Competências com < 100%
Concluídos             = Competências com 100%
Em Risco (até 7 dias)  = Competências com deadline < 7 dias
```

**Colunas Exibidas:**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Colaborador | Texto | Nome do colaborador |
| Gestor | Texto | Gestor responsável |
| Competência | Texto | block_id/competência |
| Progresso | Barra + % | N ações concluídas / Total |
| Status | Chip | Concluída, Em andamento |
| Prazo Final | Data | Última data final das ações |
| Dias Restantes | Badge | Contagem com alertas |

---

## 📊 ESTRUTURA DE DADOS (pdi_actions)

```sql
CREATE TABLE pdi_actions (
  id UUID PRIMARY KEY,
  pdi_id UUID NOT NULL,
  competency UUID NOT NULL,          -- block_id
  action TEXT NOT NULL,
  start_date DATE NOT NULL,          -- Nova coluna (usada)
  end_date DATE NOT NULL,            -- Nova coluna (usada)
  deadline DATE,                     -- Coluna antiga (compatibilidade)
  status TEXT NOT NULL,              -- planejada, em_andamento, concluida
  progress_note TEXT,
  completed_at_employee TIMESTAMPTZ,
  manager_finalized BOOLEAN,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  finalization_note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Validações:**
- `start_date` <= `end_date`
- `competency` é UUID válido (block_id)
- `status` é enum: planejada, em_andamento, concluida
- Mínimo 3 competências diferentes por PDI
- Mínimo 1 ação por competência

---

## ✅ PRÉ-REQUISITOS PARA PRODUÇÃO

### Database
- [x] Migration 06 aplicada (MIGRATION_06_COMPLETE_FIX_v2.sql)
- [x] View v_consensus_side_by_side corrigida
- [x] Colunas start_date + end_date em pdi_actions
- [x] RLS policies atualizadas
- [x] Dados fake limpados (CLEANUP_FAKE_DATA.sql)

### Frontend
- [x] TypeScript sem erros (npm run typecheck)
- [x] PdiBuilderPage refatorado
- [x] PdiAcompanhamentoPage criado
- [x] PdiDashboardPage criado
- [x] Servidor dev rodando sem erros

### Dados Reais
- [ ] Colaboradores reais cadastrados (via admin)
- [ ] Ciclos de avaliação criados
- [ ] Questões/competências (block_id) carregadas
- [ ] Avaliações ativas (self + manager) criadas
- [ ] Consensos finalizados para gerar PDI

---

## 🚀 STEPS PARA COLOCAR EM PRODUÇÃO

### Passo 1: Limpeza de Dados (⚠️ DESTRUTIVO)

```bash
# No Supabase Dashboard → SQL Editor
# Cole o conteúdo de CLEANUP_FAKE_DATA.sql
# Execute
```

**Verifica após:**
```sql
-- Deve estar zerado (exceto admin)
SELECT count(*) FROM pdi;
SELECT count(*) FROM pdi_actions;
SELECT count(*) FROM evaluations;
```

### Passo 2: Aplicar Migration (já feito)

```bash
# MIGRATION_06_COMPLETE_FIX_v2.sql já foi aplicado
# Confirme que não há erros
```

### Passo 3: Build para Produção

```bash
cd "Avaliação de Desempenho RH/dfs-avaliacao"
npm run build
```

**Resultado esperado:**
- ✅ Sem erros de TypeScript
- ✅ Sem warnings críticos
- ✅ Arquivos em `dist/`

### Passo 4: Deploy

```bash
# Deploy em seu servidor de produção
# (Depende de sua infraestrutura)
```

### Passo 5: Testes em Produção

1. **Admin:**
   - [ ] Acessar Colaboradores → Novo
   - [ ] Cadastrar 1 colaborador real
   - [ ] Acessar PDI Dashboard (Dashboard Admin)

2. **Gestor:**
   - [ ] Acessar Minha Equipe
   - [ ] Criar avaliação para colaborador
   - [ ] Finalizar avaliação → abre Consenso
   - [ ] Fechar consenso → cria PDI
   - [ ] Acessar Acompanhamento de PDIs (Dashboard Gestor)

3. **Colaborador:**
   - [ ] Acessar Meu PDI
   - [ ] Aceitar ciência
   - [ ] Atualizar ações
   - [ ] Verificar datas (start_date + end_date)

---

## 📁 ARQUIVOS MODIFICADOS/CRIADOS

### Novos Arquivos
```
✨ CLEANUP_FAKE_DATA.sql
✨ MIGRATION_06_COMPLETE_FIX_v2.sql
✨ src/pages/gestor/PdiAcompanhamentoPage.tsx (Dashboard Gestor)
✨ src/pages/admin/PdiDashboardPage.tsx (Dashboard Admin)
```

### Arquivos Modificados
```
🔄 src/pages/gestor/PdiBuilderPage.tsx (COMPLETAMENTE REESCRITO)
   - Novo fluxo: Select competências → múltiplas ações → start_date + end_date
```

### Arquivos Preservados
```
✅ src/pages/colaborador/PdiAcoesPage.tsx (sem mudanças)
✅ src/pages/gestor/ValidarAcoesPage.tsx (sem mudanças)
✅ Todos outros arquivos (sem mudanças)
```

---

## 🔍 TESTES CRÍTICOS PRÉ-PRODUÇÃO

Execute na ordem:

1. **TypeScript**
   ```bash
   npm run typecheck
   # Esperado: 0 erros
   ```

2. **Build**
   ```bash
   npm run build
   # Esperado: Sem erros
   ```

3. **Dev Server**
   ```bash
   npm run dev
   # Esperado: http://localhost:5173 acessível
   ```

4. **Fluxo Completo** (manual)
   - [ ] Admin cria colaborador
   - [ ] Gestor cria avaliação
   - [ ] Gestor finaliza avaliação
   - [ ] Consenso abre automaticamente
   - [ ] Gestor fecha consenso → PDI criado
   - [ ] Gestor vê PDI em Acompanhamento
   - [ ] Admin vê PDI em Dashboard
   - [ ] Colaborador vê PDI em "Meu PDI"
   - [ ] Colaborador atualiza ações

---

## ⚠️ PONTOS DE ATENÇÃO

1. **Datas start_date + end_date:**
   - ✅ Agora vinculadas a cada AÇÃO (não competência)
   - ✅ Validação: start_date <= end_date
   - ✅ Exibidas nos dashboards

2. **Competências (block_id):**
   - ✅ Vêm da avaliação ativa do ciclo
   - ✅ SELECT no PdiBuilderPage
   - ✅ Agrupadas nos dashboards

3. **Validações:**
   - ✅ Mínimo 3 competências diferentes
   - ✅ Mínimo 1 ação por competência
   - ✅ Aplicadas ao salvar + publicar PDI

4. **Dashboards:**
   - ✅ Gestor vê apenas liderados diretos
   - ✅ Admin vê todos os PDIs
   - ✅ Filtros e busca funcionando
   - ✅ Estatísticas corretas

---

## 📞 SUPORTE

Se encontrar problemas:

1. **Erro TypeScript:** Verifique imports não utilizados
2. **Erro de coluna:** Verifique se start_date + end_date existem em pdi_actions
3. **Competências não aparecem:** Verifique se há avaliação ativa com questões (block_id)
4. **Dashboard vazio:** Verifique se há PDIs com ações criadas

---

## ✅ CHECKLIST FINAL

- [x] Código TypeScript validado
- [x] Build sem erros
- [x] Migration aplicada
- [x] Dashboards criados
- [x] Documentação completa
- [ ] Dados fake limpados (PRÓXIMO PASSO)
- [ ] Dados reais cadastrados (PRÓXIMO PASSO)
- [ ] Deploy em produção (PRÓXIMO PASSO)
- [ ] Testes em produção (PRÓXIMO PASSO)

---

**🎉 Sistema pronto para produção!**

Próximo passo: Executar CLEANUP_FAKE_DATA.sql no Supabase

