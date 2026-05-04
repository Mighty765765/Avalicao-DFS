import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

interface Props {
  roles: UserRole[];
}

export default function RoleRoute({ roles }: Props) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return null;
  if (!roles.includes(profile.role)) {
    return <Navigate to="/acesso-negado" replace />;
  }
  return <Outlet />;
}
