import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  Stack,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useAuth } from "../../context/AuthContext";

const MIN_LEN = 8;

function strengthOf(pwd: string) {
  let s = 0;
  if (pwd.length >= MIN_LEN) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}

export default function TrocarSenhaObrigatoriaPage() {
  const { updatePassword, signOut, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successRedirect, setSuccessRedirect] = useState(false);

  const strength = strengthOf(p1);

  // Validação: senha forte + confirmação == p1
  const valid =
    p1.length >= MIN_LEN &&
    /[A-Z]/.test(p1) &&
    /[a-z]/.test(p1) &&
    /[0-9]/.test(p1) &&
    /[^A-Za-z0-9]/.test(p1) &&
    p1 === p2;

  // Redirecionar após sucesso
  useEffect(() => {
    if (successRedirect) {
      const timer = setTimeout(() => {
        console.log("[TrocarSenha] Redirecionando para /login");
        navigate("/login", { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successRedirect, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!valid) {
      setErr("A senha não atende aos critérios de segurança");
      return;
    }

    // Validação: senha não pode ser Dfs@2026 (senha provisória padrão)
    if (p1 === "Dfs@2026") {
      setErr("A nova senha deve ser diferente da senha provisória (Dfs@2026). Por favor, escolha uma senha diferente.");
      return;
    }

    setLoading(true);
    try {
      console.log("[TrocarSenha] Iniciando alteração de senha...");
      await updatePassword(p1);
      console.log("[TrocarSenha] Senha alterada com sucesso!");

      // Mostrar sucesso
      enqueueSnackbar("✅ Senha alterada com sucesso! Redirecionando...", {
        variant: "success",
        autoHideDuration: 2000,
      });

      // Trigger redirect via useEffect
      setSuccessRedirect(true);
    } catch (e: any) {
      console.error("[TrocarSenha] Erro completo:", e);
      setLoading(false);

      // Tratar erros específicos do Supabase
      let errorMsg = "Erro ao alterar a senha. Tente novamente.";

      if (e?.message?.includes("different from the old password")) {
        errorMsg = "A nova senha deve ser diferente da senha anterior. Por favor, escolha uma senha nova.";
      } else if (e?.message?.includes("same as your current password")) {
        errorMsg = "A nova senha deve ser diferente da senha anterior.";
      } else if (e?.message) {
        errorMsg = e.message;
      } else if (e?.error_description) {
        errorMsg = e.error_description;
      }

      console.log("[TrocarSenha] Mensagem de erro a exibir:", errorMsg);
      setErr(errorMsg);
      enqueueSnackbar(`❌ ${errorMsg}`, {
        variant: "error",
        autoHideDuration: 5000,
      });
    }
  }

  // Mostrar loading enquanto redireciona
  if (successRedirect) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Redirecionando para login...</Typography>
        </Stack>
      </Box>
    );
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
      <Paper sx={{ p: 4, width: "100%", maxWidth: 480, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
          Defina sua Nova Senha
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Olá, <b>{profile?.full_name ?? "Colaborador"}</b>. No primeiro acesso é
          obrigatório trocar a senha provisória por uma de sua preferência.
        </Typography>

        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {/* Campo Nova Senha */}
            <TextField
              label="Nova Senha"
              type="password"
              required
              fullWidth
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              disabled={loading}
              helperText="Min. 8 caracteres com maiúscula, minúscula, número e caractere especial"
              error={err !== null}
            />

            {/* Indicador de Força */}
            <Box>
              <LinearProgress
                variant="determinate"
                value={(strength / 5) * 100}
                color={strength <= 2 ? "error" : strength <= 4 ? "warning" : "success"}
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Força: {strength <= 2 ? "Fraca" : strength <= 4 ? "Média" : "Forte"}
              </Typography>
            </Box>

            {/* Campo Confirmar Senha */}
            <TextField
              label="Confirmar Senha"
              type="password"
              required
              fullWidth
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              disabled={loading}
              error={p2.length > 0 && p1 !== p2}
              helperText={
                p2.length > 0 && p1 !== p2 ? "As senhas não conferem" : " "
              }
            />

            {/* Checklist de Critérios */}
            {p1.length > 0 && (
              <Box sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 1 }}>
                <Typography variant="caption" fontWeight={600} display="block" mb={1}>
                  Critérios de Segurança:
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: p1.length >= MIN_LEN ? "green" : "red" }}>
                    ✓ Mínimo 8 caracteres ({p1.length}/8)
                  </Typography>
                  <Typography variant="caption" sx={{ color: /[A-Z]/.test(p1) ? "green" : "red" }}>
                    ✓ Pelo menos uma MAIÚSCULA
                  </Typography>
                  <Typography variant="caption" sx={{ color: /[a-z]/.test(p1) ? "green" : "red" }}>
                    ✓ Pelo menos uma minúscula
                  </Typography>
                  <Typography variant="caption" sx={{ color: /[0-9]/.test(p1) ? "green" : "red" }}>
                    ✓ Pelo menos um número
                  </Typography>
                  <Typography variant="caption" sx={{ color: /[^A-Za-z0-9]/.test(p1) ? "green" : "red" }}>
                    ✓ Pelo menos um caractere especial (@, #, $, etc.)
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Mensagem de Erro */}
            {err && (
              <Alert severity="error" onClose={() => setErr(null)}>
                {err}
              </Alert>
            )}

            {/* Botões de Ação */}
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button
                color="inherit"
                onClick={() => signOut()}
                disabled={loading}
              >
                Sair
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={!valid || loading}
                sx={{ position: "relative" }}
              >
                {loading ? (
                  <>
                    <CircularProgress
                      size={20}
                      sx={{
                        position: "absolute",
                        left: "50%",
                        marginLeft: "-10px",
                      }}
                    />
                    <span style={{ visibility: "hidden" }}>Alterando...</span>
                  </>
                ) : (
                  "Definir Nova Senha"
                )}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
