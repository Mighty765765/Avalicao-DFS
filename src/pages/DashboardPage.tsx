import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./dashboards/AdminDashboard";
import GestorDashboard from "./dashboards/GestorDashboard";
import ColaboradorDashboard from "./dashboards/ColaboradorDashboard";

export default function DashboardPage() {
  const { activeView } = useAuth();

  if (activeView === "admin") return <AdminDashboard />;
  if (activeView === "gestor") return <GestorDashboard />;
  return <ColaboradorDashboard />;
}
