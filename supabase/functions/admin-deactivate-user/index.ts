// admin-deactivate-user
// Inativa um usuario: bane no auth.users, marca status=inativo,
// cancela avaliacoes em aberto e devolve a lista de subordinados orfaos.
//
// Body: { "user_id": "<uuid>", "reason": "Desligamento", "ban_duration": "876600h" }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { client } = await requireAdmin(req);
    const { user_id, reason, ban_duration } = await req.json();
    if (!user_id) return jsonResponse({ error: "user_id obrigatorio" }, 400);

    // 1. Chama RPC do banco (cancela evaluations + audit + status=inativo)
    const { error: rpcErr } = await client.rpc("deactivate_user", {
      p_user_id: user_id,
      p_reason: reason ?? null,
    });
    if (rpcErr) return jsonResponse({ error: rpcErr.message }, 400);

    // 2. Bane o usuario no auth.users (default: 100 anos)
    const { error: banErr } = await client.auth.admin.updateUserById(user_id, {
      ban_duration: ban_duration ?? "876600h",
    });
    if (banErr) {
      console.error("Ban error:", banErr);
      // Continua - o usuario ja esta marcado como inativo
    }

    // 3. Lista subordinados orfaos para o RH reatribuir
    const { data: orphans } = await client
      .from("profiles")
      .select("id, full_name, email")
      .eq("manager_id", user_id)
      .eq("status", "ativo");

    return jsonResponse({
      ok: true,
      orphans: orphans ?? [],
      orphan_count: (orphans ?? []).length,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "UNAUTHENTICATED") return jsonResponse({ error: msg }, 401);
    if (msg === "FORBIDDEN") return jsonResponse({ error: msg }, 403);
    return jsonResponse({ error: msg }, 500);
  }
});
