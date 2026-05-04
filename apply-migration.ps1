# Script PowerShell para aplicar Migration 06 - Consenso PDI Workflow

$PROJECT_REF = "ehhcgnjcvpgcgcmhaovg"
$MIGRATION_FILE = "supabase/migrations/20260427_06_consensus_pdi_workflow.sql"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Aplicando Migration 06" -ForegroundColor Cyan
Write-Host "Project: $PROJECT_REF" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Opção 1: Via supabase CLI
Write-Host "Tentando aplicar via Supabase CLI..." -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: Você será redirecionado para fazer login no Supabase" -ForegroundColor Magenta
Read-Host "Pressione ENTER para continuar"

Write-Host ""
Write-Host "Fazendo login..." -ForegroundColor Yellow
npx supabase login

Write-Host ""
Write-Host "Linkando ao projeto..." -ForegroundColor Yellow
npx supabase link --project-ref $PROJECT_REF

Write-Host ""
Write-Host "Aplicando migration..." -ForegroundColor Yellow
npx supabase migration up

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✅ Migration 06 aplicada com sucesso!" -ForegroundColor Green
  Write-Host ""
  Write-Host "Próximos passos:" -ForegroundColor Green
  Write-Host "1. Reinicie o servidor de desenvolvimento (npm run dev)" -ForegroundColor Gray
  Write-Host "2. Teste criando um novo PDI" -ForegroundColor Gray
  Write-Host "3. Tente finalizar uma ação" -ForegroundColor Gray
} else {
  Write-Host ""
  Write-Host "❌ Erro ao aplicar migration" -ForegroundColor Red
  Write-Host ""
  Write-Host "Alternativa: Aplicar manualmente via Supabase Dashboard" -ForegroundColor Yellow
  Write-Host "1. Acesse: https://app.supabase.com" -ForegroundColor Gray
  Write-Host "2. Selecione seu projeto" -ForegroundColor Gray
  Write-Host "3. Vá em SQL Editor" -ForegroundColor Gray
  Write-Host "4. Cole o conteúdo de: $MIGRATION_FILE" -ForegroundColor Gray
  Write-Host "5. Execute" -ForegroundColor Gray
}
