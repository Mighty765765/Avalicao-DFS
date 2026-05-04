import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Button,
  Alert,
  Chip,
  LinearProgress,
} from "@mui/material";
import RateReviewIcon from "@mui/icons-material/RateReview";
import AssignmentIcon from "@mui/icons-material/Assignment";
import HistoryIcon from "@mui/icons-material/History";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export default function ColaboradorDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [openSelfEval, setOpenSelfEval] = useState<string | null>(null);
  const [hasPdi, setHasPdi] = useState(false);
  const [actionsTotal, setActionsTotal] = useState(0);
  const [actionsDone, setActionsDone] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [selfEval, pdi] = await Promise.all([
        supabase
          .from("evaluations")
          .select("id")
          .eq("evaluee_id", profile.id)
          .eq("type", "self")
          .neq("status", "finalizado")
          .maybeSingle(),
        supabase
          .from("pdi")
          .select("id")
          .eq("employee_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setOpenSelfEval(selfEval.data?.id ?? null);
      setHasPdi(!!pdi.data);

      if (pdi.data) {
        const { data: actions } = await supabase
          .from("pdi_actions")
          .select("id, status")
          .eq("pdi_id", pdi.data.id);
        setActionsTotal(actions?.length ?? 0);
        setActionsDone(
          actions?.filter((a) => a.status === "finalizada" || a.status === "concluida_colaborador").length ?? 0
        );
      }
      setLoading(false);
    })();
  }, [profile?.id]);

  const progress = actionsTotal > 0 ? (actionsDone / actionsTotal) * 100 : 0;

  return (
    <Box>
      <Typography variant="h4" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Olá, {profile?.full_name?.split(" ")[0]}!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Acompanhe sua autoavaliação e o seu plano de desenvolvimento individual.
      </Typography>

      {openSelfEval && (
        <Alert
          severity="warning"
          action={
            <Button
              size="small"
              onClick={() => navigate(`/app/colaborador/avaliacoes/${openSelfEval}`)}
            >
              Preencher
            </Button>
          }
          sx={{ mb: 3 }}
        >
          Você tem uma <strong>autoavaliação aberta</strong>. Preencha o quanto antes para que seu gestor
          possa avaliar e fechar o consenso.
        </Alert>
      )}

      {!openSelfEval && !hasPdi && !loading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Você não tem nenhuma avaliação ou PDI ativo no momento. Quando o RH abrir um novo ciclo, você será
          avisado por e-mail.
        </Alert>
      )}

      <Grid container spacing={2}>
        {openSelfEval && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1}>
                  <RateReviewIcon sx={{ fontSize: 32, color: "#1976d2" }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Minha Avaliação
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avaliação atual em andamento. Salve rascunho ou envie quando estiver pronta.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate(`/app/colaborador/avaliacoes/${openSelfEval}`)}
                    sx={{ mt: 1, alignSelf: "flex-start" }}
                  >
                    Abrir avaliação
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {hasPdi && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1}>
                  <AssignmentIcon sx={{ fontSize: 32, color: "#012639" }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Meu PDI
                    {actionsTotal > 0 && (
                      <Chip
                        size="small"
                        label={`${actionsDone}/${actionsTotal}`}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Plano de desenvolvimento individual com pontos a evoluir e ações.
                  </Typography>
                  {actionsTotal > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress variant="determinate" value={progress} />
                      <Typography variant="caption" color="text.secondary">
                        {progress.toFixed(0)}% concluído
                      </Typography>
                    </Box>
                  )}
                  <Button
                    variant="contained"
                    onClick={() => navigate("/app/colaborador/pdi")}
                    sx={{ mt: 1, alignSelf: "flex-start" }}
                  >
                    Abrir PDI
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={1}>
                <HistoryIcon sx={{ fontSize: 32, color: "#012639" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Histórico
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avaliações e PDIs encerrados de ciclos anteriores.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/app/colaborador/historico")}
                  sx={{ mt: 1, alignSelf: "flex-start" }}
                >
                  Ver histórico
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
