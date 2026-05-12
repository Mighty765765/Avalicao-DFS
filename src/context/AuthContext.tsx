import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { ActiveView, Profile, ProfileCapabilities } from "../types";
import { getCapabilities } from "../types";

const ACTIVE_VIEW_STORAGE_PREFIX = "dfs.activeView.";

function defaultViewFor(caps: ProfileCapabilities): ActiveView {
  if (caps.isAdmin) return "admin";
  if (caps.isManager) return "gestor";
  return "colaborador";
}

function readStoredView(userId: string | undefined, allowed: ActiveView[]): ActiveView | null {
  if (!userId) return null;
  try {
    const v = localStorage.getItem(ACTIVE_VIEW_STORAGE_PREFIX + userId);
    if (v && (allowed as string[]).includes(v)) return v as ActiveView;
  } catch {
    /* localStorage indisponível */
  }
  return null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  capabilities: ProfileCapabilities;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveViewState] = useState<ActiveView>("colaborador");
  const isMountedRef = useRef(true);

  const capabilities = useMemo(() => getCapabilities(profile), [profile]);

  // Sincroniza activeView quando o profile muda: se a view atual não é
  // permitida pelas capacidades, cai para o default; caso contrário respeita
  // o valor armazenado em localStorage para o usuário.
  useEffect(() => {
    if (!profile) {
      setActiveViewState("colaborador");
      return;
    }
    const stored = readStoredView(profile.id, capabilities.availableViews);
    const next = stored ?? defaultViewFor(capabilities);
    setActiveViewState(next);
  }, [profile?.id, capabilities.isAdmin, capabilities.isManager]);

  const setActiveView = useCallback((view: ActiveView) => {
    if (!profile) return;
    if (!capabilities.availableViews.includes(view)) return;
    setActiveViewState(view);
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_PREFIX + profile.id, view);
    } catch {
      /* ignore */
    }
  }, [profile?.id, capabilities.availableViews]);

  async function loadProfile(userId: string, timeout = 15000) {
    try {
      console.log("[Auth] loadProfile iniciado para userId:", userId, "isMounted:", isMountedRef.current);
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        console.warn("[Auth] loadProfile timeout após", timeout, "ms - abortando para evitar loop");
      }, timeout);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      clearTimeout(timeoutId);

      if (timedOut) {
        console.warn("[Auth] loadProfile: resposta chegou APÓS timeout, descartando para evitar loop");
        // Não fazer nada se já timed out - evita atualizar estado após timeout
        return;
      }

      console.log("[Auth] loadProfile query retornou:");
      console.log("  - data:", data ? `{id:${data.id}, email:${data.email}, role:${data.role}, status:${data.status}}` : null);
      console.log("  - error:", error?.code, error?.message);
      console.log("  - isMounted:", isMountedRef.current);

      if (!isMountedRef.current) {
        console.log("[Auth] loadProfile: componente desmontado, não atualizando profile");
        return;
      }

      if (error) {
        console.error("[Auth] loadProfile error completo:", error);
        setProfile(null);
      } else if (!data) {
        console.error("[Auth] loadProfile: nenhum dado retornado (usuário não tem profile?)");
        setProfile(null);
      } else {
        console.log("[Auth] setProfile será chamado com:", data.email, "role:", data.role);
        setProfile(data as Profile);
        console.log("[Auth] setProfile executado, profile deve estar definido no estado");
      }
    } catch (err) {
      console.error("[Auth] loadProfile exception:", err);
      if (isMountedRef.current) {
        setProfile(null);
      }
    }
  }

  // Debug: log when profile state changes
  useEffect(() => {
    console.log("[Auth] Estado do profile mudou:", profile ? `{id:${profile.id}, email:${profile.email}, role:${profile.role}}` : null);
  }, [profile]);

  useEffect(() => {
    // Reset isMounted no início do effect (importante para React 18 Strict Mode)
    isMountedRef.current = true;

    let unsubscribe: (() => void) | null = null;
    let initTimeout: ReturnType<typeof setTimeout> | null = null;

    async function initAuth() {
      try {
        console.log("[Auth] Iniciando getSession...");
        const { data, error } = await supabase.auth.getSession();

        if (!isMountedRef.current) return;

        if (error) {
          console.error("[Auth] getSession error:", error);
          setSession(null);
          setProfile(null);
        } else {
          console.log("[Auth] Session carregada:", data.session?.user?.email);
          setSession(data.session);
          if (data.session?.user) {
            console.log("[Auth] Carregando profile para:", data.session.user.id);
            await loadProfile(data.session.user.id);
          }
        }
      } catch (err) {
        console.error("[Auth] initAuth error:", err);
        if (isMountedRef.current) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (isMountedRef.current) {
          console.log("[Auth] Loading finalizado");
          setLoading(false);
        }
      }

      // Assinar mudanças de auth
      try {
        const { data: authData } = supabase.auth.onAuthStateChange(async (_event, sess) => {
          console.log("[Auth] onAuthStateChange:", _event, "email:", sess?.user?.email);
          if (!isMountedRef.current) {
            console.log("[Auth] onAuthStateChange: componente desmontado, ignorando");
            return;
          }

          // Ignorar eventos repetidos (ex: USER_UPDATED chamado múltiplas vezes)
          if (_event === "USER_UPDATED" && session?.user?.id === sess?.user?.id) {
            console.log("[Auth] onAuthStateChange: USER_UPDATED duplicado, ignorando");
            return;
          }

          console.log("[Auth] onAuthStateChange: atualizando session e profile");
          setSession(sess);
          if (sess?.user) {
            console.log("[Auth] onAuthStateChange: carregando profile para userId:", sess.user.id);
            await loadProfile(sess.user.id);
            console.log("[Auth] onAuthStateChange: profile carregado");
          } else {
            console.log("[Auth] onAuthStateChange: sem user, limpando profile");
            setProfile(null);
          }
        });
        unsubscribe = authData?.subscription?.unsubscribe ?? null;
      } catch (err) {
        console.error("[Auth] onAuthStateChange error:", err);
      }
    }

    // Timeout de segurança: se loading não terminar em 10 segundos, força terminar
    initTimeout = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn("[Auth] Timeout - forçando setLoading(false)");
        setLoading(false);
      }
    }, 10000);

    initAuth();

    return () => {
      isMountedRef.current = false;
      if (unsubscribe) unsubscribe();
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, []);

  async function signIn(email: string, password: string) {
    try {
      console.log("[Auth] Iniciando signIn para:", email);

      // Timeout de 15 segundos para signIn
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("signIn timeout após 15s")), 15000)
      );

      const result = await Promise.race([signInPromise, timeoutPromise]) as any;
      console.log("[Auth] signIn retornou:", result?.data?.session?.user?.email);

      const { data, error } = result;
      if (error) {
        console.error("[Auth] signIn error response:", error);
        throw error;
      }

      console.log("[Auth] Após signIn, session:", data.session?.user?.email);
      if (data.session?.user) {
        console.log("[Auth] signIn bem-sucedido, setando session");
        setSession(data.session);
        console.log("[Auth] session setada, carregando profile para userId:", data.session.user.id);
        await loadProfile(data.session.user.id);
        console.log("[Auth] signIn: profile carregado, aguardando próxima renderização");
      }
    } catch (err) {
      console.error("[Auth] signIn error:", err);
      throw err;
    }
  }

  async function signOut() {
    try {
      console.log("[Auth] Iniciando signOut...");

      // Chamar o logout do Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("[Auth] signOut error do Supabase:", error);
        // Continuar mesmo se houver erro, para limpar o estado local
      } else {
        console.log("[Auth] signOut Supabase bem-sucedido");
      }

      // Limpar o estado local independentemente do resultado
      if (isMountedRef.current) {
        console.log("[Auth] Limpando estado local: setSession(null) e setProfile(null)");
        setSession(null);
        setProfile(null);
      } else {
        console.log("[Auth] Componente desmontado, não atualizando estado");
      }

      console.log("[Auth] signOut completado");
    } catch (err) {
      console.error("[Auth] signOut exception:", err);
      // Mesmo em caso de erro, limpar o estado
      if (isMountedRef.current) {
        setSession(null);
        setProfile(null);
      }
      throw err;
    }
  }

  async function refreshProfile() {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-senha`,
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string) {
    try {
      console.log("[Auth] Iniciando updatePassword...");
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        console.error("[Auth] updatePassword error:", error);
        throw error;
      }

      console.log("[Auth] updatePassword sucesso");
    } catch (err) {
      console.error("[Auth] updatePassword exception:", err);
      throw err;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        capabilities,
        activeView,
        setActiveView,
        signIn,
        signOut,
        refreshProfile,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
