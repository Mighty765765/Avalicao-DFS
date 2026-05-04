import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Container,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import RateReviewIcon from "@mui/icons-material/RateReview";
import AssignmentIcon from "@mui/icons-material/Assignment";
import HistoryIcon from "@mui/icons-material/History";
import GroupIcon from "@mui/icons-material/Group";
import ChecklistIcon from "@mui/icons-material/Checklist";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import RuleIcon from "@mui/icons-material/Rule";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const DRAWER_WIDTH = 270;

interface MenuItemDef {
  label: string;
  path: string;
  icon: JSX.Element;
}

interface MenuGroup {
  title?: string;
  items: MenuItemDef[];
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { profile, signOut } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [hasOpenSelfEval, setHasOpenSelfEval] = useState<string | null>(null);
  const [hasActivePdi, setHasActivePdi] = useState(false);

  // Detecta se o usuário tem autoavaliação aberta como avaliado
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: selfEval } = await supabase
        .from("evaluations")
        .select("id")
        .eq("evaluee_id", profile.id)
        .eq("type", "self")
        .neq("status", "finalizado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setHasOpenSelfEval(selfEval?.id ?? null);

      const { data: pdi } = await supabase
        .from("pdi")
        .select("id")
        .eq("employee_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setHasActivePdi(!!pdi);
    })();
  }, [profile?.id]);

  const isAdmin = profile?.role === "admin";
  const isGestor = profile?.role === "gestor" || isAdmin;

  const groups: MenuGroup[] = [];

  // Bloco "Eu" (todos)
  const euItems: MenuItemDef[] = [
    { label: "Início", path: "/app/inicio", icon: <DashboardIcon /> },
  ];
  if (hasOpenSelfEval) {
    euItems.push({
      label: "Minha Avaliação",
      path: `/app/colaborador/avaliacoes/${hasOpenSelfEval}`,
      icon: <RateReviewIcon />,
    });
  }
  if (hasActivePdi) {
    euItems.push({
      label: "Meu PDI",
      path: "/app/colaborador/pdi",
      icon: <AssignmentIcon />,
    });
  }
  euItems.push({
    label: "Histórico",
    path: "/app/colaborador/historico",
    icon: <HistoryIcon />,
  });
  groups.push({ title: "Eu", items: euItems });

  // Bloco "Equipe" (gestor + admin)
  if (isGestor) {
    groups.push({
      title: "Equipe",
      items: [
        { label: "Minha Equipe", path: "/app/gestor/equipe", icon: <GroupIcon /> },
        {
          label: "Validar Ações",
          path: "/app/gestor/pdi/validar",
          icon: <ChecklistIcon />,
        },
        {
          label: "Histórico da Equipe",
          path: "/app/gestor/historico",
          icon: <ManageHistoryIcon />,
        },
      ],
    });
  }

  // Bloco "Administração RH"
  if (isAdmin) {
    groups.push({
      title: "Administração RH",
      items: [
        { label: "Ciclos", path: "/app/admin/ciclos", icon: <EventNoteIcon /> },
        {
          label: "Colaboradores",
          path: "/app/admin/colaboradores",
          icon: <PeopleIcon />,
        },
        {
          label: "Avaliações",
          path: "/app/admin/avaliacoes",
          icon: <DescriptionIcon />,
        },
        { label: "PDI", path: "/app/admin/pdi", icon: <AssignmentIcon /> },
        {
          label: "Ações Pendentes",
          path: "/app/admin/acoes-pendentes",
          icon: <RuleIcon />,
        },
        { label: "Auditoria", path: "/app/admin/auditoria", icon: <HistoryIcon /> },
        {
          label: "Configurações",
          path: "/app/admin/configuracoes",
          icon: <SettingsIcon />,
        },
      ],
    });
  }

  // Footer
  groups.push({
    items: [
      { label: "Meu perfil", path: "/app/perfil", icon: <AccountCircleIcon /> },
    ],
  });

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      setAnchorEl(null);
      console.log("[AppLayout] Iniciando logout...");
      await signOut();
      console.log("[AppLayout] Logout realizado, navegando para /login");
      // Usar replace para evitar voltar via história
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("[AppLayout] Erro no logout:", err);
      // Mesmo em caso de erro, redirecionar para login
      navigate("/login", { replace: true });
    }
  };

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel: Record<string, string> = {
    admin: "Administrador (RH)",
    gestor: "Gestor",
    colaborador: "Colaborador",
  };

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2, py: 1.5, justifyContent: "center" }}>
        <Box
          component="img"
          src="/brand/DFS_ORIGINAL.png"
          alt="DFS"
          sx={{ height: 150, objectFit: "contain" }}
        />
      </Toolbar>
      <Divider />
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {groups.map((group, gIdx) => (
          <Box key={gIdx} sx={{ mb: 1 }}>
            {group.title && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 3,
                  pt: 1,
                  pb: 0.5,
                  color: "text.secondary",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontSize: 11,
                }}
              >
                {group.title}
              </Typography>
            )}
            <List dense disablePadding>
              {group.items.map((item) => {
                const active =
                  location.pathname === item.path ||
                  (item.path !== "/app/inicio" &&
                    location.pathname.startsWith(item.path));
                return (
                  <ListItem key={item.path} disablePadding sx={{ px: 1 }}>
                    <ListItemButton
                      selected={active}
                      onClick={() => handleNav(item.path)}
                      sx={{
                        borderRadius: 1,
                        py: 0.75,
                        "&.Mui-selected": {
                          bgcolor: "#012639",
                          color: "#fff",
                          "& .MuiListItemIcon-root": { color: "#fff" },
                          "&:hover": { bgcolor: "#023a52" },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 14 }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            {gIdx < groups.length - 1 && <Divider sx={{ mt: 1 }} />}
          </Box>
        ))}
      </Box>
      <Divider />
      <Box sx={{ p: 2, fontSize: 11, color: "text.secondary", textAlign: "center" }}>
        DFS — Avaliação de Desempenho 180º
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f7fa" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: "#fff",
          color: "#012639",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Avaliação de Desempenho 180º
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {profile?.full_name || profile?.email}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {roleLabel[profile?.role || ""] || profile?.role}
              </Typography>
            </Box>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar sx={{ bgcolor: "#012639", width: 36, height: 36, fontSize: 14 }}>
                {initials}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate("/app/perfil");
                }}
              >
                <ListItemIcon>
                  <AccountCircleIcon fontSize="small" />
                </ListItemIcon>
                Meu perfil
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Sair
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: "1px solid #e0e0e0",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
