// notify-pdi-events
// Funcao unica para os 4 disparos de email do fluxo de PDI.
//
// Body: { "event": <event_type>, ...params }
//
// event_type:
//   - "pdi_published"          { pdi_id }
//   - "action_due_soon"        { action_id }
//   - "action_completed_by_employee" { action_id }
//   - "action_late"            { action_id }   (chamado por cron diario)
//
// Pode ser chamada pelo frontend (usando JWT do gestor/colaborador) OU
// por um cron Postgres usando service-role.
//
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/auth.ts";
import { sendEmail, emailLayout, ctaButton } from "../_shared/email.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://avaliacao.dfs.com.br";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const event = body.event as string;
    const client = serviceClient();

    switch (event) {
      case "pdi_published":
        await handlePdiPublished(client, body.pdi_id);
        break;
      case "action_due_soon":
        await handleActionDueSoon(client, body.action_id);
        break;
      case "action_completed_by_employee":
        await handleEmployeeCompleted(client, body.action_id);
        break;
      case "action_late":
        await handleActionLate(client, body.action_id);
        break;
      default:
        return jsonResponse({ error: "event invalido" }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

// ---------------------------------------------------------------------
async function handlePdiPublished(client: any, pdiId: string) {
  const { data: pdi } = await client
    .from("pdi")
    .select(
      "id, employee:employee_id(full_name,email), manager:manager_id(full_name)"
    )
    .eq("id", pdiId)
    .single();
  if (!pdi?.employee?.email) return;
  await sendEmail({
    to: pdi.employee.email,
    subject: "[DFS] Seu PDI esta disponivel",
    html: emailLayout(
      `<h2 style="color:#012639;margin:0 0 12px;">PDI disponivel para sua ciencia</h2>
       <p>Ola, <b>${pdi.employee.full_name}</b>.</p>
       <p>Seu Plano de Desenvolvimento Individual foi publicado pelo gestor
          <b>${pdi.manager?.full_name ?? ""}</b>.</p>
       <p>Acesse a plataforma, leia o plano e registre sua ciencia para liberar
          o preenchimento das acoes.</p>
       ${ctaButton(`${APP_URL}/app/colaborador/pdi`, "Acessar meu PDI")}`,
      "PDI publicado"
    ),
  });
}

// ---------------------------------------------------------------------
async function handleActionDueSoon(client: any, actionId: string) {
  const { data: row } = await client
    .from("v_pdi_actions_pending")
    .select("*")
    .eq("action_id", actionId)
    .single();
  if (!row?.employee_email) return;
  await sendEmail({
    to: row.employee_email,
    subject: "[DFS] Acao do PDI vence em breve",
    html: emailLayout(
      `<h2 style="color:#012639;margin:0 0 12px;">Lembrete de prazo</h2>
       <p>Ola, <b>${row.employee_name}</b>.</p>
       <p>A acao <b>${escapeHtml(row.description)}</b> do seu PDI tem prazo final em
          <b>${row.end_date}</b>.</p>
       <p>Atualize o andamento na plataforma para que seu gestor acompanhe.</p>
       ${ctaButton(`${APP_URL}/app/colaborador/pdi`, "Atualizar agora")}`,
      "Prazo proximo"
    ),
  });
}

// ---------------------------------------------------------------------
async function handleEmployeeCompleted(client: any, actionId: string) {
  const { data: row } = await client
    .from("v_pdi_actions_pending")
    .select("*")
    .eq("action_id", actionId)
    .single();
  if (!row) return;

  const { data: mgr } = await client
    .from("profiles")
    .select("email, full_name")
    .eq("id", row.manager_id)
    .single();
  if (!mgr?.email) return;

  await sendEmail({
    to: mgr.email,
    subject: "[DFS] Acao do PDI marcada como concluida pelo colaborador",
    html: emailLayout(
      `<h2 style="color:#012639;margin:0 0 12px;">Acao aguardando validacao</h2>
       <p>Ola, <b>${mgr.full_name}</b>.</p>
       <p><b>${row.employee_name}</b> marcou a acao <b>${escapeHtml(row.description)}</b>
          como concluida.</p>
       <p>Valide e finalize a acao na plataforma.</p>
       ${ctaButton(`${APP_URL}/app/gestor/pdi/validar`, "Validar acao")}`,
      "Acao concluida pelo colaborador"
    ),
  });
}

// ---------------------------------------------------------------------
async function handleActionLate(client: any, actionId: string) {
  const { data: row } = await client
    .from("v_pdi_actions_pending")
    .select("*")
    .eq("action_id", actionId)
    .single();
  if (!row) return;
  const { data: mgr } = await client
    .from("profiles")
    .select("email, full_name")
    .eq("id", row.manager_id)
    .single();
  if (!mgr?.email) return;

  await sendEmail({
    to: mgr.email,
    cc: row.employee_email,
    subject: `[DFS] Acao em atraso (${row.days_late} dias)`,
    html: emailLayout(
      `<h2 style="color:#012639;margin:0 0 12px;">Acao em atraso</h2>
       <p>A acao <b>${escapeHtml(row.description)}</b> do PDI de
          <b>${row.employee_name}</b> esta em atraso ha <b>${row.days_late} dias</b>.</p>
       <p>Avalie com a equipe se a acao sera concluida ou repactuada.</p>
       ${ctaButton(`${APP_URL}/app/gestor/pdi/validar`, "Acompanhar")}`,
      "Acao em atraso"
    ),
  });
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
