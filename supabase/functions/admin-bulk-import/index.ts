// admin-bulk-import
// Importa varios colaboradores em uma chamada. Devolve relatorio linha-a-linha.
//
// Body:
// {
//   "rows": [
//     { "full_name":"...", "email":"...", "role":"colaborador",
//       "department":"Tecnologia", "position":"Analista Pleno",
//       "manager_email":"chefe@dfs.com.br", "admission_date":"2026-01-10" },
//     ...
//   ]
// }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { sendEmail, emailLayout, ctaButton } from "../_shared/resend.ts";

const DEFAULT_PASSWORD = "Dfs@2026";

type Row = {
  full_name: string;
  email: string;
  role?: "colaborador" | "gestor" | "admin";
  department?: string;
  position?: string;
  manager_email?: string;
  admission_date?: string;
  phone?: string;
};

type Result = {
  email: string;
  ok: boolean;
  user_id?: string;
  error?: string;
};

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { client } = await requireAdmin(req);
    const body = (await req.json()) as { rows: Row[] };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return jsonResponse({ error: "rows vazias" }, 400);
    }

    // Pre-carrega catalogos
    const { data: deps } = await client.from("departments").select("id, name");
    const { data: poss } = await client.from("positions").select("id, name");
    const depMap = new Map((deps ?? []).map((d) => [d.name.toLowerCase(), d.id]));
    const posMap = new Map((poss ?? []).map((p) => [p.name.toLowerCase(), p.id]));

    const results: Result[] = [];
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

    for (const row of body.rows) {
      try {
        if (!row.email || !row.full_name) {
          results.push({
            email: row.email ?? "(sem email)",
            ok: false,
            error: "email e full_name obrigatorios",
          });
          continue;
        }

        // Resolve manager por email
        let managerId: string | null = null;
        if (row.manager_email) {
          const { data: mgr } = await client
            .from("profiles")
            .select("id")
            .eq("email", row.manager_email)
            .maybeSingle();
          managerId = mgr?.id ?? null;
          if (!managerId) {
            results.push({
              email: row.email,
              ok: false,
              error: `Gestor nao encontrado: ${row.manager_email}`,
            });
            continue;
          }
        }

        const departmentId =
          row.department && depMap.get(row.department.toLowerCase());
        const positionId =
          row.position && posMap.get(row.position.toLowerCase());

        const { data: created, error: createErr } =
          await client.auth.admin.createUser({
            email: row.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: row.full_name },
          });

        if (createErr || !created?.user) {
          results.push({
            email: row.email,
            ok: false,
            error: createErr?.message ?? "Falha ao criar",
          });
          continue;
        }

        const userId = created.user.id;
        await client
          .from("profiles")
          .update({
            full_name: row.full_name,
            role: row.role ?? "colaborador",
            department_id: departmentId ?? null,
            position_id: positionId ?? null,
            manager_id: managerId,
            admission_date: row.admission_date ?? null,
            phone: row.phone ?? null,
            must_change_password: true,
          })
          .eq("id", userId);

        if (managerId) {
          await client.from("assignment_history").insert({
            employee_id: userId,
            manager_id: managerId,
            reason: "Importacao em massa",
          });
        }

        // E-mail de boas-vindas
        try {
          await sendEmail(
            row.email,
            "[DFS] Acesso a Plataforma de Avaliacao de Desempenho",
            emailLayout(
              "Bem-vindo(a) a Avaliacao de Desempenho DFS",
              `<p>Ola, <b>${row.full_name}</b>!</p>
               <p>Seu acesso foi criado. Login: <b>${row.email}</b><br>
                  Senha provisoria: <b>${DEFAULT_PASSWORD}</b></p>
               ${ctaButton(appUrl, "Acessar plataforma")}`
            )
          );
        } catch (_) {/* nao bloqueia */}

        results.push({ email: row.email, ok: true, user_id: userId });
      } catch (e) {
        results.push({
          email: row.email ?? "(?)",
          ok: false,
          error: (e as Error).message,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return jsonResponse({
      ok: true,
      processed: results.length,
      success: okCount,
      failed: results.length - okCount,
      results,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "UNAUTHENTICATED") return jsonResponse({ error: msg }, 401);
    if (msg === "FORBIDDEN") return jsonResponse({ error: msg }, 403);
    return jsonResponse({ error: msg }, 500);
  }
});
