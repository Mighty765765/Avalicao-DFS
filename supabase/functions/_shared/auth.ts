// Helpers de autenticacao para Edge Functions
// Valida JWT do caller e exige role=admin antes de qualquer acao sensivel.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function requireAdmin(req: Request): Promise<{
  client: SupabaseClient;
  userId: string;
}> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHENTICATED");

  const sb = serviceClient();
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) throw new Error("UNAUTHENTICATED");

  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, status")
    .eq("id", userData.user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.status !== "ativo") {
    throw new Error("FORBIDDEN");
  }

  return { client: sb, userId: userData.user.id };
}
