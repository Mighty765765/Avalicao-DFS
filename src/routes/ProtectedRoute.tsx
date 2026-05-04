import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  console.log("[ProtectedRoute] loading:", loading, "session:", session?.user?.email, "profile:", profile?.email);

  if (loading) {
    console.log("[ProtectedRoute] Aguardando carregamento...");
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    console.log("[ProtectedRoute] Sem sessão, redirecionando para /login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  console.log("[ProtectedRoute] Sessão OK, verificando profile...");

  // Força troca de senha no 1o login
  if (profile && profile.must_change_password && location.pathname !== "/trocar-senha-obrigatorio") {
    console.log("[ProtectedRoute] Força troca de senha obrigatória para:", profile.email);
    return <Navigate to="/trocar-senha-obrigatorio" replace />;
  }

  // Se temos sessão mas ainda aguardando profile, mostrar loading
  if (session && !profile) {
    console.log("[ProtectedRoute] Sessão OK mas aguardando perfil...");
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (profile?.status === "inativo") {
    console.log("[ProtectedRoute] Profile inativo");
    return <Navigate to="/acesso-negado?reason=inativo" replace />;
  }

  console.log("[ProtectedRoute] Tudo OK, renderizando Outlet");
  return <Outlet />;
}
