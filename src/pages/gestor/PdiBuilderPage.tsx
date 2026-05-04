import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  MenuItem,
  Alert,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSnackbar } from "notistack";
import { supabase } from "../../lib/supabase";

interface Competency {
  block_id: string;
  block_name: string;
}

interface ActionDraft {
  id?: string;
  competency_block_id: string;
  competency_name: string;
  action: string;
  start_date: string;
  end_date: string;
  is_new?: boolean;
}

interface PDI {
  id: string;
  employee_id: string;
  employee_name: string;
  manager_id: string;
  cycle_id: string;
  acknowledged_at: string | null;
}

export default function PdiBuilderPage() {
  const { pdiId } = useParams<{ pdiId: string }>();
  const nav = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [pdi, setPdi] = useState<PDI | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCompetency, setSelectedCompetency] = useState<string>("");

  const locked = !!pdi?.acknowledged_at;

  // Competências que já têm pelo menos uma ação
  const competenciesWithActions = useMemo(() => {
    const compsWithActions = new Set(
      actions
        .map((a) => a.competency_block_id)
        .filter(Boolean)
    );
    return competencies.filter((c) => compsWithActions.has(c.block_id));
  }, [actions, competencies]);

  // Competências que ainda NÃO têm ações
  const competenciesWithoutActions = useMemo(() => {
    const compsWithActions = new Set(
      actions
        .map((a) => a.competency_block_id)
        .filter(Boolean)
    );
    return competencies.filter((c) => !compsWithActions.has(c.block_id));
  }, [actions, competencies]);

  // Agrupar ações por competência
  const actionsByCompetency = useMemo(() => {
    const grouped = new Map<string, ActionDraft[]>();
    actions.forEach((a) => {
      const key = a.competency_block_id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(a);
    });
    return grouped;
  }, [actions]);

  // Carregar PDI, competências e ações
  useEffect(() => {
    (async () => {
      if (!pdiId) return;
      try {
        // 1. Buscar PDI
        const { data: pdiData } = await supabase
          .from("pdi")
          .select(
            "id, employee_id, manager_id, cycle_id, acknowledged_at, profiles:employee_id(full_name)"
          )
          .eq("id", pdiId)
          .single();

        if (!pdiData) throw new Error("PDI não encontrado");

        const pdiInfo: PDI = {
          id: pdiData.id,
          employee_id: pdiData.employee_id,
          employee_name: (pdiData.profiles as any)?.full_name ?? "—",
          manager_id: pdiData.manager_id,
          cycle_id: pdiData.cycle_id,
          acknowledged_at: pdiData.acknowledged_at,
        };
        setPdi(pdiInfo);

        // 2. Buscar ciclo ativo
        const { data: cycleData } = await supabase
          .from("cycles")
          .select("id")
          .eq("id", pdiData.cycle_id)
          .single();

        if (!cycleData) throw new Error("Ciclo não encontrado");

        // 3. Buscar avaliação ativa
        const { data: evaluationsData } = await supabase
          .from("evaluations")
          .select("id")
          .eq("cycle_id", pdiData.cycle_id)
          .eq("evaluee_id", pdiData.employee_id)
          .in("type", ["self", "manager", "consensus"])
          .limit(1);

        if (!evaluationsData?.length) {
          setCompetencies([]);
        } else {
          const evalId = evaluationsData[0].id;

          // 4. Buscar questões respondidas nesta avaliação
          const { data: answersData } = await supabase
            .from("answers")
            .select(
              `question_id,
               questions(block_id, competency_blocks:block_id(name, id))`
            )
            .eq("evaluation_id", evalId);

          // Agrupar por block_id para obter competências únicas
          const competencyMap = new Map<string, Competency>();
          (answersData ?? []).forEach((a: any) => {
            const q = (a.questions as any);
            if (q?.block_id && !competencyMap.has(q.block_id)) {
              const blockName = (q.competency_blocks as any)?.name ?? `Competência ${q.block_id.slice(0, 8)}`;
              competencyMap.set(q.block_id, {
                block_id: q.block_id,
                block_name: blockName,
              });
            }
          });
          setCompetencies(Array.from(competencyMap.values()));
        }

        // 5. Carregar ações existentes
        const { data: actionsData } = await supabase
          .from("pdi_actions")
          .select("id, competency, action, start_date, end_date")
          .eq("pdi_id", pdiId)
          .order("competency");

        if (actionsData && actionsData.length > 0) {
          const actionsList = (actionsData as any[]).map((a) => ({
            id: a.id,
            competency_block_id: a.competency ?? "",
            competency_name: "",
            action: a.action ?? "",
            start_date: a.start_date ?? new Date().toISOString().slice(0, 10),
            end_date: a.end_date ?? new Date().toISOString().slice(0, 10),
          }));
          setActions(actionsList);
        } else {
          setActions([]);
        }

        setLoading(false);
      } catch (e: any) {
        console.error("[PdiBuilder]", e);
        enqueueSnackbar("Erro ao carregar PDI", { variant: "error" });
        setLoading(false);
      }
    })();
  }, [pdiId]);

  function addActionForCompetency(blockId: string) {
    const comp = competencies.find((c) => c.block_id === blockId);
    if (!comp) return;

    const today = new Date().toISOString().slice(0, 10);
    setActions((prev) => [
      ...prev,
      {
        competency_block_id: blockId,
        competency_name: comp.block_name,
        action: "",
        start_date: today,
        end_date: today,
        is_new: true,
      },
    ]);
    setSelectedCompetency("");
    enqueueSnackbar(`Ação criada para ${comp.block_name}`, { variant: "success" });
  }

  function removeAction(idx: number) {
    setActions((prev) => {
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
    const competenciesSet = new Set(
      actions.map((a) => a.competency_block_id).filter(Boolean)
    );

    if (competenciesSet.size < 3) {
      return "Defina no mínimo 3 competências diferentes";
    }

    if (actions.length < 3) {
      return "Defina pelo menos 3 ações (mínimo 1 por competência)";
    }

    for (const a of actions) {
      if (!a.competency_block_id)
        return "Selecione a competência para todas as ações";
      if (!a.action.trim())
        return "Descreva todas as ações";
      if (!a.start_date)
        return "Defina a data de início para todas as ações";
      if (!a.end_date)
        return "Defina a data de fim para todas as ações";
      if (new Date(a.start_date) > new Date(a.end_date)) {
        return "Data de início não pode ser posterior à data de fim";
      }
    }

    const competencyActions: Record<string, number> = {};
    actions.forEach((a) => {
      const comp = a.competency_block_id;
      if (comp) competencyActions[comp] = (competencyActions[comp] || 0) + 1;
    });

    const missingActions = Object.entries(competencyActions)
      .filter(([_, count]) => count === 0)
      .map(([comp]) => comp);

    if (missingActions.length > 0) {
      return "Todas as competências precisam ter pelo menos 1 ação";
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
      const existingIds = actions
        .filter((a) => a.id && !a.is_new)
        .map((a) => a.id);

      if (existingIds.length > 0) {
        await supabase
          .from("pdi_actions")
          .delete()
          .eq("pdi_id", pdiId)
          .in("id", existingIds);
      }

      const inserts = actions.map((a) => ({
        pdi_id: pdiId,
        competency: a.competency_block_id,
        action: a.action,
        start_date: a.start_date,
        end_date: a.end_date,
        status: "planejada",
        progress_note: null,
      }));

      const { error } = await supabase
        .from("pdi_actions")
        .insert(inserts);

      if (error) throw error;
      enqueueSnackbar("PDI salvo com sucesso", { variant: "success" });
    } catch (e: any) {
      console.error("[saveAll]", e);
      enqueueSnackbar(`Erro ao salvar: ${e.message}`, { variant: "error" });
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

    try {
      await supabase.functions.invoke("notify-pdi-events", {
        body: { event: "pdi_published", pdi_id: pdiId },
      });
    } catch (e) {
      console.warn("[publish] notify falhou:", e);
    }

    setPublishing(false);
    enqueueSnackbar("PDI publicado. Colaborador foi notificado.", {
      variant: "success",
    });
    nav("/app/gestor/equipe");
  }

  if (loading) return <Typography>Carregando...</Typography>;
  if (!pdi) return <Alert severity="error">PDI não encontrado</Alert>;

  return (
    <Box>
      <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Plano de Desenvolvimento Individual
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Colaborador: <b>{pdi.employee_name}</b>
      </Typography>

      {locked ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          O colaborador já deu ciência. O PDI está bloqueado para edição.
          Para mudanças, solicite reabertura ao admin.
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Adicione ações por competência. Mínimo 3 competências diferentes,
          mínimo 1 ação por competência.
        </Alert>
      )}

      <Stack spacing={3}>
        {competencies.length === 0 ? (
          <Alert severity="info">
            Nenhuma competência disponível para este colaborador.
          </Alert>
        ) : (
          <>
            {/* Competências em desenvolvimento */}
            {competenciesWithActions.length > 0 && (
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600 }}>
                  Competências em Desenvolvimento ({competenciesWithActions.length})
                </Typography>

                {competenciesWithActions.map((comp) => {
                  const compActions = actionsByCompetency.get(comp.block_id) ?? [];
                  return (
                    <Accordion key={comp.block_id} defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={2} alignItems="center" width="100%">
                          <Typography variant="subtitle1" fontWeight={600}>
                            {comp.block_name}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              bgcolor: "#e3f2fd",
                              color: "#1976d2",
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 600,
                            }}
                          >
                            {compActions.length} ação(ões)
                          </Typography>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={2}>
                          {compActions.map((action, localIdx) => {
                            const globalIdx = actions.indexOf(action);
                            return (
                              <Paper key={localIdx} variant="outlined" sx={{ p: 2 }}>
                                <Stack spacing={2}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle2" fontWeight={600}>
                                      Ação {localIdx + 1}
                                    </Typography>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      disabled={locked}
                                      onClick={() => removeAction(globalIdx)}
                                      title="Remover ação"
                                    >
                                      <DeleteOutlineIcon />
                                    </IconButton>
                                  </Stack>

                                  <TextField
                                    label="Descrição da Ação"
                                    value={action.action}
                                    onChange={(e) =>
                                      patchAction(globalIdx, { action: e.target.value })
                                    }
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    disabled={locked}
                                    placeholder="Descreva o que deve ser feito"
                                  />

                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                    <TextField
                                      label="Data de Início"
                                      type="date"
                                      value={action.start_date}
                                      InputLabelProps={{ shrink: true }}
                                      onChange={(e) =>
                                        patchAction(globalIdx, { start_date: e.target.value })
                                      }
                                      disabled={locked}
                                      fullWidth
                                    />
                                    <TextField
                                      label="Data de Término"
                                      type="date"
                                      value={action.end_date}
                                      InputLabelProps={{ shrink: true }}
                                      onChange={(e) =>
                                        patchAction(globalIdx, { end_date: e.target.value })
                                      }
                                      disabled={locked}
                                      fullWidth
                                    />
                                  </Stack>
                                </Stack>
                              </Paper>
                            );
                          })}

                          <Button
                            startIcon={<AddIcon />}
                            onClick={() => addActionForCompetency(comp.block_id)}
                            disabled={locked}
                            variant="outlined"
                            size="small"
                          >
                            Incluir Mais Uma Ação
                          </Button>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Stack>
            )}

            {/* Adicionar nova competência */}
            {competenciesWithoutActions.length > 0 && (
              <Paper sx={{ p: 3, bgcolor: "background.default" }}>
                <Stack spacing={2}>
                  <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600 }}>
                    Adicionar Nova Competência
                  </Typography>

                  <TextField
                    select
                    label="Selecione uma Competência"
                    value={selectedCompetency}
                    onChange={(e) => setSelectedCompetency(e.target.value)}
                    fullWidth
                    disabled={locked}
                    helperText={
                      competenciesWithoutActions.length > 0
                        ? `${competenciesWithoutActions.length} competência(s) disponível(is)`
                        : "Todas as competências já foram adicionadas"
                    }
                  >
                    <MenuItem value="">
                      -- Selecione uma competência --
                    </MenuItem>
                    {competenciesWithoutActions.map((c) => (
                      <MenuItem key={c.block_id} value={c.block_id}>
                        {c.block_name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => {
                      if (!selectedCompetency) {
                        enqueueSnackbar("Selecione uma competência", { variant: "warning" });
                        return;
                      }
                      addActionForCompetency(selectedCompetency);
                    }}
                    disabled={locked || !selectedCompetency}
                    variant="contained"
                    fullWidth
                  >
                    Criar Primeira Ação
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* Resumo de progresso */}
            {actions.length > 0 && (
              <Paper sx={{ p: 2, bgcolor: "#f5f5f5", border: "1px solid #e0e0e0" }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  Progresso: {competenciesWithActions.length} de {competencies.length} competência(s)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total de ações: {actions.length}
                </Typography>
              </Paper>
            )}
          </>
        )}
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
