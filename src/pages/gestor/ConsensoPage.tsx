import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Rating,
  Divider,
  Alert,
  Chip,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  Card,
  CardContent,
  Tooltip,
} from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";

interface Row {
  question_id: string;
  question_text: string;
  position: number;
  self_score: number | null;
  self_comment: string | null;
  manager_score: number | null;
  manager_comment: string | null;
  consensus_score: number | null;
  consensus_comment: string | null;
}

interface Suggestion {
  question_id: string;
  question_text: string;
  score: number;
}

export default function ConsensoPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const nav = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [evalRow, setEvalRow] = useState<any>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { score: number | null; comment: string }>
  >({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selfStatus, setSelfStatus] = useState<string | null>(null);
  const [managerStatus, setManagerStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!evaluationId) return;
      const { data: ev } = await supabase
        .from("evaluations")
        .select(
          "id, status, type, employee_id, cycle_id, profiles:employee_id(full_name)"
        )
        .eq("id", evaluationId)
        .single();
      setEvalRow(ev);
      setEmployeeName((ev as any)?.profiles?.full_name ?? "");

      // Buscar status das avaliações self e manager
      const { data: evals } = await supabase
        .from("evaluations")
        .select("type, status")
        .eq("cycle_id", ev?.cycle_id)
        .eq("evaluee_id", ev?.employee_id)
        .in("type", ["self", "manager"]);

      evals?.forEach((e: any) => {
        if (e.type === "self") setSelfStatus(e.status);
        if (e.type === "manager") setManagerStatus(e.status);
      });

      const { data: side } = await supabase
        .from("v_consensus_side_by_side")
        .select("*")
        .eq("consensus_eval_id", evaluationId);
      const sorted = (side ?? []).sort(
        (a: any, b: any) => a.position - b.position
      ) as Row[];
      setRows(sorted);

      const dict: Record<string, { score: number | null; comment: string }> = {};
      sorted.forEach((r) => {
        dict[r.question_id] = {
          score: r.consensus_score ?? null,
          comment: r.consensus_comment ?? "",
        };
      });
      setDrafts(dict);

      const { data: sug } = await supabase.rpc("suggest_pdi_points", {
        p_consensus_eval: evaluationId,
      });
      setSuggestions((sug ?? []) as Suggestion[]);
      // Pre-marca as 3 sugeridas
      setSelected(new Set((sug ?? []).map((s: any) => s.question_id)));

      setLoading(false);
    })();
  }, [evaluationId]);

  const progress = useMemo(() => {
    const total = rows.length || 1;
    const done = rows.filter((r) => drafts[r.question_id]?.score != null).length;
    return Math.round((done / total) * 100);
  }, [drafts, rows]);

  function setDraft(
    qid: string,
    patch: Partial<{ score: number | null; comment: string }>
  ) {
    setDrafts((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  function toggleSelected(qid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }

  async function saveDraft() {
    if (!evaluationId) return;
    const upserts = Object.entries(drafts).map(([qid, d]) => ({
      evaluation_id: evaluationId,
      question_id: qid,
      score: d.score,
      comment: d.comment || null,
    }));
    const { error } = await supabase
      .from("answers")
      .upsert(upserts, { onConflict: "evaluation_id,question_id" });
    if (error) enqueueSnackbar(error.message, { variant: "error" });
    else enqueueSnackbar("Rascunho do consenso salvo", { variant: "success" });
  }

  async function submitConsenso() {
    if (progress < 100) {
      enqueueSnackbar("Defina a nota de consenso para todas as questoes", {
        variant: "warning",
      });
      return;
    }
    if (selected.size < 3) {
      enqueueSnackbar(
        "Selecione no minimo 3 pontos a desenvolver para gerar o PDI",
        { variant: "warning" }
      );
      return;
    }
    if (selected.size > 8) {
      const ok = window.confirm(
        `Voce selecionou ${selected.size} pontos. Muitos pontos diluem o foco do PDI. Deseja continuar?`
      );
      if (!ok) return;
    }
    setSubmitting(true);
    await saveDraft();
    const { error } = await supabase.rpc("finalize_consensus", {
      p_eval_id: evaluationId,
      p_selected_questions: Array.from(selected),
    });
    setSubmitting(false);
    if (error) {
      enqueueSnackbar(error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar(
      "Consenso fechado. PDI criado com os pontos selecionados.",
      { variant: "success" }
    );
    nav("/app/gestor/equipe");
  }

  if (loading) return <LinearProgress />;
  if (!evalRow) return <Alert severity="error">Consenso nao encontrado</Alert>;

  const finalized = evalRow.status === "finalizado";

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Consenso da avaliacao
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Colaborador: <b>{employeeName}</b>
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box flex={1}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
          <Chip label={`${progress}% definido`} size="small" />
          <Chip
            label={`${selected.size} ponto(s) selecionado(s)`}
            size="small"
            color={
              selected.size >= 3 && selected.size <= 8
                ? "primary"
                : selected.size > 8
                ? "warning"
                : "default"
            }
          />
        </Stack>
      </Paper>

      {finalized && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Consenso ja finalizado. PDI gerado.
        </Alert>
      )}

      {!finalized && (
        <>
          {selfStatus !== "finalizado" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ⚠️ <b>Autoavaliação do colaborador não foi finalizada.</b> O consenso só pode ser fechado após a autoavaliação estar completa.
            </Alert>
          )}
          {managerStatus !== "finalizado" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              ⚠️ <b>Avaliação do gestor não foi finalizada.</b> O consenso só pode ser fechado após a sua avaliação estar completa.
            </Alert>
          )}
        </>
      )}

      {!finalized && suggestions.length > 0 && (
        <Card
          variant="outlined"
          sx={{ mb: 2, borderColor: "#0041c0", bgcolor: "#f5f8ff" }}
        >
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <LightbulbOutlinedIcon sx={{ color: "#0041c0" }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Sugestao automatica do sistema
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Marcamos automaticamente as 3 questoes com menor nota no consenso.
              Voce pode trocar livremente — minimo 3, sem teto (acima de 8 alertamos).
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {suggestions.map((s) => (
                <Chip
                  key={s.question_id}
                  label={`${s.question_text.slice(0, 40)}... (nota ${s.score})`}
                  size="small"
                  color="primary"
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack spacing={2}>
        {rows.map((r) => (
          <Paper key={r.question_id} sx={{ p: 3 }}>
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              spacing={2}
            >
              <Typography variant="body1" fontWeight={500}>
                {r.position}. {r.question_text}
              </Typography>
              <Tooltip title="Selecionar como ponto a desenvolver no PDI">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected.has(r.question_id)}
                      onChange={() => toggleSelected(r.question_id)}
                      disabled={finalized}
                    />
                  }
                  label="Ponto PDI"
                />
              </Tooltip>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Box flex={1}>
                <Typography variant="caption" color="text.secondary">
                  Autoavaliacao do colaborador
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Rating value={r.self_score ?? 0} readOnly max={5} size="small" />
                  <Chip
                    label={r.self_score ? `Nota ${r.self_score}` : "Sem nota"}
                    size="small"
                  />
                </Stack>
                {r.self_comment && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    mt={1}
                    sx={{ fontStyle: "italic" }}
                  >
                    "{r.self_comment}"
                  </Typography>
                )}
              </Box>

              <Box flex={1}>
                <Typography variant="caption" color="text.secondary">
                  Avaliacao do gestor
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Rating
                    value={r.manager_score ?? 0}
                    readOnly
                    max={5}
                    size="small"
                  />
                  <Chip
                    label={
                      r.manager_score ? `Nota ${r.manager_score}` : "Sem nota"
                    }
                    size="small"
                  />
                </Stack>
                {r.manager_comment && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    mt={1}
                    sx={{ fontStyle: "italic" }}
                  >
                    "{r.manager_comment}"
                  </Typography>
                )}
              </Box>

              <Box flex={1}>
                <Typography variant="caption" color="primary" fontWeight={600}>
                  Nota final do consenso
                </Typography>
                <Rating
                  value={drafts[r.question_id]?.score ?? 0}
                  onChange={(_, v) =>
                    setDraft(r.question_id, { score: v ?? null })
                  }
                  max={5}
                  disabled={finalized}
                />
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label="Comentario do consenso (opcional)"
                  value={drafts[r.question_id]?.comment ?? ""}
                  onChange={(e) =>
                    setDraft(r.question_id, { comment: e.target.value })
                  }
                  disabled={finalized}
                  sx={{ mt: 1 }}
                />
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {!finalized && (
        <Stack direction="row" justifyContent="flex-end" spacing={1} mt={3}>
          <Button onClick={saveDraft}>Salvar rascunho</Button>
          <Button
            variant="contained"
            onClick={submitConsenso}
            disabled={
              submitting ||
              progress < 100 ||
              selected.size < 3 ||
              selfStatus !== "finalizado" ||
              managerStatus !== "finalizado"
            }
            title={
              selfStatus !== "finalizado"
                ? "Aguarde a autoavaliação ser finalizada"
                : managerStatus !== "finalizado"
                ? "Finalize sua avaliação primeiro"
                : ""
            }
          >
            {submitting
              ? "Fechando..."
              : `Fechar consenso e gerar PDI (${selected.size} pontos)`}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
