/**
 * Acciones sensibles (sección 4.2 del documento maestro).
 * Un agente puede prepararlas, pero solo se ejecutan con aprobación humana explícita.
 */

export const APPROVAL_ACTIONS = [
  "send_email",
  "send_whatsapp",
  "submit_contact_form",
  "publish_social",
  "buy_domain",
  "contract_hosting",
  "make_payment",
  "deploy_production",
  "change_dns",
  "modify_client_site",
  "access_client_data",
  "delete_files",
  "modify_production_db",
  "contact_company",
  "start_project",
  "delete_production_data",
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const APPROVAL_LABELS: Record<ApprovalAction, string> = {
  send_email: "Enviar correo",
  send_whatsapp: "Enviar WhatsApp",
  submit_contact_form: "Completar formulario de contacto",
  publish_social: "Publicar en redes sociales",
  buy_domain: "Comprar dominio",
  contract_hosting: "Contratar hosting",
  make_payment: "Realizar pago",
  deploy_production: "Publicar en producción",
  change_dns: "Cambiar DNS",
  modify_client_site: "Modificar el sitio real del cliente",
  access_client_data: "Acceder o migrar datos reales",
  delete_files: "Eliminar archivos",
  modify_production_db: "Modificar base de datos de producción",
  contact_company: "Contactar a una empresa",
  start_project: "Aprobar y comenzar proyecto",
  delete_production_data: "Borrar datos de producción",
};

/** Borrar datos de producción exige dos aprobaciones de personas distintas. */
export function requiredApprovals(action: ApprovalAction): 1 | 2 {
  return action === "delete_production_data" ? 2 : 1;
}

export type ApprovalState = "pending" | "approved" | "rejected" | "expired" | "executed";

export type Decision = { userId: string; decision: "approve" | "reject" };

/**
 * Calcula el estado de una aprobación a partir de sus decisiones.
 * Un solo rechazo alcanza para rechazar. Las aprobaciones se cuentan por persona.
 */
export function resolveApproval(
  required: 1 | 2,
  decisions: readonly Decision[],
  now: Date,
  expiresAt: Date | null,
): "pending" | "approved" | "rejected" | "expired" {
  if (decisions.some((d) => d.decision === "reject")) return "rejected";
  const approvers = new Set(decisions.filter((d) => d.decision === "approve").map((d) => d.userId));
  if (approvers.size >= required) return "approved";
  if (expiresAt && now >= expiresAt) return "expired";
  return "pending";
}
