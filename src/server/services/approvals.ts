import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { approvalDecisions, approvals, prospects, users } from "@/db/schema";
import { APPROVAL_ACTIONS, requiredApprovals, resolveApproval } from "@/domain/approvals";
import { audit } from "../audit";
import {
  assertCan,
  ConflictError,
  NotFoundError,
  UserFacingError,
  actorOf,
  type Principal,
} from "../principal";

const requestSchema = z.object({
  action: z.enum(APPROVAL_ACTIONS),
  prospectId: z.string().uuid().nullable().optional(),
  summary: z.string().trim().min(5, "Describí qué se va a hacer").max(1000),
  payload: z.record(z.string(), z.unknown()).optional(),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
});

/** Crea una solicitud de aprobación. Agentes y operadores pueden pedir; nunca decidir. */
export async function requestApproval(db: Db, who: Principal, input: z.input<typeof requestSchema>) {
  assertCan(who, "approvals.request");
  const r = requestSchema.safeParse(input);
  if (!r.success) throw new UserFacingError(r.error.issues.map((i) => i.message).join(" · "));
  const data = r.data;
  const actor = actorOf(who);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(approvals)
      .values({
        action: data.action,
        prospectId: data.prospectId ?? null,
        summary: data.summary,
        payload: data.payload ?? {},
        requiredApprovals: requiredApprovals(data.action),
        requestedByType: actor.type,
        requestedById: actor.id,
        expiresAt: data.expiresInHours ? new Date(Date.now() + data.expiresInHours * 3_600_000) : null,
      })
      .returning();
    await audit(tx, who, {
      action: "approval.request",
      entityType: "approval",
      entityId: row!.id,
      metadata: { accion: data.action, prospecto: data.prospectId, resumen: data.summary },
    });
    return row!;
  });
}

/**
 * Registra la decisión de una persona. Solo el propietario decide.
 * Para borrar datos de producción hacen falta dos personas distintas.
 */
export async function decideApproval(
  db: Db,
  who: Principal,
  input: { approvalId: string; decision: "approve" | "reject"; note?: string | null },
) {
  assertCan(who, "approvals.decide");
  if (who.kind !== "user") throw new UserFacingError("Solo una persona puede decidir una aprobación.");
  if (!z.string().uuid().safeParse(input.approvalId).success) throw new NotFoundError("La solicitud");
  if (input.decision === "reject" && !input.note?.trim()) {
    throw new UserFacingError("Al rechazar, dejá una nota con el motivo.");
  }

  return db.transaction(async (tx) => {
    const [ap] = await tx
      .select()
      .from(approvals)
      .where(eq(approvals.id, input.approvalId))
      .for("update")
      .limit(1);
    if (!ap) throw new NotFoundError("La solicitud");
    if (ap.status !== "pending") throw new ConflictError("Esta solicitud ya fue resuelta.");
    const now = new Date();
    if (ap.expiresAt && ap.expiresAt <= now) {
      // No se marca acá: el throw revierte la transacción. listApprovals la marca como vencida.
      throw new ConflictError("La solicitud venció. Hay que volver a pedirla.");
    }

    const already = await tx
      .select({ userId: approvalDecisions.userId })
      .from(approvalDecisions)
      .where(and(eq(approvalDecisions.approvalId, ap.id), eq(approvalDecisions.userId, who.id)));
    if (already.length) throw new ConflictError("Ya registraste tu decisión en esta solicitud.");

    await tx.insert(approvalDecisions).values({
      approvalId: ap.id,
      userId: who.id,
      decision: input.decision,
      note: input.note?.trim() || null,
    });
    const decisions = await tx
      .select({ userId: approvalDecisions.userId, decision: approvalDecisions.decision })
      .from(approvalDecisions)
      .where(eq(approvalDecisions.approvalId, ap.id));

    const state = resolveApproval(ap.requiredApprovals as 1 | 2, decisions, now, ap.expiresAt);
    if (state !== "pending") {
      await tx.update(approvals).set({ status: state, decidedAt: now }).where(eq(approvals.id, ap.id));
    }
    await audit(tx, who, {
      action: `approval.${input.decision}`,
      entityType: "approval",
      entityId: ap.id,
      metadata: {
        accion: ap.action,
        nota: input.note,
        estado: state,
        aprobaciones: decisions.filter((d) => d.decision === "approve").length,
        requeridas: ap.requiredApprovals,
      },
    });
    return { status: state };
  });
}

export async function listApprovals(db: Db, who: Principal, status: "pending" | "resolved" = "pending") {
  assertCan(who, "approvals.read");
  // Marca como vencidas las pendientes cuya fecha límite pasó.
  await db
    .update(approvals)
    .set({ status: "expired", decidedAt: new Date() })
    .where(and(eq(approvals.status, "pending"), lt(approvals.expiresAt, new Date())));

  const statuses =
    status === "pending"
      ? (["pending"] as const)
      : (["approved", "rejected", "expired", "executed"] as const);
  const rows = await db
    .select({
      a: approvals,
      prospectName: prospects.name,
      approvalsCount: sql<number>`(SELECT count(*)::int FROM approval_decisions d WHERE d.approval_id = ${approvals.id} AND d.decision = 'approve')`,
    })
    .from(approvals)
    .leftJoin(prospects, eq(prospects.id, approvals.prospectId))
    .where(inArray(approvals.status, [...statuses]))
    .orderBy(desc(approvals.requestedAt))
    .limit(200);

  const ids = rows.map((r) => r.a.id);
  const decisions = ids.length
    ? await db
        .select({
          approvalId: approvalDecisions.approvalId,
          userId: approvalDecisions.userId,
          decision: approvalDecisions.decision,
          note: approvalDecisions.note,
          createdAt: approvalDecisions.createdAt,
          name: users.name,
        })
        .from(approvalDecisions)
        .innerJoin(users, eq(users.id, approvalDecisions.userId))
        .where(inArray(approvalDecisions.approvalId, ids))
    : [];
  return rows.map((r) => ({ ...r, decisions: decisions.filter((d) => d.approvalId === r.a.id) }));
}
