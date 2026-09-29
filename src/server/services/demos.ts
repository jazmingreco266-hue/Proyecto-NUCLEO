/**
 * Demos conceptuales y mensajes preparados.
 * Ninguna demo ni mensaje se sobrescribe: cada uno es una versión nueva.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { agentRuns, demos, outreachMessages, prospectFacts, prospects, siteAudits } from "@/db/schema";
import { demoContentSchema, draftDemoContent, type DemoContent } from "@/domain/demo";
import { buildOutreach, type OutreachContent } from "@/domain/outreach";
import type { PipelineStatus } from "@/domain/pipeline";
import type { Check } from "@/domain/site-audit";
import { audit } from "../audit";
import { actorOf, assertCan, ConflictError, NotFoundError, UserFacingError, type Principal } from "../principal";
import { transitionProspect } from "./prospects";
import { getSettings } from "./settings";

export type Demo = typeof demos.$inferSelect;
export type OutreachRow = typeof outreachMessages.$inferSelect;

/** Días que el enlace de una demo queda activo. */
export const DEMO_TTL_DAYS = 60;

const uuid = z.string().uuid();

async function liveProspect(db: Db, id: string) {
  if (!uuid.safeParse(id).success) throw new NotFoundError("El prospecto");
  const [p] = await db.select().from(prospects).where(and(eq(prospects.id, id), isNull(prospects.deletedAt))).limit(1);
  if (!p) throw new NotFoundError("El prospecto");
  return p;
}

/** Mueve el prospecto por un camino de estados, solo si está en el punto de partida esperado. */
async function advance(db: Db, who: Principal, prospectId: string, path: PipelineStatus[], reason: string, nextStep: string) {
  for (const to of path) {
    const [cur] = await db.select({ status: prospects.status, version: prospects.version }).from(prospects).where(eq(prospects.id, prospectId));
    if (!cur || cur.status === to) continue;
    try {
      await transitionProspect(db, who, { prospectId, to, reason, nextStep, expectedVersion: cur.version });
    } catch {
      return; // si el camino no aplica desde el estado actual, se deja como está
    }
  }
}

// ─────────────────────────── Demos ───────────────────────────

/** Borrador inicial para el formulario, con los datos observados de la ficha. */
export async function demoDraft(db: Db, who: Principal, prospectId: string): Promise<DemoContent> {
  assertCan(who, "prospects.read");
  const p = await liveProspect(db, prospectId);
  const last = await latestDemo(db, who, prospectId);
  if (last) return last.content as DemoContent;
  const facts = await db
    .select({ category: prospectFacts.category, field: prospectFacts.field, value: prospectFacts.value, kind: prospectFacts.kind })
    .from(prospectFacts)
    .where(and(eq(prospectFacts.prospectId, prospectId), isNull(prospectFacts.deletedAt)));
  const [research] = await db
    .select({ output: agentRuns.output })
    .from(agentRuns)
    .where(and(eq(agentRuns.prospectId, prospectId), eq(agentRuns.agent, "business-research"), eq(agentRuns.status, "succeeded")))
    .orderBy(desc(agentRuns.finishedAt))
    .limit(1);
  return draftDemoContent(p, facts, (research?.output as { resumen?: string } | null)?.resumen);
}

export async function createDemo(db: Db, who: Principal, prospectId: string, input: unknown): Promise<Demo> {
  assertCan(who, "prospects.write");
  const r = demoContentSchema.safeParse(input);
  if (!r.success) throw new UserFacingError(r.error.issues.map((i) => i.message).join(" · "));
  const p = await liveProspect(db, prospectId);
  if (p.isSample) throw new UserFacingError("Los prospectos de ejemplo no generan demos.");
  const actor = actorOf(who);

  const demo = await db.transaction(async (tx) => {
    await tx.select({ id: prospects.id }).from(prospects).where(eq(prospects.id, prospectId)).for("update");
    const [{ next }] = (
      await tx.execute<{ next: number }>(sql`SELECT coalesce(max(version), 0)::int + 1 AS next FROM demos WHERE prospect_id = ${prospectId}`)
    ).rows as [{ next: number }];
    const [row] = await tx
      .insert(demos)
      .values({
        prospectId,
        version: next,
        token: randomBytes(32).toString("base64url"),
        content: r.data,
        createdByType: actor.type,
        createdById: actor.id,
        expiresAt: new Date(Date.now() + DEMO_TTL_DAYS * 86_400_000),
      })
      .returning();
    await audit(tx, who, { action: "demo.create", entityType: "prospect", entityId: prospectId, metadata: { version: next } });
    return row!;
  });

  await advance(db, who, prospectId, ["DEMO_GENERATING", "DEMO_READY"], `Demo conceptual v${demo.version} generada.`, "Revisar la demo y preparar los mensajes.");
  return demo;
}

export async function listDemos(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  return db.select().from(demos).where(eq(demos.prospectId, prospectId)).orderBy(desc(demos.version));
}

export async function latestDemo(db: Db, who: Principal, prospectId: string): Promise<Demo | null> {
  assertCan(who, "prospects.read");
  const [row] = await db.select().from(demos).where(eq(demos.prospectId, prospectId)).orderBy(desc(demos.version)).limit(1);
  return row ?? null;
}

export const demoIsLive = (d: Pick<Demo, "revokedAt" | "expiresAt">, now = new Date()) => !d.revokedAt && d.expiresAt > now;

export async function revokeDemo(db: Db, who: Principal, demoId: string) {
  assertCan(who, "prospects.write");
  if (!uuid.safeParse(demoId).success) throw new NotFoundError("La demo");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(demos)
      .set({ revokedAt: new Date() })
      .where(and(eq(demos.id, demoId), isNull(demos.revokedAt)))
      .returning();
    if (!row) throw new ConflictError("La demo no existe o su enlace ya estaba revocado.");
    await audit(tx, who, { action: "demo.revoke", entityType: "prospect", entityId: row.prospectId, metadata: { version: row.version } });
    return row;
  });
}

/** Acceso público por enlace: solo demos vigentes. Devuelve también el nombre de la agencia. */
export async function publicDemo(db: Db, token: string): Promise<{ demo: Demo; agencyName: string } | { gone: true } | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const [row] = await db.select().from(demos).where(eq(demos.token, token)).limit(1);
  if (!row) return null;
  if (!demoIsLive(row)) return { gone: true };
  const { data } = await getSettings(db, { kind: "agent", name: "demo-viewer" });
  return { demo: row, agencyName: data.sender.agencyName };
}

// ─────────────────────────── Mensajes ───────────────────────────

export async function prepareMessages(db: Db, who: Principal, prospectId: string, baseUrl: string): Promise<OutreachRow> {
  assertCan(who, "prospects.write");
  const p = await liveProspect(db, prospectId);
  const demo = await latestDemo(db, who, prospectId);
  if (!demo || !demoIsLive(demo)) throw new UserFacingError("Primero generá una demo con el enlace vigente.");
  const { data: settings } = await getSettings(db, who);
  const facts = await db
    .select({ category: prospectFacts.category, field: prospectFacts.field, value: prospectFacts.value, kind: prospectFacts.kind })
    .from(prospectFacts)
    .where(and(eq(prospectFacts.prospectId, prospectId), isNull(prospectFacts.deletedAt)));
  const [lastAudit] = await db
    .select({ checks: siteAudits.checks })
    .from(siteAudits)
    .where(eq(siteAudits.prospectId, prospectId))
    .orderBy(desc(siteAudits.version))
    .limit(1);

  const content = buildOutreach({
    businessName: p.name,
    country: p.country,
    facts,
    auditChecks: (lastAudit?.checks as Check[] | undefined) ?? null,
    demoUrl: `${baseUrl.replace(/\/$/, "")}/demo/${demo.token}`,
    sender: settings.sender,
    allowedChannels: settings.channels,
  });
  const actor = actorOf(who);

  const row = await db.transaction(async (tx) => {
    await tx.select({ id: prospects.id }).from(prospects).where(eq(prospects.id, prospectId)).for("update");
    const [{ next }] = (
      await tx.execute<{ next: number }>(sql`SELECT coalesce(max(version), 0)::int + 1 AS next FROM outreach_messages WHERE prospect_id = ${prospectId}`)
    ).rows as [{ next: number }];
    const [r] = await tx
      .insert(outreachMessages)
      .values({ prospectId, version: next, demoId: demo.id, content, createdByType: actor.type, createdById: actor.id })
      .returning();
    await audit(tx, who, { action: "outreach.prepare", entityType: "prospect", entityId: prospectId, metadata: { version: next, canal: content.channel.suggested } });
    return r!;
  });

  await advance(db, who, prospectId, ["OUTREACH_READY"], `Mensajes v${row.version} preparados (canal sugerido: ${content.channel.suggested}).`, "Revisar, enviar a mano y marcar como enviado.");
  return row;
}

export async function latestMessages(db: Db, who: Principal, prospectId: string): Promise<(OutreachRow & { content: OutreachContent }) | null> {
  assertCan(who, "prospects.read");
  const [row] = await db.select().from(outreachMessages).where(eq(outreachMessages.prospectId, prospectId)).orderBy(desc(outreachMessages.version)).limit(1);
  return (row as (OutreachRow & { content: OutreachContent }) | undefined) ?? null;
}

export async function getMessages(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El mensaje");
  const [row] = await db.select().from(outreachMessages).where(eq(outreachMessages.id, id)).limit(1);
  if (!row) throw new NotFoundError("El mensaje");
  return row as OutreachRow & { content: OutreachContent };
}
