import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Chip,
  LinearProgress,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

const STATUS_COLOR: Record<string, any> = {
  planejada: "default",
  em_andamento: "info",
  concluida: "success",
  atrasada: "error",
};

interface Row {
  id: string;
  employee_name: string;
  competency: string;
  action_count: number;
  completed_count: number;
  status: string;
  earliest_start: string;
  latest_end: string;
  days_remaining: number;
}

export default function PdiAcompanhamentoPage() {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [profile?.id, statusFilter]);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Buscar PDIs dos liderados diretos
      const { data: teamData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("manager_id", profile.id);

      if (!teamData?.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const teamIds = teamData.map((t) => t.id);

      // 2. Buscar PDIs
      const { data: pdiData } = await supabase
        .from("pdi")
        .select("id, employee_id, cycle_id")
        .in("employee_id", teamIds);

      if (!pdiData?.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const pdiIds = pdiData.map((p) => p.id);

      // 3. Buscar ações agrupadas por competência
      const { data: actionsData } = await supabase
        .from("pdi_actions")
        .select("pdi_id, competency, status, start_date, end_date")
        .in("pdi_id", pdiIds);

      // 4. Montar grid
      const processed: Row[] = [];

      for (const pdi of pdiData) {
        const employee = teamData.find((t) => t.id === pdi.employee_id);
        const pdiActions = actionsData?.filter((a: any) => a.pdi_id === pdi.id) || [];

        // Agrupar por competência
        const competencies = new Map<string, any>();
        pdiActions.forEach((action: any) => {
          const key = action.competency || "outro";
          if (!competencies.has(key)) {
            competencies.set(key, {
              competency: key,
              actions: [],
            });
          }
          competencies.get(key).actions.push(action);
        });

        // Criar linha por competência
        for (const [_, comp] of competencies) {
          const totalActions = comp.actions.length;
          const completedActions = comp.actions.filter(
            (a: any) => a.status === "concluida"
          ).length;
          const dates = comp.actions.map((a: any) => ({
            start: new Date(a.start_date),
            end: new Date(a.end_date),
          }));

          const daysRemaining = dates.length > 0
            ? Math.max(
              ...dates.map((d: any) =>
                Math.ceil((d.end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              )
            )
            : 0;

          processed.push({
            id: `${pdi.id}-${comp.competency}`,
            employee_name: employee?.full_name ?? "—",
            competency: comp.competency,
            action_count: totalActions,
            completed_count: completedActions,
            status: completedActions === totalActions ? "concluida" : "em_andamento",
            earliest_start: dates.length > 0
              ? new Date(Math.min(...dates.map((d: any) => d.start.getTime())))
                .toISOString()
                .slice(0, 10)
              : "—",
            latest_end: dates.length > 0
              ? new Date(Math.max(...dates.map((d: any) => d.end.getTime())))
                .toISOString()
                .slice(0, 10)
              : "—",
            days_remaining: daysRemaining,
          });
        }
      }

      setRows(processed);
    } catch (e: any) {
      console.error("[PdiAcompanhamento]", e);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let result = rows;

    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.employee_name.toLowerCase().includes(s) ||
        r.competency.toLowerCase().includes(s)
      );
    }

    return result;
  }, [rows, statusFilter, search]);

  const cols: GridColDef[] = [
    { field: "employee_name", headerName: "Colaborador", flex: 1, minWidth: 180 },
    { field: "competency", headerName: "Competência", flex: 1, minWidth: 160 },
    {
      field: "completed_count",
      headerName: "Progresso",
      width: 200,
      renderCell: (p) => {
        const total = p.row.action_count;
        const completed = p.row.completed_count;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return (
          <Stack spacing={0.5} width="100%">
            <LinearProgress variant="determinate" value={percent} />
            <Typography variant="caption" align="center">
              {completed}/{total} ({percent}%)
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (p) => (
        <Chip
          label={STATUS_LABEL[p.value]}
          size="small"
          color={STATUS_COLOR[p.value]}
        />
      ),
    },
    {
      field: "latest_end",
      headerName: "Prazo Final",
      width: 130,
    },
    {
      field: "days_remaining",
      headerName: "Dias Restantes",
      width: 140,
      renderCell: (p) => {
        const days = p.value as number;
        if (days < 0)
          return <Chip label={`${Math.abs(days)}d atrasado`} color="error" size="small" />;
        if (days <= 7)
          return <Chip label={`${days}d`} color="warning" size="small" />;
        return <Chip label={`${days}d`} size="small" />;
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Acompanhamento de PDIs"
        description="Monitore o progresso dos PDIs dos colaboradores sob sua liderança."
        breadcrumbs={[{ label: "PDIs" }]}
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="em_andamento">Em Andamento</MenuItem>
            <MenuItem value="concluida">Concluída</MenuItem>
          </TextField>

          <TextField
            label="Busca"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Colaborador, competência..."
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
          localeText={{ noRowsLabel: "Nenhum PDI encontrado" }}
          sx={{ border: 0 }}
        />
      </Paper>
    </Box>
  );
}
