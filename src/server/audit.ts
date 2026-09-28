import type { Db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { redact } from "@/domain/redact";
import type { Principal } from "./principal";

// Un Db o una transacción: ambos exponen la misma API de consultas.
export type Executor = Pick<Db, "select" | "insert" | "update" | "delete" | "execute">;

export type AuditEntry = {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function audit(tx: Executor, who: Principal | "system", entry: AuditEntry) {
  const actor =
    who === "system"
      ? { actorType: "system" as const, actorId: null }
      : who.kind === "user"
        ? { actorType: "user" as const, actorId: who.id }
        : { actorType: "agent" as const, actorId: who.name };
  await tx.insert(auditLog).values({
    ...actor,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: redact(entry.metadata ?? {}) as Record<string, unknown>,
    ip: entry.ip ?? null,
  });
}
