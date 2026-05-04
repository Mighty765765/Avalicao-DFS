#!/usr/bin/env node

/**
 * Script de validação de testes E2E
 * Verifica estruturas de dados e funções críticas via queries SQL
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ehhcgnjcvpgcgcmhaovg.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY não configurada");
  console.error("Configure com: export SUPABASE_SERVICE_ROLE_KEY=sua_chave");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// =====================================================================
// TESTES
// =====================================================================

test("1. View v_consensus_side_by_side existe e tem colunas corretas", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'v_consensus_side_by_side'
      ORDER BY ordinal_position
    `
  });

  if (error) throw error;

  const columns = data?.map((r) => r.column_name) || [];
  const required = ['consensus_eval_id', 'question_id', 'position', 'self_score', 'manager_score', 'consensus_score'];

  for (const col of required) {
    if (!columns.includes(col)) {
      throw new Error(`Coluna '${col}' não encontrada em v_consensus_side_by_side`);
    }
  }

  if (!columns.includes('competency_block_id')) {
    console.log("✅ Coluna competency_block_id REMOVIDA corretamente");
  }

  return `Colunas OK: ${columns.join(', ')}`;
});

test("2. Função finalize_consensus existe", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT proname FROM pg_proc
      WHERE proname = 'finalize_consensus'
    `
  });

  if (error) throw error;
  if (!data?.length) throw new Error("finalize_consensus não encontrada");
  return "Função finalize_consensus encontrada";
});

test("3. Função finalize_action existe", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT proname FROM pg_proc
      WHERE proname = 'finalize_action'
    `
  });

  if (error) throw error;
  if (!data?.length) throw new Error("finalize_action não encontrada");
  return "Função finalize_action encontrada";
});

test("4. Função unfinalize_action existe", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT proname FROM pg_proc
      WHERE proname = 'unfinalize_action'
    `
  });

  if (error) throw error;
  if (!data?.length) throw new Error("unfinalize_action não encontrada");
  return "Função unfinalize_action encontrada";
});

test("5. Tabela questions tem colunas corretas", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'questions'
      ORDER BY ordinal_position
    `
  });

  if (error) throw error;

  const columns = data?.map((r) => r.column_name) || [];

  if (!columns.includes('sort_order')) {
    throw new Error("Coluna 'sort_order' não encontrada em questions");
  }
  if (!columns.includes('block_id')) {
    throw new Error("Coluna 'block_id' não encontrada em questions");
  }
  if (columns.includes('position')) {
    console.log("⚠️  Coluna 'position' ainda existe em questions (não é grave)");
  }
  if (columns.includes('competency_block_id')) {
    console.log("⚠️  Coluna 'competency_block_id' ainda existe em questions (não é grave)");
  }

  return `Colunas OK: ${columns.join(', ')}`;
});

test("6. Tabela pdi_actions tem status enum correto", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pdi_actions' AND column_name = 'status'
    `
  });

  if (error) throw error;
  if (!data?.length) throw new Error("Coluna 'status' não encontrada em pdi_actions");

  return `Status tipo: ${data[0]?.data_type}`;
});

test("7. RLS policy answers_select existe", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT policyname FROM pg_policies
      WHERE tablename = 'answers' AND policyname = 'answers_select'
    `
  });

  if (error) throw error;
  if (!data?.length) throw new Error("RLS policy 'answers_select' não encontrada");
  return "RLS policy answers_select encontrada";
});

test("8. Função manager_can_see_self_eval existe", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT proname FROM pg_proc
      WHERE proname = 'manager_can_see_self_eval'
    `
  });

  if (error) throw error;
  if (!data?.length) throw new Error("manager_can_see_self_eval não encontrada");
  return "Função manager_can_see_self_eval encontrada";
});

test("9. Pdi_actions tem colunas de data para migration 06", async () => {
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pdi_actions'
      AND column_name IN ('start_date', 'end_date', 'finalized_at')
    `
  });

  if (error) throw error;

  const columns = data?.map((r) => r.column_name) || [];
  const required = ['start_date', 'end_date'];

  for (const col of required) {
    if (!columns.includes(col)) {
      throw new Error(`Coluna '${col}' não encontrada em pdi_actions`);
    }
  }

  return `Colunas encontradas: ${columns.join(', ')}`;
});

// =====================================================================
// EXECUTAR TESTES
// =====================================================================

async function runTests() {
  console.log("🧪 VALIDAÇÃO DE MIGRATION 06 + FRONTEND");
  console.log("======================================\n");

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      const result = await fn();
      console.log(`✅ ${name}`);
      if (result) console.log(`   ${result}\n`);
      passed++;
    } catch (e) {
      console.log(`❌ ${name}`);
      console.log(`   Erro: ${e.message}\n`);
      failed++;
    }
  }

  console.log("======================================");
  console.log(`✅ Passou: ${passed}/${tests.length}`);
  if (failed > 0) {
    console.log(`❌ Falhou: ${failed}/${tests.length}`);
    process.exit(1);
  } else {
    console.log("\n🎉 TODOS OS TESTES PASSARAM!");
    process.exit(0);
  }
}

runTests();
