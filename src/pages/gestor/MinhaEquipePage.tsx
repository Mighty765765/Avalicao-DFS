import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  TextField,
  Chip,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import RateReviewIcon from "@mui/icons-material/RateReview";
import GavelIcon from "@mui/icons-material/Gavel";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

interface TeamMemberRow {
  id: string;
  full_name: string;
  email: string;
  position_name: string | null;
  department_name: string | null;
  status: string;
  evaluation_id: string | null;
  consensus_id: string | null;
  pdi_id: string | null;
  self_status: string | null;
  manager_status: string | null;
}

export default function MinhaEquipePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          status,
          position:positions(name),
          department:departments(name)
        `)
        .eq("manager_id", profile.id)
        .order("full_name");

      if (!members) {
        setLoading(false);
        return;
      }

      // Para cada membro, buscar a avaliação ativa
      const enriched: TeamMemberRow[] = await Promise.all(
        members.map(async (m: any) => {
          const { data: evals } = await supabase
            .from("evaluations")
            .select("id, type, status, evaluator_id")
            .eq("evaluee_id", m.id)
            .order("created_at", { ascending: false });

          const selfEval = evals?.find((e) => e.type === "self");
          const managerEval = evals?.find(
            (e) => e.type === "manager" && e.evaluator_id === profile.id
          );
          const consensusEval = evals?.find((e) => e.type === "consensus");

          const { data: pdi } = await supabase
            .from("pdi")
            .select("id")
            .eq("employee_id", m.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: m.id,
            full_name: m.full_name,
            email: m.email,
            position_name: m.position?.name ?? null,
            department_name: m.department?.name ?? null,
            status: m.status,
            evaluation_id: managerEval?.id ?? null,
            consensus_id: consensusEval?.id ?? null,
            pdi_id: pdi?.id ?? null,
            self_status: selfEval?.status ?? null,
            manager_status: managerEval?.status ?? null,
          };
        })
      );

      setRows(enriched);
      setLoading(false);
    })();
  }, [profile?.id]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s) ||
      r.position_name?.toLowerCase().includes(s) ||
      r.department_name?.toLowerCase().includes(s)
    );
  });

  const cols: GridColDef[] = [
    { field: "full_name", headerName: "Colaborador", flex: 1, minWidth: 180 },
    { field: "position_name", headerName: "Cargo", flex: 1, minWidth: 140 },
    { field: "department_name", headerName: "Área", flex: 1, minWidth: 140 },
    {
      field: "self_status",
      headerName: "Autoavaliação",
      width: 140,
      renderCell: (p) => {
        const v = p.value as string | null;
        if (!v) return <Chip size="small" label="—" />;
        if (v === "finalizado") return <Chip size="small" color="success" label="Finalizada" />;
        return <Chip size="small" color="warning" label="Em aberto" />;
      },
    },
    {
      field: "manager_status",
      headerName: "Avaliação Gestor",
      width: 160,
      renderCell: (p) => {
        const v = p.value as string | null;
        if (!v) return <Chip size="small" label="—" />;
        if (v === "finalizado") return <Chip size="small" color="success" label="Finalizada" />;
        return <Chip size="small" color="warning" label="Pendente" />;
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const row = p.row as TeamMemberRow;
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Avaliar">
              <span>
                <IconButton
                  size="small"
                  disabled={!row.evaluation_id}
                  onClick={() => navigate(`/app/gestor/avaliacoes/${row.evaluation_id}`)}
                >
                  <RateReviewIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Consenso">
              <span>
                <IconButton
                  size="small"
                  disabled={!row.consensus_id}
                  onClick={() => navigate(`/app/gestor/consenso/${row.consensus_id}`)}
                >
                  <GavelIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="PDI">
              <span>
                <IconButton
                  size="small"
                  disabled={!row.pdi_id}
                  onClick={() => navigate(`/app/gestor/pdi/${row.pdi_id}`)}
                >
                  <AssignmentIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Minha Equipe"
        description="Colaboradores sob sua liderança direta. Acesse avaliação, consenso e PDI de cada um."
        breadcrumbs={[{ label: "Minha Equipe" }]}
      />

      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <TextField
          label="Buscar colaborador"
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, e-mail, cargo, área..."
        />
      </Paper>

      <Paper sx={{ height: 600 }} elevation={1}>
        {!loading && filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              Você ainda não tem colaboradores diretos. Procure o RH para configurar a hierarquia.
            </Typography>
          </Box>
        ) : (
          <DataGrid
            rows={filtered}
            columns={cols}
            loading={loading}
            getRowId={(r) => r.id}
            density="standard"
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: "Nenhum colaborador encontrado" }}
            sx={{ border: 0 }}
          />
        )}
      </Paper>
    </Box>
  );
}
