#!/bin/bash
# Script para aplicar Migration 06 - Consenso PDI Workflow

PROJECT_REF="ehhcgnjcvpgcgcmhaovg"
MIGRATION_FILE="supabase/migrations/20260427_06_consensus_pdi_workflow.sql"

echo "================================"
echo "Aplicando Migration 06"
echo "Project: $PROJECT_REF"
echo "================================"
echo ""

# Opção 1: Via supabase CLI (recomendado)
echo "Tentando aplicar via Supabase CLI..."
echo ""
echo "IMPORTANTE: Você será redirecionado para fazer login no Supabase"
echo "Pressione ENTER para continuar..."
read

npx supabase login

echo ""
echo "Linkando ao projeto..."
npx supabase link --project-ref $PROJECT_REF

echo ""
echo "Aplicando migration..."
npx supabase migration up

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration 06 aplicada com sucesso!"
  echo ""
  echo "Próximos passos:"
  echo "1. Reinicie o servidor de desenvolvimento (npm run dev)"
  echo "2. Teste criando um novo PDI"
  echo "3. Tente finalizar uma ação"
else
  echo ""
  echo "❌ Erro ao aplicar migration"
  echo ""
  echo "Alternativa: Aplicar manualmente via Supabase Dashboard"
  echo "1. Acesse: https://app.supabase.com"
  echo "2. Selecione seu projeto"
  echo "3. Vá em SQL Editor"
  echo "4. Cole o conteúdo de: $MIGRATION_FILE"
  echo "5. Execute"
fi
