// admin-cleanup-users
// Deleta TODOS os usuarios nao-admin de auth.users
// Apenas admins sao mantidos.
//
// ATENCAO: Esta eh uma operacao DESTRUTIVA e irreversivel!
// Fazer backup do banco antes de chamar esta funcao.
//
// Body: { "confirm_delete": true }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { client } = await requireAdmin(req);
    const { confirm_delete } = await req.json();

    console.log("[admin-cleanup-users] Cleanup requested");

    // Requer confirmacao explicita
    if (confirm_delete !== true) {
      return jsonResponse({
        error: "Confirmacao necessaria. Envie { confirm_delete: true }",
        warning: "Esta operacao eh DESTRUTIVA e irreversivel!"
      }, 400);
    }

    // 1. Busca todos os admins
    const { data: admins, error: adminErr } = await client
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminErr || !admins) {
      return jsonResponse({ error: "Erro ao buscar admins" }, 400);
    }

    const adminIds = admins.map((a: any) => a.id);
    console.log("[admin-cleanup-users] Found admins:", adminIds.length);

    if (adminIds.length === 0) {
      return jsonResponse({
        error: "Nenhum admin encontrado. Cancelando limpeza para seguranca."
      }, 400);
    }

    // 2. Busca todos os usuarios nao-admin
    const { data: allUsers, error: usersErr } = await client.auth.admin.listUsers();

    if (usersErr || !allUsers?.users) {
      return jsonResponse({ error: "Erro ao listar usuarios" }, 400);
    }

    const usersToDelete = allUsers.users.filter((u: any) => !adminIds.includes(u.id));
    console.log("[admin-cleanup-users] Users to delete:", usersToDelete.length);

    // 3. Delete usuarios nao-admin
    let deletedCount = 0;
    let deleteErrors: string[] = [];

    for (const user of usersToDelete) {
      try {
        const { error: delErr } = await client.auth.admin.deleteUser(user.id);
        if (delErr) {
          deleteErrors.push(`${user.email}: ${delErr.message}`);
        } else {
          deletedCount++;
        }
      } catch (err) {
        deleteErrors.push(`${user.email}: ${String(err)}`);
      }
    }

    console.log(`[admin-cleanup-users] Deleted: ${deletedCount}, Errors: ${deleteErrors.length}`);

    return jsonResponse({
      ok: true,
      deleted_count: deletedCount,
      error_count: deleteErrors.length,
      errors: deleteErrors.length > 0 ? deleteErrors : undefined,
      message: `${deletedCount} usuarios deletados. ${adminIds.length} admins mantidos.`
    });

  } catch (e) {
    const msg = (e as Error).message;
    console.error("[admin-cleanup-users] Error:", msg, e);
    if (msg === "UNAUTHENTICATED") return jsonResponse({ error: msg }, 401);
    if (msg === "FORBIDDEN") return jsonResponse({ error: msg }, 403);
    return jsonResponse({ error: msg }, 500);
  }
});
