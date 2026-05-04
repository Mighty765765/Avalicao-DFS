import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  TextField,
  MenuItem,
  Button,
  Chip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import PageHeader from "../../components/PageHeader";
import { supabase } from "../../lib/supabase";

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

interface Cycle {
  id: string;
  name: string;
}

interface ActionRow {
  action_id: string;
  competency: string;
  action: string;
  deadline: string;
  status: string;
  progress_note: string | null;
  cycle_name: string;
  employee_name: string;
  manager_name: string;
  days_late: number;
}

const fmt = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function downloadCsv(name: string, rows: any[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AcoesPendentesPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleFilter, setCycleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cycles")
        .select("id, name")
        .order("period_start", { ascending: false });
      setCycles((data ?? []) as Cycle[]);
    })();
  }, []);

  async function load() {
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
        .map((row: any) => ({
          action_id: row.id,
          competency: row.competency,
          action: row.action,
          deadline: row.deadline,
          status: row.status,
          progress_note: row.progress_note,
          cycle_name: row.pdi?.cycle?.name ?? "—",
          cycle_id: row.pdi?.cycle_id,
          employee_name: row.pdi?.employee?.full_name ?? "—",
          manager_name: row.pdi?.manager?.full_name ?? "—",
          days_late: row.deadline
            ? Math.max(0, Math.floor((new Date().getTime() - new Date(row.deadline + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)))
            : 0,
        }))
        .filter((r: any) => {
          if (cycleFilter !== "ALL" && r.cycle_id !== cycleFilter) return false;
          if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
          if (search) {
            const s = search.toLowerCase();
            return (
              r.employee_name.toLowerCase().includes(s) ||
              r.manager_name.toLowerCase().includes(s) ||
              r.action.toLowerCase().includes(s) ||
              r.competency.toLowerCase().includes(s)
            );
          }
          return true;
        });

      setRows(processed as ActionRow[]);
    } catch (e: any) {
      console.error("[AcoesPendentes] erro:", e);
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [cycleFilter, statusFilter]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(s) ||
        r.manager_name.toLowerCase().includes(s) ||
        r.action.toLowerCase().includes(s) ||
        r.competency.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const cols: GridColDef[] = [
    { field: "employee_name", headerName: "Colaborador", flex: 1, minWidth: 160 },
    { field: "manager_name", headerName: "Gestor", flex: 1, minWidth: 160 },
    { field: "cycle_name", headerName: "Ciclo", width: 130 },
    { field: "competency", headerName: "Competência", flex: 1, minWidth: 180 },
    { field: "action", headerName: "Ação", flex: 2, minWidth: 220 },
    {
      field: "deadline",
      headerName: "Prazo",
      width: 110,
      renderCell: (p) => fmt(p.value),
    },
    {
      field: "status",
      headerName: "Status",
      width: 140,
      renderCell: (p) => (
        <Chip
          label={STATUS_LABEL[p.value as string] ?? p.value}
          size="small"
          color={STATUS_COLOR[p.value as string] ?? "default"}
        />
      ),
    },
    {
      field: "days_late",
      headerName: "Atraso",
      width: 100,
      renderCell: (p) =>
        (p.value as number) > 0 ? (
          <Chip label={`${p.value}d`} color="error" size="small" />
        ) : (
          <Chip label="No prazo" size="small" />
        ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Ações do PDI — Acompanhamento"
        description="Relatório de todas as ações dos planos de desenvolvimento em execução."
        breadcrumbs={[{ label: "Ações Pendentes" }]}
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          alignItems={{ lg: "center" }}
        >
          <TextField
            select
            label="Ciclo"
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="ALL">Todos os ciclos</MenuItem>
            {cycles.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="planejada">Planejada</MenuItem>
            <MenuItem value="em_andamento">Em andamento</MenuItem>
            <MenuItem value="concluida">Concluída</MenuItem>
            <MenuItem value="atrasada">Atrasada</MenuItem>
            <MenuItem value="cancelada">Cancelada</MenuItem>
          </TextField>

          <TextField
            label="Busca livre"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Colaborador, gestor, ação..."
          />

          <Stack direction="row" spacing={1}>
            <Button
              onClick={load}
              variant="outlined"
              startIcon={<RefreshIcon />}
            >
              Atualizar
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              disabled={!filtered.length}
              onClick={() => downloadCsv("acoes_pendentes", filtered)}
            >
              CSV
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ height: 600 }} elevation={1}>
        <DataGrid
          rows={filtered}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.action_id}
          density="standard"
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "Nenhuma ação encontrada" }}
          sx={{ border: 0 }}
        />
      </Paper>
    </Box>
  );
}
