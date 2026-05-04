import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { supabase } from "../lib/supabase";

interface Props {
  pdiId: string;
  acknowledgedAt: string | null;
  onAcknowledged?: () => void;
}

export default function PdiAcknowledgeBanner({
  pdiId,
  acknowledgedAt,
  onAcknowledged,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (acknowledgedAt) return null;

  async function confirm() {
    setSubmitting(true);
    const { error } = await supabase.rpc("acknowledge_pdi", {
      p_pdi_id: pdiId,
      p_note: note || null,
    });
    setSubmitting(false);
    if (error) {
      enqueueSnackbar(error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar("Ciencia registrada. Bom desenvolvimento!", {
      variant: "success",
    });
    setOpen(false);
    onAcknowledged?.();
  }

  return (
    <>
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => setOpen(true)}>
            Dou ciencia
          </Button>
        }
      >
        Seu PDI foi disponibilizado pelo gestor. Por favor, confirme a ciencia
        do plano antes de iniciar as acoes.
      </Alert>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Confirmar ciencia do PDI</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Comentario (opcional)"
              multiline
              rows={4}
              fullWidth
              value={note}
              onChange={(e) => setNote(e.target.value)}
              helperText="Use este espaco para registrar duvidas, alinhamentos ou compromissos."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={confirm} disabled={submitting}>
            {submitting ? "Salvando..." : "Confirmar ciencia"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
