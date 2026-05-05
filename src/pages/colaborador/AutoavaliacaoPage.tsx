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
} from "@mui/material";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

interface Question {
  id: string;
  text: string;
  sort_order: number;
  block_id: string;
  block_name: string;
}

interface AnswerDraft {
  score: number | null;
  comment: string;
}

export default function AutoavaliacaoPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [evalRow, setEvalRow] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!evaluationId) return;
      const { data: ev, error: evErr } = await supabase
        .from("evaluations")
        .select("id, status, type, evaluee_id, cycle_id")
        .eq("id", evaluationId)
        .single();
      if (evErr) {
        console.error("[Autoavaliacao] erro ao carregar:", evErr);
      }
      setEvalRow(ev);

      const { data: qs } = await supabase
        .from("questions")
        .select("id, text, sort_order, block_id")
        .order("sort_order");

      const { data: blocks, error: blocksErr } = await supabase
        .from("competency_blocks")
        .select("id, name");

      console.log("[Autoavaliacao] blocks loaded:", blocks, "error:", blocksErr);

      const blockMap: Record<string, string> = {};
      (blocks ?? []).forEach((b: any) => {
        blockMap[b.id] = b.name;
      });

      console.log("[Autoavaliacao] blockMap:", blockMap);

      const processed = (qs ?? []).map((q: any) => ({
        id: q.id,
        text: q.text,
        sort_order: q.sort_order,
        block_id: q.block_id,
        block_name: blockMap[q.block_id] ?? "Sem bloco",
      }));
      setQuestions(processed);

      const { data: ans } = await supabase
        .from("answers")
        .select("question_id, score, comment")
        .eq("evaluation_id", evaluationId);
      const dict: Record<string, AnswerDraft> = {};
      (qs ?? []).forEach((q: any) => {
        const found = (ans ?? []).find((a: any) => a.question_id === q.id);
        dict[q.id] = {
          score: found?.score ?? null,
          comment: found?.comment ?? "",
        };
      });
      setAnswers(dict);
      setLoading(false);
    })();
  }, [evaluationId]);

  const grouped = useMemo(() => {
    const map: Record<string, Question[]> = {};
    questions.forEach((q) => {
      const key = q.block_name ?? "Sem bloco";
      (map[key] ||= []).push(q);
    });
    return map;
  }, [questions]);

  const progress = useMemo(() => {
    const total = questions.length || 1;
    const done = Object.values(answers).filter((a) => a.score != null).length;
    return Math.round((done / total) * 100);
  }, [answers, questions]);

  function setAnswer(qid: string, patch: Partial<AnswerDraft>) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  async function saveDraft() {
    if (!evaluationId) return;
    const rows = Object.entries(answers).map(([qid, a]) => ({
      evaluation_id: evaluationId,
      question_id: qid,
      score: a.score,
      comment: a.comment || null,
    }));
    const { error } = await supabase
      .from("answers")
      .upsert(rows, { onConflict: "evaluation_id,question_id" });
    if (error) enqueueSnackbar(error.message, { variant: "error" });
    else enqueueSnackbar("Rascunho salvo", { variant: "success" });
  }

  async function submitEvaluation() {
    if (progress < 100) {
      enqueueSnackbar("Responda todas as perguntas antes de enviar", {
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    await saveDraft();
    const { error } = await supabase.rpc("finalize_self_evaluation", {
      p_eval_id: evaluationId,
    });
    setSubmitting(false);
    if (error) {
      enqueueSnackbar(error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar(
      "Autoavaliacao enviada. Apos o envio nao e possivel editar.",
      { variant: "success" }
    );
    nav("/app/colaborador/avaliacoes");
  }

  if (loading) return <LinearProgress />;
  if (!evalRow) return <Alert severity="error">Avaliacao nao encontrada</Alert>;

  const finalized = evalRow.status === "finalizado";

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Minha autoavaliacao
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {profile?.full_name} &middot; Ciclo atual
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box flex={1}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
          <Chip label={`${progress}% preenchido`} size="small" />
        </Stack>
      </Paper>

      {finalized && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sua autoavaliacao ja foi finalizada e esta bloqueada para edicao.
        </Alert>
      )}

      {Object.entries(grouped).map(([block, qs]) => (
        <Paper key={block} sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" sx={{ color: "#012639", mb: 2 }}>
            {block}
          </Typography>
          <Stack divider={<Divider />} spacing={2}>
            {qs.map((q) => (
              <Box key={q.id}>
                <Typography variant="body1" fontWeight={500} mb={1}>
                  {q.sort_order}. {q.text}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={2} mb={1}>
                  <Rating
                    value={answers[q.id]?.score ?? 0}
                    onChange={(_, v) =>
                      setAnswer(q.id, { score: v ?? null })
                    }
                    max={5}
                    disabled={finalized}
                  />
                  <Chip
                    label={
                      answers[q.id]?.score
                        ? `Nota ${answers[q.id].score}`
                        : "Sem nota"
                    }
                    size="small"
                    color={answers[q.id]?.score ? "primary" : "default"}
                  />
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  label="Comentario (opcional)"
                  value={answers[q.id]?.comment ?? ""}
                  onChange={(e) => setAnswer(q.id, { comment: e.target.value })}
                  disabled={finalized}
                />
              </Box>
            ))}
          </Stack>
        </Paper>
      ))}

      {!finalized && (
        <Stack direction="row" justifyContent="flex-end" spacing={1} mt={2}>
          <Button onClick={saveDraft}>Salvar rascunho</Button>
          <Button
            variant="contained"
            onClick={submitEvaluation}
            disabled={submitting || progress < 100}
          >
            {submitting ? "Enviando..." : "Enviar autoavaliacao"}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
