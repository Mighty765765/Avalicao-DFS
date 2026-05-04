import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { SnackbarProvider } from "notistack";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import App from "./App";
import { dfsTheme } from "./theme/dfsTheme";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={dfsTheme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>
);
