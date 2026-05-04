import { useEffect, useState } from "react";
import { Box, Paper, Tabs, Tab, Chip } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

interface EvalRow {
  id: string;
  cycle_name: string;
  type: string;
  status: string;
  finalized_at: string | null;
}

interface PdiRow {
  id: string;
  cycle_name: string;
  status: string;
  acknowledged_at: string | null;
}

export default function HistoricoColaboradorPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"evals" | "pdis">("evals");
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [pdis, setPdis] = useState<PdiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);

      // Apenas avaliações onde sou o avaliado e do tipo permitido (RLS já filtra)
      const { data: evalData } = await supabase
        .from("evaluations")
        .select("id, type, status, submitted_at, cycle:cycles(name)")
        .eq("evaluee_id", profile.id)
        .order("created_at", { ascending: false });

      setEvals(
        (evalData ?? []).map((e: any) => ({
          id: e.id,
          cycle_name: e.cycle?.name ?? "—",
          type: e.type,
          status: e.status,
          finalized_at: e.submitted_at,
        }))
      );

      const { data: pdiData } = await supabase
        .from("pdi")
        .select("id, status, acknowledged_at, cycle:cycles(name)")
        .eq("employee_id", profile.id)
        .order("created_at", { ascending: false });

      setPdis(
        (pdiData ?? []).map((p: any) => ({
          id: p.id,
          cycle_name: p.cycle?.name ?? "—",
          status: p.status,
          acknowledged_at: p.acknowledged_at,
        }))
      );

      setLoading(false);
    })();
  }, [profile?.id]);

  const TYPE_LABEL: Record<string, string> = {
    self: "Autoavaliação",
    consensus: "Consenso",
    manager: "Avaliação do gestor",
  };

  const STATUS_COLOR: Record<string, any> = {
    finalizado: "success",
    em_andamento: "warning",
    nao_iniciado: "default",
  };

  const evalCols: GridColDef[] = [
    { field: "cycle_name", headerName: "Ciclo", flex: 1, minWidth: 180 },
    {
      field: "type",
      headerName: "Tipo",
      width: 200,
      renderCell: (p) => (
        <Chip size="small" label={TYPE_LABEL[p.value as string] ?? p.value} />
      ),
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
      width: 160,
      renderCell: (p) =>
        p.value ? new Date(p.value).toLocaleDateString("pt-BR") : "—",
    },
  ];

  const pdiCols: GridColDef[] = [
    { field: "cycle_name", headerName: "Ciclo", flex: 1, minWidth: 180 },
    {
      field: "status",
      headerName: "Status",
      width: 160,
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
        title="Histórico"
        description="Suas avaliações e PDIs de ciclos anteriores. Visualização somente leitura."
        breadcrumbs={[{ label: "Histórico" }]}
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
        <Tab value="evals" label="Minhas Avaliações" />
        <Tab value="pdis" label="Meus PDIs" />
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
            localeText={{ noRowsLabel: "Nenhuma avaliação encontrada" }}
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
            localeText={{ noRowsLabel: "Nenhum PDI encontrado" }}
            sx={{ border: 0 }}
          />
        )}
      </Paper>
    </Box>
  );
}
