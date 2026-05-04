import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import TrocarSenhaObrigatoriaPage from "./pages/auth/TrocarSenhaObrigatoriaPage";
import DashboardPage from "./pages/DashboardPage";
import PerfilPage from "./pages/PerfilPage";
import AuditoriaPage from "./pages/admin/AuditoriaPage";
import TransferirGestorPage from "./pages/admin/TransferirGestorPage";
import AcoesPendentesPage from "./pages/admin/AcoesPendentesPage";
import CiclosPage from "./pages/admin/CiclosPage";
import ColaboradoresPage from "./pages/admin/ColaboradoresPage";
import AvaliacoesAdminPage from "./pages/admin/AvaliacoesAdminPage";
import PdiAdminPage from "./pages/admin/PdiAdminPage";
import ConfiguracoesPage from "./pages/admin/ConfiguracoesPage";
import AutoavaliacaoPage from "./pages/colaborador/AutoavaliacaoPage";
import PdiAcoesPage from "./pages/colaborador/PdiAcoesPage";
import HistoricoColaboradorPage from "./pages/colaborador/HistoricoPage";
import AvaliarColaboradorPage from "./pages/gestor/AvaliarColaboradorPage";
import ConsensoPage from "./pages/gestor/ConsensoPage";
import PdiBuilderPage from "./pages/gestor/PdiBuilderPage";
import ValidarAcoesPage from "./pages/gestor/ValidarAcoesPage";
import MinhaEquipePage from "./pages/gestor/MinhaEquipePage";
import HistoricoEquipePage from "./pages/gestor/HistoricoEquipePage";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import AppLayout from "./components/AppLayout";

function DashboardRedirect() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/app/inicio" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      {/* Troca obrigatória */}
      <Route path="/trocar-senha-obrigatorio" element={<TrocarSenhaObrigatoriaPage />} />

      {/* Área autenticada com layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Comuns a todos */}
          <Route path="/app" element={<DashboardRedirect />} />
          <Route path="/app/inicio" element={<DashboardPage />} />
          <Route path="/app/perfil" element={<PerfilPage />} />

          {/* Colaborador (acessível a todos os roles) */}
          <Route element={<RoleRoute roles={["colaborador", "gestor", "admin"]} />}>
            <Route
              path="/app/colaborador/avaliacoes/:evaluationId"
              element={<AutoavaliacaoPage />}
            />
            <Route path="/app/colaborador/pdi" element={<PdiAcoesPage />} />
            <Route
              path="/app/colaborador/historico"
              element={<HistoricoColaboradorPage />}
            />
          </Route>

          {/* Gestor (e admin) */}
          <Route element={<RoleRoute roles={["gestor", "admin"]} />}>
            <Route path="/app/gestor/equipe" element={<MinhaEquipePage />} />
            <Route
              path="/app/gestor/avaliacoes/:evaluationId"
              element={<AvaliarColaboradorPage />}
            />
            <Route
              path="/app/gestor/consenso/:evaluationId"
              element={<ConsensoPage />}
            />
            <Route path="/app/gestor/pdi/:pdiId" element={<PdiBuilderPage />} />
            <Route path="/app/gestor/pdi/validar" element={<ValidarAcoesPage />} />
            <Route path="/app/gestor/historico" element={<HistoricoEquipePage />} />
          </Route>

          {/* Admin */}
          <Route element={<RoleRoute roles={["admin"]} />}>
            <Route path="/app/admin/ciclos" element={<CiclosPage />} />
            <Route path="/app/admin/colaboradores" element={<ColaboradoresPage />} />
            <Route
              path="/app/admin/colaboradores/:id/transferir-gestor"
              element={<TransferirGestorPage />}
            />
            <Route path="/app/admin/avaliacoes" element={<AvaliacoesAdminPage />} />
            <Route path="/app/admin/pdi" element={<PdiAdminPage />} />
            <Route path="/app/admin/acoes-pendentes" element={<AcoesPendentesPage />} />
            <Route path="/app/admin/auditoria" element={<AuditoriaPage />} />
            <Route path="/app/admin/configuracoes" element={<ConfiguracoesPage />} />
          </Route>
        </Route>
      </Route>

      {/* Página de acesso negado */}
      <Route
        path="/acesso-negado"
        element={
          <Box sx={{ p: 4, textAlign: "center" }}>
            <h1>Acesso negado</h1>
            <p>Você não tem permissão para acessar esta página.</p>
            <a href="/app/inicio">Voltar ao início</a>
          </Box>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
