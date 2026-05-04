// admin-reset-password
// Reseta a senha de um colaborador: atualiza auth.users com nova senha
// e define must_change_password conforme parametro.
//
// Body:
// {
//   "user_id": "<uuid>",
//   "new_password": "senha123" (OPCIONAL - se nao informada, gera automatica),
//   "must_change_password": true | false (default: true)
// }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { sendEmail, emailLayout, ctaButton } from "../_shared/email.ts";

const DEFAULT_PASSWORD = "Dfs@2026";

// Gera uma senha aleatoria forte (12 caracteres com maiuscula, minuscula, numero e especial)
function generatePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "@#$%&*";
  const all = upper + lower + digits + special;

  let pwd = "";
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { client } = await requireAdmin(req);
    const { user_id, new_password, must_change_password } = await req.json();

    console.log("[admin-reset-password] Resetting password for user:", user_id);

    if (!user_id) return jsonResponse({ error: "user_id obrigatorio" }, 400);

    // 1. Busca o perfil do usuario para obter dados
    const { data: profile, error: profErr } = await client
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user_id)
      .single();

    console.log("[admin-reset-password] Profile lookup:", { profErr, profile: profile?.id });

    if (profErr || !profile) {
      console.error("[admin-reset-password] Profile not found:", profErr);
      return jsonResponse({ error: "Colaborador nao encontrado" }, 404);
    }

    // 2. Gera ou usa a senha fornecida
    const password = new_password || generatePassword();
    console.log("[admin-reset-password] Using password mode:", new_password ? "custom" : "generated");

    // 3. Tenta atualizar a senha no auth.users
    let updateErr = null;
    try {
      const result = await client.auth.admin.updateUserById(user_id, {
        password,
      });
      if (result?.error) {
        updateErr = result.error;
      }
    } catch (err) {
      updateErr = err;
    }

    console.log("[admin-reset-password] Password update:", updateErr ? "error" : "ok");

    if (updateErr) {
      const errMsg = (updateErr as any).message || String(updateErr);
      console.error("[admin-reset-password] Password update error:", updateErr);

      // Se o usuario nao existe no auth.users, retorna erro mais informativo
      if (errMsg.includes("not found") || errMsg.includes("Not found")) {
        return jsonResponse({
          error: "Usuario nao encontrado no sistema de autenticacao. O perfil existe mas nao ha credenciais de login associadas. Tente recriar o usuario.",
          code: "user_not_in_auth"
        }, 404);
      }

      return jsonResponse({ error: errMsg }, 400);
    }

    // 4. Atualiza o flag must_change_password no profiles
    const { error: flagErr } = await client
      .from("profiles")
      .update({
        must_change_password: must_change_password ?? true,
      })
      .eq("id", user_id);

    console.log("[admin-reset-password] Flag update:", flagErr ? "error" : "ok");

    if (flagErr) {
      console.error("[admin-reset-password] Flag update error:", flagErr);
      return jsonResponse({ error: flagErr.message }, 400);
    }

    // 5. Envia email com a nova senha provisoria
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
    const changePasswordRequired = must_change_password ?? true;

    console.log("[admin-reset-password] Sending email to:", profile.email);

    try {
      await sendEmail({
        to: profile.email,
        subject: "[DFS] Senha resetada",
        html: emailLayout(
          `<h2 style="color:#012639;margin:0 0 12px;">Senha Resetada</h2>
           <p>Ola, <b>${profile.full_name}</b>!</p>
           <p>Sua senha foi resetada pelo administrador.</p>
           <p><b>Login:</b> ${profile.email}<br>
              <b>Senha provisoria:</b> ${password}</p>
           ${changePasswordRequired
             ? `<p>No proximo acesso voce sera obrigado(a) a definir uma nova senha de sua preferencia.</p>`
             : `<p>Voce pode utilizar esta senha imediatamente. Recomendamos alterar a senha no proximo acesso.</p>`
           }
           ${ctaButton(appUrl, "Acessar plataforma")}
           <p style="color:#64748B;font-size:13px">
             Em caso de duvidas, entre em contato com o RH.
           </p>`,
          "Senha Resetada"
        ),
      });
      console.log("[admin-reset-password] Email sent successfully");
    } catch (mailErr) {
      console.error("[admin-reset-password] Email error:", mailErr);
      // Nao falha o reset se o email falhar
    }

    console.log("[admin-reset-password] Success - password reset completed");
    return jsonResponse({
      ok: true,
      message: `Senha resetada com sucesso. Email enviado para ${profile.email}`,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[admin-reset-password] Error:", msg, e);
    if (msg === "UNAUTHENTICATED") return jsonResponse({ error: msg }, 401);
    if (msg === "FORBIDDEN") return jsonResponse({ error: msg }, 403);
    return jsonResponse({ error: msg }, 500);
  }
});
