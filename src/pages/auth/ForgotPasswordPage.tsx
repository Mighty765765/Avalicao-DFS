import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
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
          Recuperar senha
        </Typography>
        {sent ? (
          <Alert severity="success">
            Se o e-mail informado existir na base, voce recebera um link em
            poucos minutos.
          </Alert>
        ) : (
          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="E-mail corporativo"
                type="email"
                required
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {err && <Alert severity="error">{err}</Alert>}
              <Button type="submit" variant="contained" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperacao"}
              </Button>
              <Link component={RouterLink} to="/login" align="center" variant="body2">
                Voltar ao login
              </Link>
            </Stack>
          </form>
        )}
      </Paper>
    </Box>
  );
}
