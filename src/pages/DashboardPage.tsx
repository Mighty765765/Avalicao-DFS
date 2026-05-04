import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./dashboards/AdminDashboard";
import GestorDashboard from "./dashboards/GestorDashboard";
import ColaboradorDashboard from "./dashboards/ColaboradorDashboard";

export default function DashboardPage() {
  const { profile } = useAuth();

  if (profile?.role === "admin") return <AdminDashboard />;
  if (profile?.role === "gestor") return <GestorDashboard />;
  return <ColaboradorDashboard />;
}
