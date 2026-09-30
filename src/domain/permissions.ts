/**
 * Roles y permisos. Principio de mínimo privilegio: cada rol tiene exactamente
 * lo que necesita, y los agentes nunca pueden decidir aprobaciones.
 */

export const ROLES = ["owner", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propietario",
  operator: "Operador",
  viewer: "Solo lectura",
};

export const PERMISSIONS = [
  "prospects.read",
  "prospects.write",
  "prospects.transition",
  "facts.write",
  "notes.write",
  "approvals.read",
  "approvals.request",
  "approvals.decide",
  "settings.read",
  "settings.write",
  "users.manage",
  "audit.read",
  // Ventas, gastos, presupuestos y balances: información sensible del negocio.
  "finance.read",
  "finance.write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  operator: new Set<Permission>([
    "prospects.read",
    "prospects.write",
    "prospects.transition",
    "facts.write",
    "notes.write",
    "approvals.read",
    "approvals.request",
    "settings.read",
  ]),
  viewer: new Set<Permission>(["prospects.read", "approvals.read", "settings.read"]),
};

/** Permisos de los agentes automáticos (etapa 3+). */
export const AGENT_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "prospects.read",
  "prospects.write",
  "prospects.transition",
  "facts.write",
  "approvals.request",
  "settings.read",
]);

export function roleCan(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export class ForbiddenError extends Error {
  constructor(message = "No tenés permiso para hacer esto.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
