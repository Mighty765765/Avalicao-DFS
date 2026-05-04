import { useEffect, useState } from "react";
import { Box, Paper, Tabs, Tab, Chip } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

interface EvalRow {
  id: string;
  evaluee_name: string;
  cycle_name: string;
  type: string;
  status: string;
  finalized_at: string | null;
}

interface PdiRow {
  id: string;
  evaluee_name: string;
  cycle_name: string;
  status: string;
  acknowledged_at: string | null;
}

export default function HistoricoEquipePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"evals" | "pdis">("evals");
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [pdis, setPdis] = useState<PdiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      // Pega liderados (atuais)
      const { data: team } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("manager_id", profile.id);
      const teamIds = (team ?? []).map((t: any) => t.id);
      const teamNameMap = new Map<string, string>(
        (team ?? []).map((t: any) => [t.id, t.full_name])
      );

      if (teamIds.length === 0) {
        setEvals([]);
        setPdis([]);
        setLoading(false);
        return;
      }

      const { data: evalData } = await supabase
        .from("evaluations")
        .select(`id, type, status, submitted_at, evaluee_id, cycle:cycles(name)`)
        .in("evaluee_id", teamIds)
        .eq("status", "finalizado")
        .order("submitted_at", { ascending: false });

      setEvals(
        (evalData ?? []).map((e: any) => ({
          id: e.id,
          evaluee_name: teamNameMap.get(e.evaluee_id) ?? "—",
          cycle_name: e.cycle?.name ?? "—",
          type: e.type,
          status: e.status,
          finalized_at: e.submitted_at,
        }))
      );

      const { data: pdiData } = await supabase
        .from("pdi")
        .select(`id, status, acknowledged_at, employee_id, cycle:cycles(name)`)
        .in("employee_id", teamIds)
        .order("created_at", { ascending: false });

      setPdis(
        (pdiData ?? []).map((p: any) => ({
          id: p.id,
          evaluee_name: teamNameMap.get(p.employee_id) ?? "—",
          cycle_name: p.cycle?.name ?? "—",
          status: p.status,
          acknowledged_at: p.acknowledged_at,
        }))
      );

      setLoading(false);
    })();
  }, [profile?.id]);

  const evalCols: GridColDef[] = [
    { field: "evaluee_name", headerName: "Colaborador", flex: 1, minWidth: 180 },
    { field: "cycle_name", headerName: "Ciclo", width: 160 },
    {
      field: "type",
      headerName: "Tipo",
      width: 130,
      renderCell: (p) => <Chip size="small" label={p.value} />,
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (p) => <Chip size="small" color="success" label={p.value} />,
    },
    {
      field: "finalized_at",
      headerName: "Finalizada em",
      width: 160,
      renderCell: (p) =>
        p.value ? new Date(p.value).toLocaleDateString("pt-BR") : "—",
    },
  ];

  const pdiCols: GridColDef[] = [
    { field: "evaluee_name", headerName: "Colaborador", flex: 1, minWidth: 180 },
    { field: "cycle_name", headerName: "Ciclo", width: 160 },
    {
      field: "status",
      headerName: "Status",
      width: 140,
      renderCell: (p) => <Chip size="small" label={p.value} />,
    },
    {
      field: "acknowledged_at",
      headerName: "Ciência em",
      width: 160,
      renderCell: (p) =>
        p.value ? new Date(p.value).toLocaleDateString("pt-BR") : "—",
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Histórico da Equipe"
        description="Avaliações finalizadas e PDIs anteriores dos seus liderados (atuais e passados)."
        breadcrumbs={[{ label: "Histórico da Equipe" }]}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
        }}
      >
        <Tab value="evals" label="Avaliações" />
        <Tab value="pdis" label="PDIs" />
      </Tabs>

      <Paper sx={{ height: 600 }} elevation={1}>
        {tab === "evals" ? (
          <DataGrid
            rows={evals}
            columns={evalCols}
            loading={loading}
            getRowId={(r) => r.id}
            density="standard"
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: "Nenhuma avaliação no histórico" }}
            sx={{ border: 0 }}
          />
        ) : (
          <DataGrid
            rows={pdis}
            columns={pdiCols}
            loading={loading}
            getRowId={(r) => r.id}
            density="standard"
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: "Nenhum PDI no histórico" }}
            sx={{ border: 0 }}
          />
        )}
      </Paper>
    </Box>
  );
}
