import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Stack,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  MenuItem,
  Switch,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useSnackbar } from "notistack";
import PageHeader from "../../components/PageHeader";
import { supabase } from "../../lib/supabase";

type TabKey = "blocks" | "questions" | "departments" | "positions";

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<TabKey>("blocks");

  return (
    <Box>
      <PageHeader
        title="Configurações"
        description="Catálogos do sistema: blocos de competência, perguntas, áreas e cargos."
        breadcrumbs={[{ label: "Configurações" }]}
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
        <Tab value="blocks" label="Blocos de Competência" />
        <Tab value="questions" label="Perguntas" />
        <Tab value="departments" label="Áreas" />
        <Tab value="positions" label="Cargos" />
      </Tabs>

      {tab === "blocks" && <BlocksCrud key="blocks" />}
      {tab === "questions" && <QuestionsCrud key="questions" />}
      {tab === "departments" && <SimpleNameCrud key="departments" table="departments" label="Área" />}
      {tab === "positions" && <SimpleNameCrud key="positions" table="positions" label="Cargo" />}
    </Box>
  );
}

interface SimpleRow {
  id: string;
  name: string;
  sort_order?: number | null;
}

interface BlockRow extends SimpleRow {
  kind: string;
}

interface QuestionRow {
  id: string;
  block_id: string;
  text: string;
  sort_order: number;
  active: boolean;
  competency_blocks?: any;
}

function SimpleNameCrud({ table, label }: { table: string; label: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<SimpleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SimpleRow | null>(null);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as SimpleRow[]);
    } catch (e: any) {
      console.error(`[SimpleNameCrud] Erro ao carregar ${table}:`, e);
      enqueueSnackbar(`Erro ao carregar ${label.toLowerCase()}`, { variant: "error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [table]);

  function openNew() {
    setEditing(null);
    setName("");
    setOpen(true);
  }

  function openEdit(r: SimpleRow) {
    setEditing(r);
    setName(r.name);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar("Informe o nome", { variant: "warning" });
      return;
    }
    try {
      if (editing) {
        const { error } = await supabase
          .from(table)
          .update({ name: name.trim() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(table)
          .insert({ name: name.trim() });
        if (error) throw error;
      }
      enqueueSnackbar("Salvo", { variant: "success" });
      setOpen(false);
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  async function remove(r: SimpleRow) {
    if (!confirm(`Excluir "${r.name}"?`)) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", r.id);
      if (error) throw error;
      enqueueSnackbar("Excluído", { variant: "success" });
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  const cols: GridColDef[] = [
    { field: "name", headerName: "Nome", flex: 1, minWidth: 200 },
    {
      field: "actions",
      headerName: "Ações",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const r = p.row as SimpleRow;
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => openEdit(r)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" color="error" onClick={() => remove(r)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Novo {label.toLowerCase()}
        </Button>
      </Stack>

      <Paper sx={{ height: 500 }} elevation={1}>
        <DataGrid
          rows={rows}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.id}
          density="standard"
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: `Nenhum(a) ${label.toLowerCase()}` }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `Editar ${label}` : `Novo ${label}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={save}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function BlocksCrud() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlockRow | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("global");
  const [sort, setSort] = useState("0");

  const KINDS = [
    { value: "global", label: "Globais" },
    { value: "comportamental", label: "Comportamentais" },
    { value: "tecnica", label: "Técnicas" },
    { value: "cultural", label: "Aderência Cultural" },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("competency_blocks")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as BlockRow[]);
    } catch (e: any) {
      console.error("[BlocksCrud] Erro ao carregar blocos:", e);
      enqueueSnackbar("Erro ao carregar blocos", { variant: "error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setName("");
    setKind("global");
    setSort("0");
    setOpen(true);
  }

  function openEdit(r: BlockRow) {
    setEditing(r);
    setName(r.name);
    setKind(r.kind);
    setSort(String(r.sort_order ?? 0));
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar("Informe o nome", { variant: "warning" });
      return;
    }
    try {
      if (editing) {
        const { error } = await supabase
          .from("competency_blocks")
          .update({ name: name.trim(), kind, sort_order: parseInt(sort) || 0 })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("competency_blocks")
          .insert({ name: name.trim(), kind, sort_order: parseInt(sort) || 0 });
        if (error) throw error;
      }
      enqueueSnackbar("Salvo", { variant: "success" });
      setOpen(false);
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  async function remove(r: BlockRow) {
    if (!confirm(`Excluir "${r.name}"?`)) return;
    try {
      const { error } = await supabase.from("competency_blocks").delete().eq("id", r.id);
      if (error) throw error;
      enqueueSnackbar("Excluído", { variant: "success" });
      load();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;

  const cols: GridColDef[] = [
    { field: "sort_order", headerName: "Ordem", width: 90 },
    { field: "name", headerName: "Nome", flex: 1, minWidth: 200 },
    {
      field: "kind",
      headerName: "Tipo",
      width: 150,
      renderCell: (p) => <Chip label={kindLabel(p.value)} size="small" />,
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const r = p.row as BlockRow;
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => openEdit(r)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" color="error" onClick={() => remove(r)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Novo bloco
        </Button>
      </Stack>

      <Paper sx={{ height: 500 }} elevation={1}>
        <DataGrid
          rows={rows}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.id}
          density="standard"
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "Nenhum bloco" }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Editar bloco" : "Novo bloco"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              fullWidth
            >
              {KINDS.map((k) => (
                <MenuItem key={k.value} value={k.value}>
                  {k.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Ordem"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={save}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function QuestionsCrud() {
  const { enqueueSnackbar } = useSnackbar();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [text, setText] = useState("");
  const [blockId, setBlockId] = useState("");
  const [sort, setSort] = useState("0");
  const [active, setActive] = useState(true);
  const [blockFilter, setBlockFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  const loadBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("competency_blocks")
        .select("id, name")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setBlocks((data ?? []) as { id: string; name: string }[]);
    } catch (e: any) {
      console.error("[QuestionsCrud] Erro ao carregar blocos:", e);
      enqueueSnackbar("Erro ao carregar blocos", { variant: "error" });
      setBlocks([]);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select(
          `id, block_id, text, sort_order, active,
           competency_blocks:block_id(name)`
        )
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setQuestions((data ?? []) as QuestionRow[]);
    } catch (e: any) {
      console.error("[QuestionsCrud] Erro ao carregar perguntas:", e);
      enqueueSnackbar("Erro ao carregar perguntas", { variant: "error" });
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
    loadQuestions();
  }, []);

  function openNew() {
    setEditing(null);
    setText("");
    setBlockId("");
    setSort("0");
    setActive(true);
    setOpen(true);
  }

  function openEdit(q: QuestionRow) {
    setEditing(q);
    setText(q.text);
    setBlockId(q.block_id);
    setSort(String(q.sort_order ?? 0));
    setActive(q.active);
    setOpen(true);
  }

  async function save() {
    if (!text.trim()) {
      enqueueSnackbar("Informe o texto da pergunta", { variant: "warning" });
      return;
    }
    if (!blockId) {
      enqueueSnackbar("Selecione um bloco", { variant: "warning" });
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from("questions")
          .update({
            text: text.trim(),
            block_id: blockId,
            sort_order: parseInt(sort) || 0,
            active,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("questions").insert({
          text: text.trim(),
          block_id: blockId,
          sort_order: parseInt(sort) || 0,
          active,
        });
        if (error) throw error;
      }
      enqueueSnackbar("Salvo", { variant: "success" });
      setOpen(false);
      loadQuestions();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  async function toggleActive(q: QuestionRow) {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ active: !q.active })
        .eq("id", q.id);
      if (error) throw error;
      loadQuestions();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  async function remove(q: QuestionRow) {
    const { data: answers } = await supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("question_id", q.id);

    if ((answers?.length ?? 0) > 0) {
      enqueueSnackbar(
        "Esta pergunta tem respostas vinculadas. Você só pode desativá-la.",
        { variant: "warning" }
      );
      return;
    }

    if (!confirm('Excluir pergunta "' + q.text.slice(0, 50) + '..."?')) return;

    try {
      const { error } = await supabase.from("questions").delete().eq("id", q.id);
      if (error) throw error;
      enqueueSnackbar("Excluída", { variant: "success" });
      loadQuestions();
    } catch (e: any) {
      enqueueSnackbar(`Erro: ${e.message}`, { variant: "error" });
    }
  }

  const filtered = useMemo(() => {
    let result = questions;

    if (blockFilter) {
      result = result.filter((q) => q.block_id === blockFilter);
    }

    if (statusFilter === "active") {
      result = result.filter((q) => q.active);
    } else if (statusFilter === "inactive") {
      result = result.filter((q) => !q.active);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((q) => q.text.toLowerCase().includes(s));
    }

    return result;
  }, [questions, blockFilter, statusFilter, search]);

  const cols: GridColDef[] = [
    {
      field: "competency_blocks",
      headerName: "Bloco",
      width: 180,
      renderCell: (p) => {
        const name = (p.row as QuestionRow).competency_blocks?.name ?? "—";
        return <Chip label={name} size="small" />;
      },
    },
    {
      field: "text",
      headerName: "Pergunta",
      flex: 1,
      minWidth: 250,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
          {p.value}
        </Typography>
      ),
    },
    { field: "sort_order", headerName: "Ordem", width: 90 },
    {
      field: "active",
      headerName: "Status",
      width: 100,
      renderCell: (p) => (
        <Chip
          label={p.value ? "Ativa" : "Inativa"}
          size="small"
          color={p.value ? "success" : "default"}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (p) => {
        const q = p.row as QuestionRow;
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={q.active ? "Desativar" : "Ativar"}>
              <IconButton size="small" onClick={() => toggleActive(q)}>
                {q.active ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <VisibilityOffIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => openEdit(q)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" color="error" onClick={() => remove(q)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "flex-end" }}>
        <TextField
          select
          label="Bloco"
          value={blockFilter ?? ""}
          onChange={(e) => setBlockFilter(e.target.value || null)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {blocks.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">Todas</MenuItem>
          <MenuItem value="active">Ativas</MenuItem>
          <MenuItem value="inactive">Inativas</MenuItem>
        </TextField>

        <TextField
          label="Buscar"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          placeholder="Texto da pergunta..."
        />

        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Nova pergunta
        </Button>
      </Stack>

      <Paper sx={{ height: 500 }} elevation={1}>
        <DataGrid
          rows={filtered}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.id}
          density="standard"
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: "Nenhuma pergunta" }}
          sx={{ border: 0 }}
        />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Bloco"
              value={blockId}
              onChange={(e) => setBlockId(e.target.value)}
              fullWidth
              required
            >
              <MenuItem value="">Selecione um bloco</MenuItem>
              {blocks.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Pergunta"
              value={text}
              onChange={(e) => setText(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              required
              placeholder="Texto da pergunta..."
            />

            <TextField
              label="Ordem"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              fullWidth
            />

            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">Ativa</Typography>
              <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={save}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
