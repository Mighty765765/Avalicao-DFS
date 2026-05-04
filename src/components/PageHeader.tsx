import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Stack,
  Breadcrumbs,
  Link,
  IconButton,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface Props {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  showBack?: boolean;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  showBack = true,
}: Props) {
  const navigate = useNavigate();

  const items: BreadcrumbItem[] = [
    { label: "Início", to: "/app/inicio" },
    ...breadcrumbs,
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        {items.map((item, idx) =>
          idx === items.length - 1 ? (
            <Typography key={idx} color="text.primary">
              {item.label}
            </Typography>
          ) : (
            <Link
              key={idx}
              underline="hover"
              color="inherit"
              onClick={() => item.to && navigate(item.to)}
              sx={{ cursor: "pointer" }}
            >
              {item.label}
            </Link>
          )
        )}
      </Breadcrumbs>

      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={2}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {showBack && (
            <Tooltip title="Voltar">
              <IconButton onClick={() => navigate(-1)} size="small">
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          )}
          <Box>
            <Typography variant="h5" sx={{ color: "#012639", fontWeight: 700 }}>
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Stack>
        {actions && <Box>{actions}</Box>}
      </Stack>
    </Box>
  );
}
