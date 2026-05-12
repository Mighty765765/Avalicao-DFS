import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ActiveView } from "../types";

interface Props {
  // Capacidades aceitas: "colaborador" (qualquer autenticado), "gestor"
  // (is_manager OR admin), "admin" (RH). Se o usuário tem QUALQUER uma das
  // capacidades listadas, o acesso é liberado.
  roles: ActiveView[];
}

export default function RoleRoute({ roles }: Props) {
  const { profile, loading, capabilities } = useAuth();
  if (loading) return null;
  if (!profile) return null;

  const allowed = roles.some((r) => capabilities.availableViews.includes(r));
  if (!allowed) {
    return <Navigate to="/acesso-negado" replace />;
  }
  return <Outlet />;
}
