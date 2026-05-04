import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Alert,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";

interface ActionDraft {
  id?: string;
  competency: string;
  action: string;
  deadline: string;
  is_new?: boolean;
}

/**
 * Tela do gestor para montar as acoes iniciais do PDI antes do colaborador
 * dar ciencia. Apos a ciencia, esta pagina entra em modo somente leitura.
 */
export default function PdiBuilderPage() {
  const { pdiId } = useParams<{ pdiId: string }>();
  const nav = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [pdi, setPdi] = useState<any>(null);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    (async () => {
      if (!pdiId) return;
      try {
        const { data: p } = await supabase
          .from("pdi")
          .select("id, employee_id, manager_id, acknowledged_at, profiles:employee_id(full_name)")
          .eq("id", pdiId)
          .single();
        setPdi(p);

        const { data: acts } = await supabase
          .from("pdi_actions")
          .select("id, competency, action, deadline")
          .eq("pdi_id", pdiId)
          .order("deadline");

        const list = (acts ?? []).map((a: any) => ({
          id: a.id,
          competency: a.competency ?? "",
          action: a.action ?? "",
          deadline: a.deadline ?? new Date().toISOString().slice(0, 10),
        })) as ActionDraft[];

        // Garante minimo 3 acoes vazias para novo PDI
        if (list.length === 0) {
          for (let i = 0; i < 3; i++) {
            list.push({
              competency: "",
              action: "",
              deadline: new Date().toISOString().slice(0, 10),
              is_new: true,
            });
          }
        }
        setActions(list);
      } catch (e: any) {
        console.error("[PdiBuilder]", e);
        enqueueSnackbar("Erro ao carregar PDI", { variant: "error" });
      }
    })();
  }, [pdiId]);

  const locked = !!pdi?.acknowledged_at;

  function addAction() {
    setActions((prev) => [
      ...prev,
      {
        competency: "",
        action: "",
        deadline: new Date().toISOString().slice(0, 10),
        is_new: true,
      },
    ]);
  }

  function removeAction(idx: number) {
    setActions((prev) => {
      if (prev.length <= 3) {
        enqueueSnackbar("Mantenha no minimo 3 acoes para o PDI", { variant: "warning" });
        return prev;
      }
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }

  function patchAction(idx: number, patch: Partial<ActionDraft>) {
    setActions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function validate(): string | null {
    const competenciesSet = new Set(actions.map(a => a.competency.trim()).filter(Boolean));

    if (competenciesSet.size < 3)
      return "Defina no minimo 3 competências diferentes";
    if (actions.length < 3)
      return "Defina pelo menos 3 acoes (minimo 1 por competência)";

    for (const a of actions) {
      if (!a.competency.trim())
        return "Todas as acoes devem ter uma competencia definida";
      if (!a.action.trim())
        return "Descreva todas as acoes";
      if (!a.deadline)
        return "Defina um prazo para todas as acoes";
    }

    // Validar que cada competencia tem pelo menos 1 acao
    const competencyActions: Record<string, number> = {};
    actions.forEach(a => {
      const comp = a.competency.trim();
      competencyActions[comp] = (competencyActions[comp] || 0) + 1;
    });

    const missingActions = Object.entries(competencyActions)
      .filter(([_, count]) => count === 0)
      .map(([comp]) => comp);

    if (missingActions.length > 0) {
      return `As seguintes competências precisam de pelo menos 1 ação: ${missingActions.join(", ")}`;
    }

    return null;
  }

  async function saveAll() {
    const err = validate();
    if (err) {
      enqueueSnackbar(err, { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const inserts = actions
        .filter((a) => a.is_new)
        .map((a) => ({
          pdi_id: pdiId,
          competency: a.competency,
          action: a.action,
          deadline: a.deadline,
          status: "planejada",
          progress_note: null,
        }));

      const updates = actions.filter((a) => !a.is_new && a.id);

      if (inserts.length) {
        const { error } = await supabase.from("pdi_actions").insert(inserts);
        if (error) throw error;
      }

      for (const a of updates) {
        const { error } = await supabase
          .from("pdi_actions")
          .update({
            competency: a.competency,
            action: a.action,
            deadline: a.deadline,
          })
          .eq("id", a.id!);
        if (error) throw error;
      }

      enqueueSnackbar("PDI salvo", { variant: "success" });
    } catch (e: any) {
      enqueueSnackbar(e.message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    const err = validate();
    if (err) {
      enqueueSnackbar(err, { variant: "warning" });
      return;
    }
    await saveAll();
    setPublishing(true);
    // Dispara notificacao via Edge Function
    try {
      await supabase.functions.invoke("notify-pdi-events", {
        body: { event: "pdi_published", pdi_id: pdiId },
      });
    } catch (e) {
      console.warn("notify-pdi-events:", e);
    }
    setPublishing(false);
    enqueueSnackbar("PDI publicado. Colaborador foi notificado.", {
      variant: "success",
    });
    nav("/app/gestor/equipe");
  }

  if (!pdi) return null;

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Plano de Desenvolvimento Individual
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Colaborador: <b>{pdi.profiles?.full_name}</b>
      </Typography>

      {locked ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          O colaborador ja deu ciencia. O PDI esta bloqueado para edicao do gestor.
          Para mudancas, solicite reabertura ao admin.
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Voce pode editar livremente enquanto o colaborador nao der ciencia.
          Apos publicar, o colaborador recebera o e-mail e podera dar ciencia
          para iniciar a execucao das acoes.
        </Alert>
      )}

      <Stack spacing={2}>
        {actions.map((a, idx) => (
          <Paper variant="outlined" key={idx} sx={{ p: 2 }}>
            <Stack spacing={1}>
              <TextField
                label="Competência"
                value={a.competency}
                onChange={(e) =>
                  patchAction(idx, { competency: e.target.value })
                }
                fullWidth
                disabled={locked}
              />
              <TextField
                label={`Ação ${idx + 1}`}
                value={a.action}
                onChange={(e) =>
                  patchAction(idx, { action: e.target.value })
                }
                fullWidth
                multiline
                minRows={2}
                disabled={locked}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  label="Prazo"
                  type="date"
                  value={a.deadline}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) =>
                    patchAction(idx, { deadline: e.target.value })
                  }
                  disabled={locked}
                  sx={{ flex: 1 }}
                />
                <IconButton
                  color="error"
                  disabled={locked}
                  onClick={() => removeAction(idx)}
                  title="Remover ação"
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => addAction()}
          disabled={locked}
          variant="outlined"
          sx={{ alignSelf: "flex-start" }}
        >
          Adicionar ação
        </Button>
      </Stack>

      {!locked && (
        <Stack direction="row" justifyContent="flex-end" spacing={1} mt={3}>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button variant="contained" onClick={publish} disabled={publishing}>
            {publishing ? "Publicando..." : "Publicar PDI"}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
