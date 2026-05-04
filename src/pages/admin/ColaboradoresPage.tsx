import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  TextField,
  MenuItem,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import UploadIcon from "@mui/icons-material/Upload";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import BlockIcon from "@mui/icons-material/Block";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useSnackbar } from "notistack";
import PageHeader from "../../components/PageHeader";
import { supabase } from "../../lib/supabase";

interface Row {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  department_name: string | null;
  position_name: string | null;
  manager_name: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

const ROLE_COLOR: Record<string, any> = {
  admin: "primary",
  gestor: "secondary",
  colaborador: "default",
};

const STATUS_COLOR: Record<string, any> = {
  ativo: "success",
  inativo: "default",
};

export default function ColaboradoresPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ativo");
  const [openNew, setOpenNew] = useState(false);

  // Form Novo
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("colaborador");
  const [newPassword, setNewPassword] = useState("");
  const [savePasswordMode, setSavePasswordMode] = useState("generated");
  const [saving, setSaving] = useState(false);

  // Form Resetar Senha
  const [openReset, setOpenReset] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Row | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordMode, setResetPasswordMode] = useState("generated");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id, full_name, email, role, status, manager_id,
        department:departments(name),
        position:positions(name)
      `)
      .order("full_name");

    if (error) {
      console.error("[Colaboradores] erro:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const profiles = data ?? [];

    // Busca os nomes dos gestores em uma segunda query
    const managerIds = Array.from(
      new Set(profiles.map((p: any) => p.manager_id).filter(Boolean))
    );
    const managersMap = new Map<string, string>();
    if (managerIds.length > 0) {
      const { data: managers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", managerIds);
      managers?.forEach((m: any) => managersMap.set(m.id, m.full_name));
    }

    setRows(
      profiles.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        status: p.status,
        department_name: p.department?.name ?? null,
        position_name: p.position?.name ?? null,
        manager_name: p.manager_id ? managersMap.get(p.manager_id) ?? null : null,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    if (!newEmail || !newName) {
      enqueueSnackbar("Preencha nome e e-mail", { variant: "warning" });
      return;
    }
    if (savePasswordMode === "custom" && (!newPassword || newPassword.length < 8)) {
      enqueueSnackbar("Senha deve ter no mínimo 8 caracteres", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newEmail,
          full_name: newName,
          role: newRole,
          initial_password: savePasswordMode === "custom" ? newPassword : undefined,
          force_password_change: true,
        },
      });
      if (error) throw error;
      enqueueSnackbar(
        data?.message ?? "Colaborador criado com sucesso. Senha deve ser alterada no primeiro acesso.",
        { variant: "success" }
      );
      setOpenNew(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("colaborador");
      setSavePasswordMode("generated");
      load();
    } catch (e: any) {
      console.error("[createUser] erro:", e);
      enqueueSnackbar(`Erro ao criar colaborador: ${e.message}`, { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(row: Row) {
    if (!confirm(`Desativar ${row.full_name}? Ele perderá acesso ao sistema.`)) return;
    try {
      const { error } = await supabase.functions.invoke("admin-deactivate-user", {
        body: { user_id: row.id },
      });
      if (error) throw error;
      enqueueSnackbar("Colaborador desativado", { variant: "success" });
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  function openResetPasswordDialog(row: Row) {
    setSelectedCollaborator(row);
    setResetPassword("");
    setResetPasswordMode("generated");
    setMustChangePassword(true);
    setOpenReset(true);
  }

  async function confirmResetPassword() {
    if (!selectedCollaborator) return;
    if (resetPasswordMode === "custom" && (!resetPassword || resetPassword.length < 8)) {
      enqueueSnackbar("Senha deve ter no mínimo 8 caracteres", { variant: "warning" });
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: {
          user_id: selectedCollaborator.id,
          new_password: resetPasswordMode === "custom" ? resetPassword : undefined,
          must_change_password: mustChangePassword,
        },
      });
      if (error) throw error;
      enqueueSnackbar(
        data?.message ?? "Senha resetada com sucesso",
        { variant: "success" }
      );
      setOpenReset(false);
      setSelectedCollaborator(null);
      setResetPassword("");
      load();
    } catch (e: any) {
      console.error("[resetPassword] erro:", e);
      enqueueSnackbar(`Erro ao resetar senha: ${e.message}`, { variant: "error" });
    } finally {
      setResetting(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.full_name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        r.department_name?.toLowerCase().includes(s) ||
        r.position_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const cols: GridColDef[] = [
    { field: "full_name", headerName: "Nome", flex: 1, minWidth: 180 },
    { field: "email", headerName: "E-mail", flex: 1, minWidth: 200 },
    {
      field: "role",
      headerName: "Papel",
      width: 140,
      renderCell: (p) => (
        <Chip
          size="small"
          color={ROLE_COLOR[p.value as string] ?? "default"}
          label={ROLE_LABEL[p.value as string] ?? p.value}
        />
      ),
    },
    { field: "department_name", headerName: "Área", width: 160 },
    { field: "position_name", headerName: "Cargo", width: 160 },
    { field: "manager_name", headerName: "Gestor", width: 180 },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      renderCell: (p) => (
        <Chip
          size="small"
          color={STATUS_COLOR[p.value as string] ?? "default"}
          label={p.value}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const row = p.row as Row;
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Transferir gestor">
              <IconButton
                size="small"
                onClick={() =>
                  navigate(`/app/admin/colaboradores/${row.id}/transferir-gestor`)
                }
              >
                <SwapHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Resetar senha">
              <IconButton
                size="small"
                color="warning"
                onClick={() => openResetPasswordDialog(row)}
              >
                <LockResetIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {row.status === "ativo" && (
              <Tooltip title="Desativar">
                <IconButton size="small" color="error" onClick={() => deactivate(row)}>
                  <BlockIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Colaboradores"
        description="Cadastros, importação CSV, transferência de gestor e desativação de acessos."
        breadcrumbs={[{ label: "Colaboradores" }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() =>
                enqueueSnackbar(
                  "Importação CSV: chamar Edge Function admin-bulk-import com payload {csv_text}",
                  { variant: "info" }
                )
              }
            >
              Importar CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenNew(true)}
            >
              Novo
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            select
            label="Papel"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="admin">Administrador</MenuItem>
            <MenuItem value="gestor">Gestor</MenuItem>
            <MenuItem value="colaborador">Colaborador</MenuItem>
          </TextField>
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="ativo">Ativos</MenuItem>
            <MenuItem value="inativo">Inativos</MenuItem>
          </TextField>
          <TextField
            label="Busca"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, e-mail, área, cargo..."
          />
        </Stack>
      </Paper>

      <Paper sx={{ height: 600 }} elevation={1}>
        <DataGrid
          rows={filtered}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.id}
          density="standard"
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "Nenhum colaborador" }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo colaborador</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              O usuário será obrigado a alterar a senha no primeiro acesso.
            </Typography>
            <TextField
              label="Nome completo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fullWidth
            />
            <TextField
              label="E-mail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Papel"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              fullWidth
            >
              <MenuItem value="colaborador">Colaborador</MenuItem>
              <MenuItem value="gestor">Gestor</MenuItem>
              <MenuItem value="admin">Administrador (RH)</MenuItem>
            </TextField>

            <TextField
              select
              label="Senha inicial"
              value={savePasswordMode}
              onChange={(e) => {
                setSavePasswordMode(e.target.value);
                setNewPassword("");
              }}
              fullWidth
            >
              <MenuItem value="generated">Gerar automaticamente e enviar por e-mail</MenuItem>
              <MenuItem value="custom">Definir manualmente</MenuItem>
            </TextField>

            {savePasswordMode === "custom" && (
              <TextField
                label="Senha inicial"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                helperText="Mínimo 8 caracteres"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenNew(false);
            setNewPassword("");
            setSavePasswordMode("generated");
          }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={createUser} disabled={saving}>
            {saving ? "Criando..." : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openReset} onClose={() => setOpenReset(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resetar senha - {selectedCollaborator?.full_name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Defina uma nova senha provisória para o colaborador.
            </Typography>
            <TextField
              select
              label="Opção de senha"
              value={resetPasswordMode}
              onChange={(e) => {
                setResetPasswordMode(e.target.value);
                setResetPassword("");
              }}
              fullWidth
            >
              <MenuItem value="generated">Gerar automaticamente e enviar por e-mail</MenuItem>
              <MenuItem value="custom">Definir manualmente</MenuItem>
            </TextField>

            {resetPasswordMode === "custom" && (
              <TextField
                label="Senha provisória"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                fullWidth
                helperText="Mínimo 8 caracteres"
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={mustChangePassword}
                  onChange={(e) => setMustChangePassword(e.target.checked)}
                />
              }
              label="Forçar alteração de senha no próximo acesso"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenReset(false);
            setSelectedCollaborator(null);
            setResetPassword("");
            setResetPasswordMode("generated");
          }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={confirmResetPassword}
            disabled={resetting}
          >
            {resetting ? "Resetando..." : "Resetar Senha"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
