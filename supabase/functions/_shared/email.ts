// =====================================================================
// _shared/email.ts
// Wrapper SMTP corporativo. Configurado via supabase secrets:
//   SMTP_HOST     - ex: smtp.dfs.com.br
//   SMTP_PORT     - ex: 587 (STARTTLS) ou 465 (TLS)
//   SMTP_USER     - usuario SMTP
//   SMTP_PASS     - senha SMTP
//   SMTP_SECURE   - "true" para TLS direto (port 465), "false" para STARTTLS (port 587)
//   SMTP_FROM     - "DFS RH <rh@dfs.com.br>"
//   APP_URL       - URL publica do app (usada nos templates)
// =====================================================================

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const secure = (Deno.env.get("SMTP_SECURE") ?? "false") === "true";
  const from = Deno.env.get("SMTP_FROM") ?? "DFS RH <rh@dfs.com.br>";

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP nao configurado: SMTP_HOST/SMTP_USER/SMTP_PASS ausentes"
    );
  }

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: secure,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from,
      to: opts.to,
      cc: opts.cc,
      bcc: opts.bcc,
      subject: opts.subject,
      content: opts.text ?? "Visualize este e-mail em um cliente HTML.",
      html: opts.html,
    });
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------
// Template DFS-branded base
// ---------------------------------------------------------------------
export function emailLayout(content: string, title?: string) {
  const appUrl = Deno.env.get("APP_URL") ?? "https://avaliacao.dfs.com.br";
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title ?? "DFS RH"}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Inter,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr><td style="background:#012639;padding:20px 32px;">
            <div style="color:#ffffff;font-weight:700;font-size:18px;letter-spacing:0.5px;">DFS &middot; Avaliacao de Desempenho</div>
          </td></tr>
          <tr><td style="padding:32px;font-size:14px;line-height:1.6;color:#1f2937;">
            ${content}
          </td></tr>
          <tr><td style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;">
            Acesse o sistema em <a href="${appUrl}" style="color:#0041c0;text-decoration:none;">${appUrl}</a><br/>
            Esta mensagem foi enviada automaticamente. Em caso de duvidas: rh@dfs.com.br
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function ctaButton(href: string, label: string) {
  return `<p style="margin:24px 0;text-align:center;">
    <a href="${href}" style="background:#0041c0;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">${label}</a>
  </p>`;
}
