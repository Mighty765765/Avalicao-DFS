import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const STATUS_COLOR: Record<string, any> = {
  planejada: "default",
  em_andamento: "info",
  concluida: "success",
  atrasada: "error",
  cancelada: "default",
};

interface Row {
  action_id: string;
  competency: string;
  action: string;
  deadline: string;
  status: keyof typeof STATUS_LABEL;
  progress_note: string | null;
  employee_name: string;
  cycle_name: string;
  days_late: number;
}

export default function ValidarAcoesPage() {
  const { profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<"pending" | "finalized">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [finOpen, setFinOpen] = useState(false);
  const [unfinOpen, setUnfinOpen] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);
  const [completionDate, setCompletionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");
  const [unfinReason, setUnfinReason] = useState("");

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pdi_actions")
        .select(
          `id, competency, action, deadline, status, progress_note,
           pdi:pdi_id(
             cycle_id, employee_id,
             cycle:cycle_id(name),
             employee:employee_id(full_name),
             manager:manager_id(full_name)
           )`
        );

      if (error) throw error;

      const processed = (data ?? [])
        .filter((r: any) => r.pdi?.manager_id === profile.id)
        .map((r: any) => {
          const isCompleted = r.status === "concluida";
          return {
            action_id: r.id,
            competency: r.competency,
            action: r.action,
            deadline: r.deadline,
            status: r.status,
            progress_note: r.progress_note,
            employee_name: r.pdi?.employee?.full_name ?? "—",
            cycle_name: r.pdi?.cycle?.name ?? "—",
            days_late: r.deadline
              ? Math.max(0, Math.floor((new Date().getTime() - new Date(r.deadline + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)))
              : 0,
            is_completed: isCompleted,
          };
        })
        .filter((r: any) => tab === "pending" ? !r.is_completed : r.is_completed);

      setRows(processed as Row[]);
    } catch (e: any) {
      console.error("[ValidarAcoes] erro:", e);
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.id, tab]);

  function openFinalize(r: Row) {
    setTarget(r);
    setCompletionDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setFinOpen(true);
  }

  function openUnfinalize(r: Row) {
    setTarget(r);
    setUnfinReason("");
    setUnfinOpen(true);
  }

  async function confirmFinalize() {
    if (!target) return;
    const today = new Date();
    const selectedDate = new Date(completionDate + "T00:00:00");

    if (selectedDate > today) {
      enqueueSnackbar(
        "Data de finalizacao nao pode ser futura.",
        { variant: "warning" }
      );
      return;
    }

    const { error } = await supabase.rpc("finalize_action", {
      p_action_id: target.action_id,
      p_completion_date: new Date(completionDate).toISOString(),
      p_note: note || null,
    });
    if (error) {
      console.error("[finalize_action] erro:", error);
      enqueueSnackbar(
        `Erro ao finalizar ação: ${error.message || "Função não disponível"}`,
        { variant: "error" }
      );
      return;
    }
    enqueueSnackbar("Ação finalizada com sucesso", { variant: "success" });
    setFinOpen(false);
    load();
  }

  async function confirmUnfinalize() {
    if (!target) return;
    if (unfinReason.trim().length < 10) {
      enqueueSnackbar("Justifique com pelo menos 10 caracteres.", {
        variant: "warning",
      });
      return;
    }
    const { error } = await supabase.rpc("unfinalize_action", {
      p_action_id: target.action_id,
      p_reason: unfinReason,
    });
    if (error) {
      console.error("[unfinalize_action] erro:", error);
      enqueueSnackbar(
        `Erro ao des-finalizar ação: ${error.message || "Função não disponível"}`,
        { variant: "error" }
      );
      return;
    }
    enqueueSnackbar("Ação des-finalizada. Justificativa registrada.", {
      variant: "success",
    });
    setUnfinOpen(false);
    load();
  }

  const cols: GridColDef[] = useMemo(() => {
    const base: GridColDef[] = [
      { field: "employee_name", headerName: "Colaborador", flex: 1 },
      { field: "action", headerName: "Acao", flex: 2 },
      { field: "competency", headerName: "Competência", flex: 1 },
      { field: "deadline", headerName: "Prazo", width: 110 },
      {
        field: "status",
        headerName: "Status",
        width: 180,
        renderCell: (p) => (
          <Chip
            label={STATUS_LABEL[p.value as string] ?? p.value}
            color={STATUS_COLOR[p.value as string] ?? "default"}
            size="small"
          />
        ),
      },
    ];
    if (tab === "pending") {
      base.push({
        field: "days_late",
        headerName: "Dias atraso",
        width: 110,
        renderCell: (p) =>
          (p.value as number) > 0 ? (
            <Chip label={`${p.value}d`} color="error" size="small" />
          ) : (
            <Chip label="No prazo" size="small" />
          ),
      });
      base.push({
        field: "actions",
        headerName: "Acoes",
        width: 240,
        sortable: false,
        renderCell: (p) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" onClick={() => openFinalize(p.row)}>
              Finalizar
            </Button>
          </Stack>
        ),
      });
    } else {
      base.push(
        {
          field: "actions",
          headerName: "Acoes",
          width: 200,
          sortable: false,
          renderCell: (p) => (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => openUnfinalize(p.row)}
            >
              Des-finalizar
            </Button>
          ),
        }
      );
    }
    return base;
  }, [tab]);

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 2 }}>
        Validar acoes do PDI
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="pending" label="Pendentes" />
        <Tab value="finalized" label="Finalizadas" />
      </Tabs>

      <Paper sx={{ height: 640 }}>
        <DataGrid
          rows={rows}
          columns={cols}
          getRowId={(r) => r.action_id}
          loading={loading}
          density="compact"
          disableRowSelectionOnClick
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={finOpen} onClose={() => setFinOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Finalizar acao</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              <b>Acao:</b> {target?.action}
            </Typography>
            <Alert severity="info">
              Data padrao = hoje. Voce pode informar uma data retroativa, desde
              que nao seja futura.
            </Alert>
            <TextField
              label="Data de finalizacao"
              type="date"
              value={completionDate}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setCompletionDate(e.target.value)}
              inputProps={{
                max: new Date().toISOString().slice(0, 10),
              }}
            />
            <TextField
              label="Comentario / evidencia (opcional)"
              multiline
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {target && new Date(completionDate) > new Date(target.deadline) && (
              <Alert severity="warning">
                Esta data e posterior ao prazo final. A acao sera registrada como
                <b> finalizada com atraso</b>.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={confirmFinalize}>
            Confirmar finalizacao
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={unfinOpen} onClose={() => setUnfinOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Des-finalizar acao</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Alert severity="warning">
              A des-finalizacao e auditada. Justifique o motivo (minimo 10 caracteres).
            </Alert>
            <TextField
              label="Justificativa"
              multiline
              rows={4}
              value={unfinReason}
              onChange={(e) => setUnfinReason(e.target.value)}
              required
              helperText={`${unfinReason.length}/10 caracteres minimos`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnfinOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={confirmUnfinalize}
            disabled={unfinReason.trim().length < 10}
          >
            Confirmar des-finalizacao
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
