import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Autocomplete,
  TextField,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";

interface ProfileLite {
  id: string;
  full_name: string;
  email: string;
  role: string;
  manager_id: string | null;
}

export default function TransferirGestorPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [employee, setEmployee] = useState<ProfileLite | null>(null);
  const [currentMgr, setCurrentMgr] = useState<ProfileLite | null>(null);
  const [managers, setManagers] = useState<ProfileLite[]>([]);
  const [newManager, setNewManager] = useState<ProfileLite | null>(null);
  const [reason, setReason] = useState("");
  const [migrateOpen, setMigrateOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: emp } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, manager_id")
        .eq("id", id)
        .single();
      setEmployee(emp as ProfileLite);
      if (emp?.manager_id) {
        const { data: mgr } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, manager_id")
          .eq("id", emp.manager_id)
          .single();
        setCurrentMgr(mgr as ProfileLite);
      }
      const { data: list } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, manager_id")
        .in("role", ["gestor", "admin"])
        .eq("status", "ativo")
        .order("full_name");
      setManagers((list ?? []).filter((m: any) => m.id !== id) as ProfileLite[]);
    })();
  }, [id]);

  const valid = useMemo(
    () => !!newManager && newManager.id !== employee?.manager_id,
    [newManager, employee]
  );

  async function onSubmit() {
    if (!valid || !employee || !newManager) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("transfer_employee_manager", {
      p_employee_id: employee.id,
      p_new_manager: newManager.id,
      p_reason: reason || null,
      p_migrate_open: migrateOpen,
    });
    setSubmitting(false);
    if (error) {
      enqueueSnackbar(error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar("Transferencia realizada com sucesso", { variant: "success" });
    nav("/app/admin/colaboradores");
  }

  if (!employee) return null;

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 2 }}>
        Transferir gestor
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Colaborador
            </Typography>
            <Typography variant="h6">{employee.full_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {employee.email}
            </Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="overline" color="text.secondary">
              Gestor atual
            </Typography>
            <Typography>
              {currentMgr ? currentMgr.full_name : "(sem gestor atribuido)"}
            </Typography>
          </Box>
          <Autocomplete
            options={managers}
            getOptionLabel={(o) => `${o.full_name} - ${o.email}`}
            value={newManager}
            onChange={(_, v) => setNewManager(v)}
            renderInput={(p) => (
              <TextField {...p} label="Novo gestor" required />
            )}
          />
          <TextField
            label="Motivo (opcional, recomendado)"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FormControlLabel
            control={
              <Switch
                checked={migrateOpen}
                onChange={(_, c) => setMigrateOpen(c)}
              />
            }
            label="Migrar avaliacoes em andamento (manager + consensus) para o novo gestor"
          />
          {migrateOpen ? (
            <Alert severity="info">
              As avaliacoes nao finalizadas terao o evaluator_id atualizado.
              Avaliacoes ja finalizadas permanecem inalteradas.
            </Alert>
          ) : (
            <Alert severity="warning">
              O gestor antigo continuara responsavel por concluir as avaliacoes
              em andamento.
            </Alert>
          )}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => nav(-1)}>Cancelar</Button>
            <Button
              variant="contained"
              disabled={!valid || submitting}
              onClick={onSubmit}
            >
              {submitting ? "Transferindo..." : "Confirmar transferencia"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
