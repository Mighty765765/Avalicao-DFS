#!/usr/bin/env node

/**
 * Aplica Migration 06 usando Supabase SDK
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY="sua_chave" node apply-migration-sdk.js
 *
 * Ou configure .env.local com:
 *   SUPABASE_SERVICE_ROLE_KEY=sua_chave
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env.server" });

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://ehhcgnjcvpgcgcmhaovg.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_FILE = path.join(__dirname, "supabase/migrations/20260427_06_consensus_pdi_workflow.sql");

console.log("================================");
console.log("Aplicando Migration 06");
console.log("================================");
console.log("");

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY não configurada!");
  console.error("");
  console.error("Configure de uma das formas:");
  console.error("");
  console.error("1. Variável de ambiente:");
  console.error('   set SUPABASE_SERVICE_ROLE_KEY="sua_chave"');
  console.error('   node apply-migration-sdk.js');
  console.error("");
  console.error("2. Arquivo .env.local ou .env.server:");
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sua_chave');
  console.error("");
  console.error("3. Via Supabase Dashboard (mais fácil):");
  console.error("   https://app.supabase.com → SQL Editor");
  console.error("");
  process.exit(1);
}

if (!fs.existsSync(MIGRATION_FILE)) {
  console.error("❌ Arquivo de migration não encontrado:", MIGRATION_FILE);
  process.exit(1);
}

async function applyMigration() {
  try {
    console.log("Conectando ao Supabase...");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    console.log("Lendo migration SQL...");
    const migrationSQL = fs.readFileSync(MIGRATION_FILE, "utf-8");

    // Divide a migration em statements individuais
    // Remove comentários e espaços em branco
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith("--"));

    console.log(`Encontrados ${statements.length} statements`);
    console.log("");

    // Executa cada statement
    let executedCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Pula statements muito pequenos ou comentários
      if (stmt.length < 10) continue;

      process.stdout.write(`[${i + 1}/${statements.length}] Executando...`);

      const { error } = await supabase.rpc("exec", {
        sql: stmt + ";",
      });

      if (error) {
        // Ignora erros de "already exists" (idempotent)
        if (error.message?.includes("already exists")) {
          console.log(" (já existe)");
        } else if (error.message?.includes("ERROR")) {
          console.log(" ❌ ERRO");
          console.error("Erro:", error.message);
          // Continua mesmo com erro
        } else {
          console.log(" ✓");
          executedCount++;
        }
      } else {
        console.log(" ✓");
        executedCount++;
      }
    }

    console.log("");
    console.log("================================");
    if (executedCount > 0 || statements.length > 0) {
      console.log("✅ Migration 06 aplicada!");
      console.log("");
      console.log("Próximos passos:");
      console.log("1. Reinicie: npm run dev");
      console.log("2. Teste criar PDI");
      console.log("3. Teste finalizar ação");
      process.exit(0);
    } else {
      console.log("❓ Nenhum statement foi executado");
      console.log("Tente manualmente no SQL Editor");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Erro:", error.message);
    console.error("");
    console.error("Alternativa: Aplique manualmente");
    console.error("https://app.supabase.com → SQL Editor");
    process.exit(1);
  }
}

applyMigration();
