// =====================================================================
// DEPRECATED — substituido por _shared/email.ts (SMTP corporativo).
// Mantido apenas para evitar quebrar imports antigos durante a transicao.
// Remova este arquivo apos confirmar que nada mais depende dele.
// =====================================================================
export {
  sendEmail,
  emailLayout,
  ctaButton,
  type EmailOptions,
} from "./email.ts";
