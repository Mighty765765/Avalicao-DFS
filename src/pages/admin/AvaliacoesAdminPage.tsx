import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  TextField,
  MenuItem,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import RestoreIcon from "@mui/icons-material/Restore";
import { useSnackbar } from "notistack";
import PageHeader from "../../components/PageHeader";
import { supabase } from "../../lib/supabase";

interface Row {
  id: string;
  cycle_name: string;
  evaluee_name: string;
  evaluator_name: string;
  type: string;
  status: string;
  finalized_at: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  self: "Autoavaliação",
  manager: "Gestor",
  consensus: "Consenso",
};

const STATUS_COLOR: Record<string, any> = {
  finalizado: "success",
  em_andamento: "warning",
  nao_iniciado: "default",
};

export default function AvaliacoesAdminPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reopenRow, setReopenRow] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("evaluations")
      .select(`
        id, type, status, submitted_at, evaluee_id, evaluator_id,
        cycle:cycles(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AvaliacoesAdmin] erro:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const evals = data ?? [];
    const profileIds = Array.from(
      new Set(
        evals.flatMap((e: any) => [e.evaluee_id, e.evaluator_id].filter(Boolean))
      )
    );

    const nameMap = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds);
      profs?.forEach((p: any) => nameMap.set(p.id, p.full_name));
    }

    setRows(
      evals.map((e: any) => ({
        id: e.id,
        cycle_name: e.cycle?.name ?? "—",
        evaluee_name: nameMap.get(e.evaluee_id) ?? "—",
        evaluator_name: e.evaluator_id ? nameMap.get(e.evaluator_id) ?? "—" : "—",
        type: e.type,
        status: e.status,
        finalized_at: e.submitted_at,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function reopen() {
    if (!reopenRow) return;
    if (reason.trim().length < 30) {
      enqueueSnackbar("A justificativa precisa ter pelo menos 30 caracteres", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("admin-reopen-evaluation", {
        body: { evaluation_id: reopenRow.id, reason },
      });
      if (error) throw error;
      enqueueSnackbar("Avaliação reaberta", { variant: "success" });
      setReopenRow(null);
      setReason("");
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.evaluee_name.toLowerCase().includes(s) ||
        r.evaluator_name.toLowerCase().includes(s) ||
        r.cycle_name.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const cols: GridColDef[] = [
    { field: "cycle_name", headerName: "Ciclo", width: 160 },
    { field: "evaluee_name", headerName: "Avaliado", flex: 1, minWidth: 180 },
    { field: "evaluator_name", headerName: "Avaliador", flex: 1, minWidth: 180 },
    {
      field: "type",
      headerName: "Tipo",
      width: 140,
      renderCell: (p) => <Chip size="small" label={TYPE_LABEL[p.value as string] ?? p.value} />,
    },
    {
      field: "status",
      headerName: "Status",
      width: 140,
      renderCell: (p) => (
        <Chip
          size="small"
          color={STATUS_COLOR[p.value as string] ?? "default"}
          label={p.value}
        />
      ),
    },
    {
      field: "finalized_at",
      headerName: "Finalizada em",
      width: 140,
      renderCell: (p) =>
        p.value ? new Date(p.value).toLocaleDateString("pt-BR") : "—",
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const row = p.row as Row;
        if (row.status === "finalizado") {
          return (
            <Button
              size="small"
              startIcon={<RestoreIcon />}
              onClick={() => setReopenRow(row)}
            >
              Reabrir
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
        title="Avaliações"
        description="Visão global de todas as avaliações de todos os ciclos. Reabertura com justificativa."
        breadcrumbs={[{ label: "Avaliações" }]}
        actions={
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
            Atualizar
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            select
            label="Tipo"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="self">Autoavaliação</MenuItem>
            <MenuItem value="manager">Gestor</MenuItem>
            <MenuItem value="consensus">Consenso</MenuItem>
          </TextField>
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="nao_iniciado">Não iniciada</MenuItem>
            <MenuItem value="em_andamento">Em andamento</MenuItem>
            <MenuItem value="finalizado">Finalizada</MenuItem>
          </TextField>
          <TextField
            label="Buscar"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Avaliado, avaliador, ciclo..."
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
          localeText={{ noRowsLabel: "Nenhuma avaliação" }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={!!reopenRow} onClose={() => setReopenRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reabrir avaliação</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Reabrir <strong>{reopenRow?.evaluee_name}</strong> ({TYPE_LABEL[reopenRow?.type ?? ""]})
              do ciclo <strong>{reopenRow?.cycle_name}</strong>. A justificativa fica registrada na
              auditoria.
            </Typography>
            <TextField
              label="Justificativa (mínimo 30 caracteres)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              rows={4}
              fullWidth
              helperText={`${reason.length} caracteres`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenRow(null)}>Cancelar</Button>
          <Button variant="contained" onClick={reopen} disabled={saving || reason.trim().length < 30}>
            Reabrir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
