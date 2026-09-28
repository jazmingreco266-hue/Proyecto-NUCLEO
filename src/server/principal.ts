import { ForbiddenError, roleCan, AGENT_PERMISSIONS, type Permission, type Role } from "@/domain/permissions";

/** Quién está haciendo la acción: una persona del panel o un agente automático. */
export type Principal =
  | { kind: "user"; id: string; role: Role; name: string; email: string }
  | { kind: "agent"; name: string };

export function can(p: Principal, permission: Permission): boolean {
  return p.kind === "user" ? roleCan(p.role, permission) : AGENT_PERMISSIONS.has(permission);
}

export function assertCan(p: Principal, permission: Permission): void {
  if (!can(p, permission)) throw new ForbiddenError();
}

export function actorOf(p: Principal) {
  return p.kind === "user"
    ? { type: "user" as const, id: p.id, label: p.name }
    : { type: "agent" as const, id: p.name, label: `Agente ${p.name}` };
}

/** Error con un mensaje apto para mostrar en el panel. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class NotFoundError extends UserFacingError {
  constructor(what = "El registro") {
    super(`${what} no existe o fue eliminado.`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export { ForbiddenError };

/** Convierte cualquier error en un mensaje seguro: nunca expone detalles internos. */
export function publicMessage(err: unknown): string {
  if (err instanceof UserFacingError || err instanceof ForbiddenError) return err.message;
  return "Ocurrió un error inesperado. Quedó registrado para revisarlo.";
}
