export type UserRole = "colaborador" | "gestor" | "admin";
export type UserStatus = "ativo" | "inativo";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
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

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}
