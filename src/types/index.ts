export type UserRole = "colaborador" | "admin";
export type UserStatus = "ativo" | "inativo";

// Visão ativa no menu lateral. Admin pode alternar entre as três; demais
// usuários alternam entre as visões para as quais têm capacidade.
export type ActiveView = "colaborador" | "gestor" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_manager: boolean;
  status: UserStatus;
  department_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  admission_date: string | null;
  phone: string | null;
  avatar_url: string | null;
  must_change_password: boolean;
  last_password_change: string | null;
  created_at: string;
  updated_at: string;
}

// Capacidades derivadas do profile, usadas para gating de rotas e menu.
export interface ProfileCapabilities {
  isAdmin: boolean;
  isManager: boolean; // is_manager OR isAdmin
  isColaborador: boolean; // todo usuário ativo é colaborador
  availableViews: ActiveView[];
}

export function getCapabilities(profile: Pick<Profile, "role" | "is_manager"> | null): ProfileCapabilities {
  const isAdmin = profile?.role === "admin";
  const isManager = !!profile?.is_manager || isAdmin;
  const isColaborador = !!profile;
  const availableViews: ActiveView[] = [];
  if (isColaborador) availableViews.push("colaborador");
  if (isManager) availableViews.push("gestor");
  if (isAdmin) availableViews.push("admin");
  return { isAdmin, isManager, isColaborador, availableViews };
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}
