import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  Stack,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const nav = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (p1.length < 8) return setErr("Senha muito curta");
    if (p1 !== p2) return setErr("Senhas nao conferem");
    setLoading(true);
    try {
      await updatePassword(p1);
      nav("/app", { replace: true });
    } catch (e: any) {
      setErr(e.message);
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
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ color: "#012639", fontWeight: 700 }} mb={2}>
          Definir nova senha
        </Typography>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Nova senha"
              type="password"
              required
              fullWidth
              value={p1}
              onChange={(e) => setP1(e.target.value)}
            />
            <TextField
              label="Confirmar senha"
              type="password"
              required
              fullWidth
              value={p2}
              onChange={(e) => setP2(e.target.value)}
            />
            {err && <Alert severity="error">{err}</Alert>}
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
