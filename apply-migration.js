#!/usr/bin/env node

/**
 * Script para aplicar Migration 06 diretamente ao Supabase
 * Uso: node apply-migration.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_REF = "ehhcgnjcvpgcgcmhaovg";
const MIGRATION_FILE = path.join(__dirname, "supabase/migrations/20260427_06_consensus_pdi_workflow.sql");

// Lê a chave de serviço do .env.server ou variável de ambiente
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.log("❌ SUPABASE_SERVICE_ROLE_KEY não encontrada!");
  console.log("");
  console.log("Para aplicar a migration, siga um desses passos:");
  console.log("");
  console.log("Opção 1: Via variável de ambiente");
  console.log('  export SUPABASE_SERVICE_ROLE_KEY="sua_chave_aqui"');
  console.log("  node apply-migration.js");
  console.log("");
  console.log("Opção 2: Via Supabase Dashboard (recomendado)");
  console.log("  1. Acesse: https://app.supabase.com");
  console.log("  2. Selecione seu projeto");
  console.log("  3. Vá em SQL Editor");
  console.log("  4. Cole: " + MIGRATION_FILE);
  console.log("  5. Execute");
  console.log("");
  console.log("Opção 3: Via CLI");
  console.log("  npx supabase login");
  console.log("  npx supabase link --project-ref " + PROJECT_REF);
  console.log("  npx supabase migration up");
  process.exit(1);
}

console.log("================================");
console.log("Aplicando Migration 06");
console.log("Project: " + PROJECT_REF);
console.log("================================");
console.log("");

// Lê o arquivo de migration
if (!fs.existsSync(MIGRATION_FILE)) {
  console.error("❌ Arquivo de migration não encontrado:", MIGRATION_FILE);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(MIGRATION_FILE, "utf-8");

// Executa via API REST do Supabase
const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/sql_execute`;

const postData = JSON.stringify({
  query: migrationSQL,
});

const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  port: 443,
  path: "/rest/v1/rpc/sql_execute",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": postData.length,
    Authorization: `Bearer ${serviceRoleKey}`,
    "apikey": serviceRoleKey,
  },
};

console.log("Enviando migration para Supabase...");
console.log("");

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("");

    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("✅ Migration 06 aplicada com sucesso!");
      console.log("");
      console.log("Próximos passos:");
      console.log("1. Reinicie o servidor: npm run dev");
      console.log("2. Teste criando um novo PDI");
      console.log("3. Tente finalizar uma ação (ValidarAcoesPage)");
      process.exit(0);
    } else {
      console.log("❌ Erro ao aplicar migration");
      console.log("");
      console.log("Resposta do servidor:");
      console.log(data);
      console.log("");
      console.log("Alternativa: Aplicar manualmente via Supabase Dashboard");
      console.log("https://app.supabase.com → SQL Editor → Cole o conteúdo de:");
      console.log(MIGRATION_FILE);
      process.exit(1);
    }
  });
});

req.on("error", (e) => {
  console.error("❌ Erro ao conectar ao Supabase:");
  console.error(e.message);
  console.log("");
  console.log("Alternativa: Aplicar manualmente");
  console.log("https://app.supabase.com → SQL Editor → Cole:");
  console.log(MIGRATION_FILE);
  process.exit(1);
});

req.write(postData);
req.end();
