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
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import PageHeader from "../../components/PageHeader";
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

interface PDICompetency {
  id: string;
  employee_name: string;
  manager_name: string;
  competency: string;
  action_count: number;
  completed_count: number;
  status: string;
  latest_end: string;
  days_remaining: number;
}

interface Stats {
  totalPDIs: number;
  inProgress: number;
  completed: number;
  atRisk: number;
}

export default function PdiDashboardPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PDICompetency[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPDIs: 0,
    inProgress: 0,
    completed: 0,
    atRisk: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      // 1. Buscar todos os PDIs com informações de colaborador e gestor
      const { data: pdiData } = await supabase
        .from("pdi")
        .select(
          `id, employee_id, manager_id, cycle_id,
           profiles:employee_id(full_name),
           manager:manager_id(full_name)`
        );

      if (!pdiData?.length) {
        setRows([]);
        setStats({ totalPDIs: 0, inProgress: 0, completed: 0, atRisk: 0 });
        setLoading(false);
        return;
      }

      const pdiIds = pdiData.map((p: any) => p.id);

      // 2. Buscar todas as ações
      const { data: actionsData } = await supabase
        .from("pdi_actions")
        .select("pdi_id, competency, status, start_date, end_date")
        .in("pdi_id", pdiIds);

      // 3. Processar dados
      const processed: PDICompetency[] = [];
      let statsData = {
        totalPDIs: new Set<string>(),
        inProgress: 0,
        completed: 0,
        atRisk: 0,
      };

      for (const pdi of pdiData) {
        statsData.totalPDIs.add(pdi.id);
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
            end: new Date(a.end_date),
          }));

          const latestEnd = dates.length > 0
            ? new Date(Math.max(...dates.map((d: any) => d.end.getTime())))
            : new Date();

          const daysRemaining = Math.ceil(
            (latestEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          const isCompleted = completedActions === totalActions;
          const status = isCompleted ? "concluida" : "em_andamento";
          const isAtRisk = !isCompleted && daysRemaining < 7;

          if (isCompleted) statsData.completed++;
          if (!isCompleted) statsData.inProgress++;
          if (isAtRisk) statsData.atRisk++;

          processed.push({
            id: `${pdi.id}-${comp.competency}`,
            employee_name: (pdi.profiles as any)?.full_name ?? "—",
            manager_name: (pdi.manager as any)?.full_name ?? "—",
            competency: comp.competency,
            action_count: totalActions,
            completed_count: completedActions,
            status,
            latest_end: latestEnd.toISOString().slice(0, 10),
            days_remaining: daysRemaining,
          });
        }
      }

      setRows(processed);
      setStats({
        totalPDIs: statsData.totalPDIs.size,
        inProgress: statsData.inProgress,
        completed: statsData.completed,
        atRisk: statsData.atRisk,
      });
    } catch (e: any) {
      console.error("[PdiDashboard]", e);
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
        r.manager_name.toLowerCase().includes(s) ||
        r.competency.toLowerCase().includes(s)
      );
    }

    return result;
  }, [rows, statusFilter, search]);

  const cols: GridColDef[] = [
    { field: "employee_name", headerName: "Colaborador", flex: 1, minWidth: 180 },
    { field: "manager_name", headerName: "Gestor", flex: 1, minWidth: 160 },
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
        title="Dashboard de PDIs"
        description="Acompanhamento geral de todos os Planos de Desenvolvimento Individual."
        breadcrumbs={[{ label: "PDI Dashboard" }]}
      />

      {/* Cards de Estatísticas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total de PDIs
              </Typography>
              <Typography variant="h5">{stats.totalPDIs}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Em Andamento
              </Typography>
              <Typography variant="h5" sx={{ color: "info.main" }}>
                {stats.inProgress}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Concluídos
              </Typography>
              <Typography variant="h5" sx={{ color: "success.main" }}>
                {stats.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Em Risco (até 7 dias)
              </Typography>
              <Typography variant="h5" sx={{ color: "warning.main" }}>
                {stats.atRisk}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros */}
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
            placeholder="Colaborador, gestor, competência..."
          />
        </Stack>
      </Paper>

      {/* DataGrid */}
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
