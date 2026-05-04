import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

const HEADER_BG = "#012639";
const HEADER_COLOR = "#fff";

export const dfsTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      dark: "#012639",
      main: "#0041c0",
      light: "#006ab0",
      contrastText: "#FFFFFF",
    },
    secondary: { main: "#006ab0" },
    background: { default: "#F4F6F8", paper: "#FFFFFF" },
    text: { primary: "#0B1220", secondary: "#334155" },
    error: { main: "#D32F2F" },
    success: { main: "#2E7D32" },
    warning: { main: "#ED6C02" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Inter, Roboto, Arial, sans-serif",
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: "#012639", color: "#FFFFFF" },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 0,
        },
        columnHeader: {
          backgroundColor: HEADER_BG,
          color: HEADER_COLOR,
          fontWeight: 700,
          "&:focus, &:focus-within": { outline: "none" },
        },
        columnHeaderTitle: {
          color: HEADER_COLOR,
          fontWeight: 700,
        },
        columnSeparator: {
          color: "rgba(255,255,255,0.25)",
        },
        iconButtonContainer: {
          "& .MuiIconButton-root": { color: HEADER_COLOR },
        },
        sortIcon: {
          color: HEADER_COLOR,
        },
        menuIcon: {
          "& .MuiIconButton-root": { color: HEADER_COLOR },
        },
        filterIcon: {
          color: HEADER_COLOR,
        },
      },
    },
  },
});
