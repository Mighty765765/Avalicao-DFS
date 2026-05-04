import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  TextField,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PageHeader from "../../components/PageHeader";
import { supabase } from "../../lib/supabase";

interface Row {
  id: string;
  cycle_name: string;
  evaluee_name: string;
  manager_name: string | null;
  status: string;
  acknowledged_at: string | null;
  created_at: string;
}

export default function PdiAdminPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pdi")
      .select(`
        id, acknowledged_at, created_at, employee_id,
        cycle:cycles(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PdiAdmin] erro:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const pdis = data ?? [];
    const evalueeIds = Array.from(
      new Set(pdis.map((p: any) => p.employee_id).filter(Boolean))
    );

    const profMap = new Map<string, { full_name: string; manager_id: string | null }>();
    if (evalueeIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, manager_id")
        .in("id", evalueeIds);
      profs?.forEach((p: any) =>
        profMap.set(p.id, { full_name: p.full_name, manager_id: p.manager_id })
      );
    }

    const managerIds = Array.from(
      new Set(
        Array.from(profMap.values())
          .map((p) => p.manager_id)
          .filter(Boolean) as string[]
      )
    );
    const managerMap = new Map<string, string>();
    if (managerIds.length > 0) {
      const { data: mgrs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", managerIds);
      mgrs?.forEach((m: any) => managerMap.set(m.id, m.full_name));
    }

    setRows(
      pdis.map((p: any) => {
        const ev = profMap.get(p.employee_id);
        return {
          id: p.id,
          cycle_name: p.cycle?.name ?? "—",
          evaluee_name: ev?.full_name ?? "—",
          manager_name: ev?.manager_id ? managerMap.get(ev.manager_id) ?? null : null,
          status: p.status,
          acknowledged_at: p.acknowledged_at,
          created_at: p.created_at,
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.evaluee_name.toLowerCase().includes(s) ||
      r.manager_name?.toLowerCase().includes(s) ||
      r.cycle_name.toLowerCase().includes(s)
    );
  });

  const cols: GridColDef[] = [
    { field: "cycle_name", headerName: "Ciclo", width: 160 },
    { field: "evaluee_name", headerName: "Colaborador", flex: 1, minWidth: 180 },
    { field: "manager_name", headerName: "Gestor", flex: 1, minWidth: 180 },
    {
      field: "status",
      headerName: "Status",
      width: 140,
      renderCell: (p) => <Chip size="small" label={p.value} />,
    },
    {
      field: "acknowledged_at",
      headerName: "Ciência",
      width: 140,
      renderCell: (p) =>
        p.value ? (
          <Chip size="small" color="success" label="Sim" />
        ) : (
          <Chip size="small" label="Pendente" />
        ),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const row = p.row as Row;
        return (
          <Tooltip title="Ver PDI">
            <IconButton size="small" onClick={() => navigate(`/app/gestor/pdi/${row.id}`)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="PDI (Planos de Desenvolvimento)"
        description="Visualização global de todos os PDIs do programa, em qualquer ciclo."
        breadcrumbs={[{ label: "PDI" }]}
        actions={
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
            Atualizar
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <TextField
          label="Buscar"
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Colaborador, gestor, ciclo..."
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
          localeText={{ noRowsLabel: "Nenhum PDI" }}
          sx={{ border: 0 }}
        />
      </Paper>
    </Box>
  );
}
