import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Button,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useSnackbar } from "notistack";
import PageHeader from "../../components/PageHeader";
import { supabase } from "../../lib/supabase";

interface Cycle {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  self_manager_start: string;
  self_manager_deadline: string;
  consolidation_start: string | null;
  consolidation_deadline: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  planejado: "Planejado",
  aberto_auto_gestor: "Avaliações abertas",
  aberto_consolidacao: "Consolidação",
  encerrado: "Encerrado",
};

const STATUS_COLOR: Record<string, any> = {
  planejado: "default",
  aberto_auto_gestor: "info",
  aberto_consolidacao: "warning",
  encerrado: "success",
};

const fmt = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export default function CiclosPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selfStart, setSelfStart] = useState("");
  const [selfDeadline, setSelfDeadline] = useState("");
  const [consStart, setConsStart] = useState("");
  const [consDeadline, setConsDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cycles")
      .select(
        "id, name, period_start, period_end, self_manager_start, self_manager_deadline, consolidation_start, consolidation_deadline, status, created_at"
      )
      .order("period_start", { ascending: false });

    if (error) {
      console.error("[Ciclos] erro:", error);
      enqueueSnackbar(`Erro ao carregar ciclos: ${error.message}`, { variant: "error" });
    }
    setRows((data ?? []) as Cycle[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setName("");
    setPeriodStart("");
    setPeriodEnd("");
    setSelfStart("");
    setSelfDeadline("");
    setConsStart("");
    setConsDeadline("");
  }

  async function createCycle() {
    if (!name || !periodStart || !periodEnd || !selfStart || !selfDeadline) {
      enqueueSnackbar("Preencha nome, período e datas da fase de avaliações", {
        variant: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("cycles").insert({
        name,
        period_start: periodStart,
        period_end: periodEnd,
        self_manager_start: selfStart,
        self_manager_deadline: selfDeadline,
        consolidation_start: consStart || null,
        consolidation_deadline: consDeadline || null,
        status: "planejado",
      });
      if (error) throw error;
      enqueueSnackbar("Ciclo criado", { variant: "success" });
      setOpenNew(false);
      resetForm();
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function dispatchCycle(cycleId: string) {
    if (
      !confirm(
        "Disparar este ciclo? Isso criará as avaliações para todos os colaboradores ativos."
      )
    )
      return;
    try {
      const { error } = await supabase.rpc("dispatch_cycle", { cycle: cycleId });
      if (error) throw error;
      enqueueSnackbar("Ciclo disparado com sucesso", { variant: "success" });
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  const filtered = rows.filter((r) =>
    !search ? true : r.name.toLowerCase().includes(search.toLowerCase())
  );

  const cols: GridColDef[] = [
    { field: "name", headerName: "Nome", flex: 1, minWidth: 200 },
    {
      field: "period_start",
      headerName: "Início",
      width: 110,
      renderCell: (p) => fmt(p.value),
    },
    {
      field: "period_end",
      headerName: "Fim",
      width: 110,
      renderCell: (p) => fmt(p.value),
    },
    {
      field: "self_manager_deadline",
      headerName: "Prazo avaliações",
      width: 145,
      renderCell: (p) => fmt(p.value),
    },
    {
      field: "status",
      headerName: "Status",
      width: 165,
      renderCell: (p) => (
        <Chip
          size="small"
          color={STATUS_COLOR[p.value as string] ?? "default"}
          label={STATUS_LABEL[p.value as string] ?? p.value}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const row = p.row as Cycle;
        if (row.status === "planejado") {
          return (
            <Button
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={() => dispatchCycle(row.id)}
            >
              Disparar
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Ciclos de Avaliação"
        description="Crie, dispare e acompanhe os ciclos de avaliação de desempenho."
        breadcrumbs={[{ label: "Ciclos" }]}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenNew(true)}
          >
            Novo ciclo
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <TextField
          label="Buscar por nome"
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Paper>

      <Paper sx={{ height: 600 }} elevation={1}>
        <DataGrid
          rows={filtered}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.id}
          density="standard"
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "Nenhum ciclo cadastrado" }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo ciclo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Nome do ciclo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Avaliação 2026.1"
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Início do período"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Fim do período"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Abertura das avaliações"
                type="date"
                value={selfStart}
                onChange={(e) => setSelfStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Prazo das avaliações"
                type="date"
                value={selfDeadline}
                onChange={(e) => setSelfDeadline(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Início da consolidação (opcional)"
                type="date"
                value={consStart}
                onChange={(e) => setConsStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Prazo da consolidação (opcional)"
                type="date"
                value={consDeadline}
                onChange={(e) => setConsDeadline(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenNew(false); resetForm(); }}>Cancelar</Button>
          <Button variant="contained" onClick={createCycle} disabled={saving}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
