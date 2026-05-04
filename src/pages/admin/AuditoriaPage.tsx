import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Button,
  Chip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { supabase } from "../../lib/supabase";
import type { AuditLog } from "../../types";

const ACTIONS = [
  "ALL",
  "INSERT",
  "UPDATE",
  "DELETE",
  "PROFILE_CHANGE",
  "TRANSFER_MANAGER",
  "REOPEN_EVALUATION",
  "DEACTIVATE_USER",
];

function downloadCsv(rows: AuditLog[]) {
  const header = ["created_at", "action", "table_name", "actor_id", "record_id", "payload"];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.action,
        r.table_name,
        r.actor_id ?? "",
        r.record_id ?? "",
        JSON.stringify(r.payload ?? {}).replace(/"/g, '""'),
      ]
        .map((v) => `"${String(v)}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditoriaPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("ALL");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    let q = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (action !== "ALL") q = q.eq("action", action);
    const { data, error } = await q;
    if (!error && data) setRows(data as AuditLog[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [action]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(s) ||
        r.table_name.toLowerCase().includes(s) ||
        (r.actor_id ?? "").toLowerCase().includes(s) ||
        JSON.stringify(r.payload ?? {}).toLowerCase().includes(s)
    );
  }, [rows, search]);

  const cols: GridColDef[] = [
    {
      field: "created_at",
      headerName: "Quando",
      width: 180,
      valueFormatter: (v: any) => new Date(v as string).toLocaleString("pt-BR"),
    },
    {
      field: "action",
      headerName: "Acao",
      width: 180,
      renderCell: (p) => <Chip label={p.value as string} size="small" />,
    },
    { field: "table_name", headerName: "Tabela", width: 140 },
    { field: "actor_id", headerName: "Autor (uid)", width: 280 },
    { field: "record_id", headerName: "Registro", width: 280 },
    {
      field: "payload",
      headerName: "Detalhes",
      flex: 1,
      renderCell: (p) => (
        <Box
          component="pre"
          sx={{
            m: 0,
            fontSize: 11,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(p.value ?? {}, null, 0)}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 2 }}>
        Trilha de auditoria
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            label="Acao"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            sx={{ minWidth: 220 }}
            size="small"
          >
            {ACTIONS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Buscar (acao / tabela / autor / payload)"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={load} variant="outlined">
            Atualizar
          </Button>
          <Button onClick={() => downloadCsv(filtered)} variant="contained">
            Exportar CSV
          </Button>
        </Stack>
      </Paper>
      <Paper sx={{ height: 640 }}>
        <DataGrid
          rows={filtered}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.id}
          density="compact"
          disableRowSelectionOnClick
          sx={{ border: 0 }}
        />
      </Paper>
    </Box>
  );
}
