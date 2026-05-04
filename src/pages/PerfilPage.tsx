import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  TextField,
  Button,
  Typography,
  Chip,
  Divider,
  Alert,
} from "@mui/material";
import { useSnackbar } from "notistack";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador (RH)",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

const ROLE_COLOR: Record<string, "primary" | "secondary" | "default"> = {
  admin: "primary",
  gestor: "secondary",
  colaborador: "default",
};

export default function PerfilPage() {
  const { profile, refreshProfile, updatePassword } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  if (!profile) return null;

  async function savePhone() {
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone })
        .eq("id", profile!.id);
      if (error) throw error;
      await refreshProfile();
      enqueueSnackbar("Telefone atualizado", { variant: "success" });
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    } finally {
      setSavingPhone(false);
    }
  }

  async function changePassword() {
    // Validações
    if (!oldPwd) {
      enqueueSnackbar("Digite sua senha atual", { variant: "warning" });
      return;
    }
    if (newPwd.length < 8) {
      enqueueSnackbar("A nova senha precisa ter pelo menos 8 caracteres", { variant: "warning" });
      return;
    }
    if (newPwd !== confirmPwd) {
      enqueueSnackbar("As senhas não conferem", { variant: "warning" });
      return;
    }
    if (newPwd === oldPwd) {
      enqueueSnackbar("A nova senha deve ser diferente da senha atual", { variant: "warning" });
      return;
    }

    setSavingPwd(true);
    try {
      console.log("[PerfilPage] Iniciando alteração de senha...");
      await updatePassword(newPwd);
      console.log("[PerfilPage] Senha alterada com sucesso!");

      // Limpar campos
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");

      // Mostrar sucesso com autoHideDuration para garantir visibilidade
      enqueueSnackbar("✅ Senha alterada com sucesso!", {
        variant: "success",
        autoHideDuration: 4000,
      });
    } catch (e: any) {
      console.error("[PerfilPage] Erro ao alterar senha:", e);

      let errorMsg = "Erro ao alterar a senha. Tente novamente.";

      // Tratar erros específicos
      if (e?.message?.includes("different from the old password")) {
        errorMsg = "A nova senha deve ser diferente da senha anterior";
      } else if (e?.message?.includes("Invalid login credentials")) {
        errorMsg = "Senha atual incorreta";
      } else if (e?.message) {
        errorMsg = e.message;
      }

      enqueueSnackbar(`❌ ${errorMsg}`, {
        variant: "error",
        autoHideDuration: 5000,
      });
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Meu perfil"
        description="Visualize seus dados cadastrais e atualize informações de contato e senha."
        breadcrumbs={[{ label: "Meu perfil" }]}
      />

      <Stack spacing={3} sx={{ maxWidth: 720 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
              Dados cadastrais
            </Typography>
            <Stack spacing={2}>
              <TextField label="Nome completo" value={profile.full_name} disabled fullWidth />
              <TextField label="E-mail" value={profile.email} disabled fullWidth />
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Papel:
                </Typography>
                <Chip
                  label={ROLE_LABEL[profile.role] || profile.role}
                  color={ROLE_COLOR[profile.role]}
                  size="small"
                />
              </Stack>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                Para alterar nome, e-mail ou papel, fale com o RH (Administração).
              </Alert>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
              Telefone de contato
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                fullWidth
              />
              <Button
                variant="contained"
                onClick={savePhone}
                disabled={savingPhone || phone === (profile.phone ?? "")}
              >
                Salvar
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
              Trocar senha
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Senha atual"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                disabled={savingPwd}
                fullWidth
                required
              />
              <Divider />
              <TextField
                label="Nova senha"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                helperText="Mínimo 8 caracteres, deve ser diferente da anterior"
                disabled={savingPwd}
                fullWidth
                required
              />
              <TextField
                label="Confirmar nova senha"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                error={confirmPwd.length > 0 && newPwd !== confirmPwd}
                helperText={
                  confirmPwd.length > 0 && newPwd !== confirmPwd ? "As senhas não conferem" : ""
                }
                disabled={savingPwd}
                fullWidth
                required
              />
              <Button
                variant="contained"
                onClick={changePassword}
                disabled={savingPwd || !oldPwd || !newPwd || !confirmPwd}
                sx={{ alignSelf: "flex-start" }}
              >
                {savingPwd ? "Alterando..." : "Alterar senha"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
