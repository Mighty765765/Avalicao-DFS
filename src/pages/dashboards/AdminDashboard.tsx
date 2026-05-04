import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  LinearProgress,
  Chip,
  Button,
} from "@mui/material";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PeopleIcon from "@mui/icons-material/People";
import RuleIcon from "@mui/icons-material/Rule";
import HistoryIcon from "@mui/icons-material/History";
import { supabase } from "../../lib/supabase";

interface Kpis {
  totalProfiles: number;
  activeCycles: number;
  pendingActions: number;
  lateActions: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<Kpis>({
    totalProfiles: 0,
    activeCycles: 0,
    pendingActions: 0,
    lateActions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [profiles, cycles, pending, late] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("cycles").select("id", { count: "exact", head: true }).eq("status", "em_andamento"),
        supabase.from("v_pdi_actions_pending").select("action_id", { count: "exact", head: true }),
        supabase.from("v_pdi_actions_late").select("action_id", { count: "exact", head: true }),
      ]);
      setKpis({
        totalProfiles: profiles.count ?? 0,
        activeCycles: cycles.count ?? 0,
        pendingActions: pending.count ?? 0,
        lateActions: late.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const KpiCard = ({
    label,
    value,
    color,
    onClick,
  }: {
    label: string;
    value: number;
    color: string;
    onClick?: () => void;
  }) => (
    <Card sx={{ cursor: onClick ? "pointer" : "default", height: "100%" }} onClick={onClick}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3" sx={{ color, fontWeight: 700, mt: 0.5 }}>
          {loading ? "—" : value}
        </Typography>
      </CardContent>
    </Card>
  );

  const QuickAccess = ({
    label,
    icon,
    path,
    description,
  }: {
    label: string;
    icon: JSX.Element;
    path: string;
    description: string;
  }) => (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ color: "#012639" }}>{icon}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={() => navigate(path)}>
            Abrir
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ color: "#012639", fontWeight: 700, mb: 1 }}>
        Painel Administrativo (RH)
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Visão global do programa de avaliação de desempenho. KPIs operacionais e atalhos.
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
        Indicadores
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Colaboradores ativos"
            value={kpis.totalProfiles}
            color="#012639"
            onClick={() => navigate("/app/admin/colaboradores")}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Ciclos em andamento"
            value={kpis.activeCycles}
            color="#1976d2"
            onClick={() => navigate("/app/admin/ciclos")}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Ações pendentes"
            value={kpis.pendingActions}
            color="#ed6c02"
            onClick={() => navigate("/app/admin/acoes-pendentes")}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Ações em atraso"
            value={kpis.lateActions}
            color="#d32f2f"
            onClick={() => navigate("/app/admin/acoes-pendentes")}
          />
        </Grid>
      </Grid>

      {kpis.lateActions > 0 && (
        <Card
          sx={{
            mb: 3,
            bgcolor: "#fff4f4",
            border: "1px solid #ffcdd2",
          }}
        >
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip label="Alerta" color="error" size="small" />
              <Typography variant="body2">
                Existem <strong>{kpis.lateActions}</strong> ações finalizadas com atraso. Acompanhe pela tela
                de Ações Pendentes.
              </Typography>
              <Button size="small" onClick={() => navigate("/app/admin/acoes-pendentes")}>
                Ver agora
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" sx={{ color: "#012639", fontWeight: 600, mb: 2 }}>
        Acesso rápido
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <QuickAccess
            label="Ciclos"
            icon={<EventNoteIcon sx={{ fontSize: 32 }} />}
            path="/app/admin/ciclos"
            description="Criar, disparar e fechar ciclos de avaliação"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <QuickAccess
            label="Colaboradores"
            icon={<PeopleIcon sx={{ fontSize: 32 }} />}
            path="/app/admin/colaboradores"
            description="Cadastros, importação CSV, transferência de gestor"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <QuickAccess
            label="Ações Pendentes"
            icon={<RuleIcon sx={{ fontSize: 32 }} />}
            path="/app/admin/acoes-pendentes"
            description="Relatório global de ações em aberto e atrasadas"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <QuickAccess
            label="Auditoria"
            icon={<HistoryIcon sx={{ fontSize: 32 }} />}
            path="/app/admin/auditoria"
            description="Trilha de mudanças sensíveis no sistema"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
