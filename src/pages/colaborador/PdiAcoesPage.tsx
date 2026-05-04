import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  TextField,
  MenuItem,
  Alert,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import PdiAcknowledgeBanner from "../../components/PdiAcknowledgeBanner";

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

interface ActionRow {
  id: string;
  competency: string;
  action: string;
  deadline: string;
  status: keyof typeof STATUS_LABEL;
  progress_note: string | null;
}

export default function PdiAcoesPage() {
  const { profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [pdi, setPdi] = useState<any>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { status: string; progress_note: string }>
  >({});

  async function load() {
    if (!profile?.id) return;
    try {
      const { data: cur, error: pdiError } = await supabase
        .from("pdi")
        .select("id, cycle_id, acknowledged_at, manager_id")
        .eq("employee_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pdiError) throw pdiError;

      if (!cur) {
        setPdi(null);
        setActions([]);
        return;
      }

      setPdi(cur);

      const { data: acts, error: actError } = await supabase
        .from("pdi_actions")
        .select("id, competency, action, deadline, status, progress_note")
        .eq("pdi_id", cur.id)
        .order("deadline");

      if (actError) throw actError;

      setActions((acts ?? []) as ActionRow[]);

      const dd: Record<string, { status: string; progress_note: string }> = {};
      (acts ?? []).forEach((a: any) => {
        dd[a.id] = {
          status: a.status,
          progress_note: a.progress_note ?? "",
        };
      });
      setDrafts(dd);
    } catch (e: any) {
      console.error("[PdiAcoes] erro:", e);
      enqueueSnackbar("Erro ao carregar ações", { variant: "error" });
    }
  }

  useEffect(() => {
    load();
  }, [profile?.id]);

  async function save(actionId: string) {
    const draft = drafts[actionId];
    if (!draft) return;
    if (draft.status === "concluida") {
      enqueueSnackbar(
        "Ação marcada como concluída. O gestor receberá notificação.",
        { variant: "info" }
      );
    }
    const { error } = await supabase.rpc("update_action_status", {
      p_action_id: actionId,
      p_status: draft.status,
      p_progress_note: draft.progress_note || null,
    });
    if (error) {
      enqueueSnackbar(error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar("Andamento atualizado", { variant: "success" });
    if (draft.status === "concluida") {
      try {
        await supabase.functions.invoke("notify-pdi-events", {
          body: { event: "action_completed_by_employee", action_id: actionId },
        });
      } catch (e) {
        console.warn("notify falhou:", e);
      }
    }
    load();
  }

  if (!pdi) {
    return (
      <Alert severity="info">
        Nenhum PDI disponivel ainda. Aguarde o seu gestor publicar apos o
        consenso.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 2 }}>
        Meu Plano de Desenvolvimento (PDI)
      </Typography>

      <PdiAcknowledgeBanner
        pdiId={pdi.id}
        acknowledgedAt={pdi.acknowledged_at}
        onAcknowledged={load}
      />

      <Stack spacing={2}>
        {actions.length === 0 ? (
          <Alert severity="info">Nenhuma ação definida neste PDI.</Alert>
        ) : (
          actions.map((a) => {
            const isLate = a.deadline && new Date(a.deadline) < new Date() && a.status !== "concluida";
            return (
              <Paper variant="outlined" key={a.id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" mb={1}>
                  <Box flex={1}>
                    <Typography variant="overline" color="text.secondary">
                      {a.competency}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {a.action}
                    </Typography>
                  </Box>
                  <Chip
                    label={STATUS_LABEL[a.status]}
                    color={STATUS_COLOR[a.status]}
                    size="small"
                  />
                </Stack>
                <Typography
                  variant="caption"
                  color={isLate ? "error" : "text.secondary"}
                >
                  Prazo: {a.deadline}{" "}
                  {isLate && <b>(em atraso)</b>}
                </Typography>

                {a.status !== "concluida" && pdi.acknowledged_at && (
                  <Stack spacing={1} mt={2}>
                    <TextField
                      select
                      size="small"
                      label="Status"
                      value={drafts[a.id]?.status ?? a.status}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [a.id]: {
                            ...(p[a.id] ?? {
                              progress_note: a.progress_note ?? "",
                            }),
                            status: e.target.value,
                          },
                        }))
                      }
                    >
                      <MenuItem value="planejada">Planejada</MenuItem>
                      <MenuItem value="em_andamento">Em andamento</MenuItem>
                      <MenuItem value="concluida">Concluída</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      multiline
                      rows={2}
                      label="Comentario / progresso"
                      value={drafts[a.id]?.progress_note ?? ""}
                      onChange={(e) =>
                        setDrafts((p) => ({
                          ...p,
                          [a.id]: {
                            ...(p[a.id] ?? { status: a.status }),
                            progress_note: e.target.value,
                          },
                        }))
                      }
                    />
                    <Stack direction="row" justifyContent="flex-end">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => save(a.id)}
                      >
                        Salvar andamento
                      </Button>
                    </Stack>
                  </Stack>
                )}

                {!pdi.acknowledged_at && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Confirme a ciencia do PDI no banner acima para liberar
                    o preenchimento desta acao.
                  </Alert>
                )}
              </Paper>
            );
          })
        )}
      </Stack>
    </Box>
  );
}
