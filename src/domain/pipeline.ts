/**
 * Pipeline comercial de Núcleo.
 *
 * Define los 25 estados, qué transiciones son válidas y quién puede hacerlas.
 * Regla central: los agentes solo mueven prospectos en las etapas internas
 * (investigación, auditoría, demo, construcción). Todo lo comercial o irreversible
 * (marcar enviado, registrar respuesta, aprobar proyecto, publicar) es humano.
 */

export const PIPELINE_STATUSES = [
  "DISCOVERED",
  "RESEARCHING",
  "QUALIFIED",
  "REJECTED",
  "AUDITED",
  "DEMO_GENERATING",
  "DEMO_READY",
  "OUTREACH_READY",
  "SENT_MANUALLY",
  "WAITING_RESPONSE",
  "REPLIED_POSITIVE",
  "REPLIED_NEGATIVE",
  "FOLLOW_UP_REQUIRED",
  "DISCOVERY_REQUIRED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "APPROVED",
  "BUILDING",
  "STAGING",
  "CLIENT_REVIEW",
  "QA",
  "READY_TO_DEPLOY",
  "DEPLOYED",
  "MAINTENANCE",
  "CLOSED",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  DISCOVERED: "Descubierto",
  RESEARCHING: "Investigando",
  QUALIFIED: "Calificado",
  REJECTED: "Descartado",
  AUDITED: "Auditado",
  DEMO_GENERATING: "Generando demo",
  DEMO_READY: "Demo lista",
  OUTREACH_READY: "Mensaje listo",
  SENT_MANUALLY: "Enviado manualmente",
  WAITING_RESPONSE: "Esperando respuesta",
  REPLIED_POSITIVE: "Respondió: positivo",
  REPLIED_NEGATIVE: "Respondió: negativo",
  FOLLOW_UP_REQUIRED: "Requiere seguimiento",
  DISCOVERY_REQUIRED: "Requiere relevamiento",
  PROPOSAL_SENT: "Propuesta enviada",
  NEGOTIATION: "Negociación",
  APPROVED: "Proyecto aprobado",
  BUILDING: "En construcción",
  STAGING: "Staging",
  CLIENT_REVIEW: "Revisión del cliente",
  QA: "QA",
  READY_TO_DEPLOY: "Listo para publicar",
  DEPLOYED: "Publicado",
  MAINTENANCE: "Mantenimiento",
  CLOSED: "Cerrado",
};

/** Grupos para colorear y filtrar en el panel. */
export type StatusGroup = "prospeccion" | "contacto" | "venta" | "proyecto" | "cerrado";

export const STATUS_GROUP: Record<PipelineStatus, StatusGroup> = {
  DISCOVERED: "prospeccion",
  RESEARCHING: "prospeccion",
  QUALIFIED: "prospeccion",
  AUDITED: "prospeccion",
  DEMO_GENERATING: "prospeccion",
  DEMO_READY: "prospeccion",
  OUTREACH_READY: "contacto",
  SENT_MANUALLY: "contacto",
  WAITING_RESPONSE: "contacto",
  FOLLOW_UP_REQUIRED: "contacto",
  REPLIED_POSITIVE: "venta",
  REPLIED_NEGATIVE: "venta",
  DISCOVERY_REQUIRED: "venta",
  PROPOSAL_SENT: "venta",
  NEGOTIATION: "venta",
  APPROVED: "proyecto",
  BUILDING: "proyecto",
  STAGING: "proyecto",
  CLIENT_REVIEW: "proyecto",
  QA: "proyecto",
  READY_TO_DEPLOY: "proyecto",
  DEPLOYED: "proyecto",
  MAINTENANCE: "proyecto",
  REJECTED: "cerrado",
  CLOSED: "cerrado",
};

/** Transiciones válidas. Lo que no está acá, no se puede hacer. */
export const TRANSITIONS: Record<PipelineStatus, readonly PipelineStatus[]> = {
  DISCOVERED: ["RESEARCHING", "REJECTED"],
  RESEARCHING: ["QUALIFIED", "REJECTED"],
  QUALIFIED: ["AUDITED", "REJECTED"],
  AUDITED: ["DEMO_GENERATING", "REJECTED"],
  DEMO_GENERATING: ["DEMO_READY", "AUDITED"],
  DEMO_READY: ["OUTREACH_READY", "DEMO_GENERATING", "REJECTED"],
  OUTREACH_READY: ["SENT_MANUALLY", "DEMO_READY", "REJECTED"],
  SENT_MANUALLY: ["WAITING_RESPONSE"],
  WAITING_RESPONSE: ["REPLIED_POSITIVE", "REPLIED_NEGATIVE", "FOLLOW_UP_REQUIRED"],
  FOLLOW_UP_REQUIRED: ["SENT_MANUALLY", "CLOSED"],
  REPLIED_POSITIVE: ["DISCOVERY_REQUIRED", "PROPOSAL_SENT"],
  REPLIED_NEGATIVE: ["FOLLOW_UP_REQUIRED", "CLOSED"],
  DISCOVERY_REQUIRED: ["PROPOSAL_SENT", "CLOSED"],
  PROPOSAL_SENT: ["NEGOTIATION", "APPROVED", "FOLLOW_UP_REQUIRED", "REPLIED_NEGATIVE"],
  NEGOTIATION: ["APPROVED", "PROPOSAL_SENT", "CLOSED"],
  APPROVED: ["BUILDING"],
  BUILDING: ["STAGING"],
  STAGING: ["CLIENT_REVIEW", "QA"],
  CLIENT_REVIEW: ["BUILDING", "QA"],
  QA: ["BUILDING", "READY_TO_DEPLOY"],
  READY_TO_DEPLOY: ["DEPLOYED", "QA"],
  DEPLOYED: ["MAINTENANCE", "CLOSED"],
  MAINTENANCE: ["BUILDING", "CLOSED"],
  REJECTED: ["DISCOVERED"],
  CLOSED: [],
};

/** Estados a los que un agente puede llevar un prospecto. */
const AGENT_TARGETS: ReadonlySet<PipelineStatus> = new Set<PipelineStatus>([
  "RESEARCHING",
  "QUALIFIED",
  "REJECTED",
  "AUDITED",
  "DEMO_GENERATING",
  "DEMO_READY",
  "OUTREACH_READY",
  "STAGING",
  "QA",
]);

/**
 * Transiciones que solo puede hacer el propietario (no un operador ni un agente).
 * APPROVED es el botón "APROBAR Y COMENZAR PROYECTO".
 * DEPLOYED además exige una aprobación registrada de tipo deploy_production.
 */
const OWNER_ONLY_TARGETS: ReadonlySet<PipelineStatus> = new Set<PipelineStatus>([
  "APPROVED",
  "DEPLOYED",
]);

/** Reabrir un prospecto descartado también es decisión del propietario. */
function isOwnerOnly(from: PipelineStatus, to: PipelineStatus) {
  return OWNER_ONLY_TARGETS.has(to) || (from === "REJECTED" && to === "DISCOVERED");
}

/** Transiciones que requieren una aprobación registrada y aprobada. */
export const TRANSITION_REQUIRES_APPROVAL: Partial<Record<PipelineStatus, "deploy_production">> = {
  DEPLOYED: "deploy_production",
};

export type TransitionActor =
  | { type: "user"; role: "owner" | "operator" | "viewer" }
  | { type: "agent" }
  | { type: "system" };

export type TransitionCheck =
  | { ok: true; requiresApproval?: "deploy_production" }
  | { ok: false; reason: string };

export function canTransition(
  from: PipelineStatus,
  to: PipelineStatus,
  actor: TransitionActor,
): TransitionCheck {
  if (from === to) return { ok: false, reason: "El prospecto ya está en ese estado." };
  if (!TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      reason: `No se puede pasar de ${STATUS_LABELS[from]} a ${STATUS_LABELS[to]}.`,
    };
  }
  if (actor.type === "agent") {
    // El constructor retoma el trabajo tras aprobación, QA o staging;
    // reabrir desde mantenimiento o revisión del cliente lo decide una persona.
    const agentBuild = to === "BUILDING" && ["APPROVED", "QA", "STAGING"].includes(from);
    if (!AGENT_TARGETS.has(to) && !agentBuild) {
      return { ok: false, reason: `Solo una persona puede pasar un prospecto a ${STATUS_LABELS[to]}.` };
    }
  } else if (actor.type === "system") {
    return { ok: false, reason: "El sistema no mueve prospectos por su cuenta." };
  } else {
    if (actor.role === "viewer") return { ok: false, reason: "Tu rol es de solo lectura." };
    if (isOwnerOnly(from, to) && actor.role !== "owner") {
      return { ok: false, reason: `Solo el propietario puede pasar a ${STATUS_LABELS[to]}.` };
    }
  }
  const requiresApproval = TRANSITION_REQUIRES_APPROVAL[to];
  return requiresApproval ? { ok: true, requiresApproval } : { ok: true };
}

/** Destinos que este actor puede elegir desde el estado actual (para armar el menú del panel). */
export function allowedTargets(from: PipelineStatus, actor: TransitionActor): PipelineStatus[] {
  return TRANSITIONS[from].filter((to) => canTransition(from, to, actor).ok);
}
