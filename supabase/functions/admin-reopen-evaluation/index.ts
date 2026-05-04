// admin-reopen-evaluation
// Reabre uma avaliacao finalizada. Apenas admin. Motivo obrigatorio (>=30 chars).
// Notifica o avaliador por e-mail.
//
// Body: { "evaluation_id": "<uuid>", "reason": "..." }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { sendEmail, emailLayout, ctaButton } from "../_shared/email.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { client } = await requireAdmin(req);
    const { evaluation_id, reason } = await req.json();

    if (!evaluation_id) return jsonResponse({ error: "evaluation_id obrigatorio" }, 400);
    if (!reason || reason.trim().length < 30) {
      return jsonResponse(
        { error: "Motivo obrigatorio (minimo 30 caracteres)" },
        400
      );
    }

    // 1. RPC valida e reabre
    const { error: rpcErr } = await client.rpc("reopen_evaluation", {
      p_evaluation_id: evaluation_id,
      p_reason: reason,
    });
    if (rpcErr) return jsonResponse({ error: rpcErr.message }, 400);

    // 2. Busca dados para o e-mail
    const { data: ev } = await client
      .from("evaluations")
      .select(
        "id, type, evaluator_id, evaluee_id, cycle_id, profiles:evaluator_id(full_name, email), evaluee:evaluee_id(full_name)"
      )
      .eq("id", evaluation_id)
      .single();

    const evaluator = (ev as any)?.profiles;
    const evaluee = (ev as any)?.evaluee;

    if (evaluator?.email) {
      const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
      const tipoLabel =
        ev?.type === "self"
          ? "sua autoavaliacao"
          : ev?.type === "manager"
          ? `a avaliacao de ${evaluee?.full_name ?? ""}`
          : "a avaliacao de consenso";

      try {
        await sendEmail({
          to: evaluator.email,
          subject: "[DFS] Avaliacao reaberta pelo RH",
          html: emailLayout(
            `<h2 style="color:#012639;margin:0 0 12px;">Avaliacao reaberta</h2>
             <p>Ola, <b>${evaluator.full_name}</b>.</p>
             <p>O RH reabriu ${tipoLabel} para ajustes.</p>
             <p><b>Motivo informado:</b><br>
                <span style="color:#334155">${reason}</span></p>
             ${ctaButton(appUrl, "Acessar e revisar")}`,
            "Avaliacao reaberta"
          ),
        });
      } catch (mailErr) {
        console.error("SMTP error:", mailErr);
      }
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "UNAUTHENTICATED") return jsonResponse({ error: msg }, 401);
    if (msg === "FORBIDDEN") return jsonResponse({ error: msg }, 403);
    return jsonResponse({ error: msg }, 500);
  }
});
