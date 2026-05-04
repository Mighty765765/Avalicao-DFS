// admin-create-user
// Cria 1 colaborador no auth.users com senha padrao Dfs@2026 e
// must_change_password = true. Apenas admins podem chamar.
//
// Body:
// {
//   "full_name": "Joao da Silva",
//   "email": "joao.silva@dfs.com.br",
//   "role": "colaborador" | "gestor" | "admin",
//   "department_id": "<uuid>" | null,
//   "position_id":   "<uuid>" | null,
//   "manager_id":    "<uuid>" | null,
//   "admission_date": "2026-04-01",
//   "phone": "+55 ...",
//   "password_override": "OPCIONAL"
// }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { sendEmail, emailLayout, ctaButton } from "../_shared/email.ts";

const DEFAULT_PASSWORD = "Dfs@2026";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { client } = await requireAdmin(req);
    const body = await req.json();
    const password = body.password_override || DEFAULT_PASSWORD;

    if (!body.email || !body.full_name) {
      return jsonResponse({ error: "email e full_name obrigatorios" }, 400);
    }

    // 1. Criar no auth.users com email_confirm = true (uso interno)
    const { data: created, error: createErr } = await client.auth.admin.createUser({
      email: body.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });

    if (createErr || !created?.user) {
      return jsonResponse(
        { error: createErr?.message || "Falha ao criar usuario" },
        400
      );
    }

    const userId = created.user.id;

    // 2. Atualizar profile (o trigger handle_new_user ja criou a linha base)
    const { error: profErr } = await client
      .from("profiles")
      .update({
        full_name: body.full_name,
        role: body.role ?? "colaborador",
        department_id: body.department_id ?? null,
        position_id: body.position_id ?? null,
        manager_id: body.manager_id ?? null,
        admission_date: body.admission_date ?? null,
        phone: body.phone ?? null,
        must_change_password: true,
      })
      .eq("id", userId);

    if (profErr) {
      return jsonResponse({ error: profErr.message }, 400);
    }

    // 3. Registra em assignment_history se houver manager
    if (body.manager_id) {
      await client.from("assignment_history").insert({
        employee_id: userId,
        manager_id: body.manager_id,
        reason: "Cadastro inicial",
      });
    }

    // 4. Envia e-mail de boas-vindas
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
    try {
      await sendEmail({
        to: body.email,
        subject: "[DFS] Acesso a Plataforma de Avaliacao de Desempenho",
        html: emailLayout(
          `<h2 style="color:#012639;margin:0 0 12px;">Bem-vindo(a) a Avaliacao de Desempenho DFS</h2>
           <p>Ola, <b>${body.full_name}</b>!</p>
           <p>Seu acesso a plataforma de Avaliacao de Desempenho 180&deg; foi criado.</p>
           <p><b>Login:</b> ${body.email}<br>
              <b>Senha provisoria:</b> ${password}</p>
           <p>No primeiro acesso voce sera obrigado(a) a definir uma nova senha.</p>
           ${ctaButton(appUrl, "Acessar plataforma")}
           <p style="color:#64748B;font-size:13px">
             Em caso de duvidas, entre em contato com o RH.
           </p>`,
          "Boas-vindas DFS RH"
        ),
      });
    } catch (mailErr) {
      console.error("SMTP error:", mailErr);
      // Nao falha a criacao se o email falhar
    }

    return jsonResponse({ ok: true, user_id: userId });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "UNAUTHENTICATED") return jsonResponse({ error: msg }, 401);
    if (msg === "FORBIDDEN") return jsonResponse({ error: msg }, 403);
    return jsonResponse({ error: msg }, 500);
  }
});
