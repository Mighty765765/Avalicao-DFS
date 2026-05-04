import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Button,
  Alert,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import ChecklistIcon from "@mui/icons-material/Checklist";
import RateReviewIcon from "@mui/icons-material/RateReview";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export default function GestorDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [teamSize, setTeamSize] = useState(0);
  const [pendingValidate, setPendingValidate] = useState(0);
  const [pendingMyEvals, setPendingMyEvals] = useState(0);
  const [hasOpenSelfEval, setHasOpenSelfEval] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [team, validate, myEvals, selfEval] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("manager_id", profile.id)
          .eq("status", "ativo"),
        supabase
          .from("v_pdi_actions_pending")
          .select("action_id", { count: "exact", head: true })
          .eq("status", "concluida_colaborador"),
        supabase
          .from("evaluations")
          .select("id", { count: "exact", head: true })
          .eq("evaluator_id", profile.id)
          .neq("status", "finalizado"),
        supabase
          .from("evaluations")
          .select("id")
          .eq("evaluee_id", profile.id)
          .eq("type", "self")
          .neq("status", "finalizado")
          .maybeSingle(),
      ]);
      setTeamSize(team.count ?? 0);
      setPendingValidate(validate.count ?? 0);
      setPendingMyEvals(myEvals.count ?? 0);
      setHasOpenSelfEval(selfEval.data?.id ?? null);
    })();
  }, [profile?.id]);

  return (
    <Box>
      <Typography variant="h4" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Olá, {profile?.full_name?.split(" ")[0]}!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Painel do gestor. Acompanhe sua equipe, valide ações e mantenha sua avaliação em dia.
      </Typography>

      {hasOpenSelfEval && (
        <Alert
          severity="warning"
          action={
            <Button
              size="small"
              onClick={() => navigate(`/app/colaborador/avaliacoes/${hasOpenSelfEval}`)}
            >
              Preencher
            </Button>
          }
          sx={{ mb: 3 }}
        >
          Você tem uma <strong>autoavaliação pendente</strong> para preencher como avaliado.
        </Alert>
      )}

      <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
        Visão geral
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <GroupIcon sx={{ fontSize: 40, color: "#012639" }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Liderados
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "#012639" }}>
                    {teamSize}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <RateReviewIcon sx={{ fontSize: 40, color: "#1976d2" }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Avaliações pendentes
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "#1976d2" }}>
                    {pendingMyEvals}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <ChecklistIcon sx={{ fontSize: 40, color: "#ed6c02" }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Ações para validar
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "#ed6c02" }}>
                    {pendingValidate}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
        Ações rápidas
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ cursor: "pointer", "&:hover": { boxShadow: 4 } }}>
            <CardContent onClick={() => navigate("/app/gestor/equipe")}>
              <Stack spacing={1}>
                <GroupIcon sx={{ fontSize: 32, color: "#012639" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Minha Equipe
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status de cada liderado: avaliação, consenso e PDI.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ cursor: "pointer", "&:hover": { boxShadow: 4 } }}>
            <CardContent onClick={() => navigate("/app/gestor/pdi/validar")}>
              <Stack spacing={1}>
                <ChecklistIcon sx={{ fontSize: 32, color: "#ed6c02" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Validar Ações
                  {pendingValidate > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      label={pendingValidate}
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Finalize ou des-finalize ações concluídas pela equipe.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ cursor: "pointer", "&:hover": { boxShadow: 4 } }}>
            <CardContent onClick={() => navigate("/app/gestor/historico")}>
              <Stack spacing={1}>
                <RateReviewIcon sx={{ fontSize: 32, color: "#012639" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Histórico da Equipe
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avaliações e PDIs já encerrados de quem você liderou.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
