import { useState } from "react";
import { useNavigate, Link as RouterLink, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  Stack,
  Link,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from?.pathname ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signIn(email, password);
      nav(from, { replace: true });
    } catch (e: any) {
      setErr(e.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #012639 0%, #0041c0 60%, #006ab0 100%)",
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{ p: 4, width: "100%", maxWidth: 420, borderRadius: 3 }}
      >
        <Stack alignItems="center" spacing={1} mb={2}>
          <Box
            component="img"
            src="/brand/DFS_ORIGINAL.png"
            alt="DFS"
            sx={{ height: 80 }}
          />
          <Typography variant="h6" sx={{ color: "#012639", fontWeight: 700 }}>
            Avaliacao de Desempenho
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Acesso interno DFS
          </Typography>
        </Stack>

        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <TextField
              label="Senha"
              type="password"
              required
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {err && <Alert severity="error">{err}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <Link
              component={RouterLink}
              to="/recuperar-senha"
              underline="hover"
              align="center"
              variant="body2"
            >
              Esqueci minha senha
            </Link>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
