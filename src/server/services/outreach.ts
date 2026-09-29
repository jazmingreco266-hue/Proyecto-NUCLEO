/**
 * Mensajes de contacto preparados. Cada preparación es una versión nueva; nunca se envían solos.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { outreachMessages, prospectFacts, prospects, siteAudits } from "@/db/schema";
import { buildOutreach, type OutreachContent } from "@/domain/outreach";
import type { Check } from "@/domain/site-audit";
import { audit } from "../audit";
import { actorOf, assertCan, NotFoundError, UserFacingError, type Principal } from "../principal";
import { transitionProspect } from "./prospects";
import { getSettings } from "./settings";

export type OutreachRow = typeof outreachMessages.$inferSelect & { content: OutreachContent };

const uuid = z.string().uuid();

export async function prepareMessages(db: Db, who: Principal, prospectId: string): Promise<OutreachRow> {
  assertCan(who, "prospects.write");
  if (!uuid.safeParse(prospectId).success) throw new NotFoundError("El prospecto");
  const [p] = await db.select().from(prospects).where(and(eq(prospects.id, prospectId), isNull(prospects.deletedAt))).limit(1);
  if (!p) throw new NotFoundError("El prospecto");
  if (p.isSample) throw new UserFacingError("Los prospectos de ejemplo no preparan mensajes.");
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
      .values({ prospectId, version: next, content, createdByType: actor.type, createdById: actor.id })
      .returning();
    await audit(tx, who, { action: "outreach.prepare", entityType: "prospect", entityId: prospectId, metadata: { version: next, canal: content.channel.suggested } });
    return r!;
  });

  // Auditado → Mensaje listo. En otro estado, los mensajes quedan guardados sin mover nada.
  const [cur] = await db.select({ status: prospects.status, version: prospects.version }).from(prospects).where(eq(prospects.id, prospectId));
  if (cur && ["AUDITED", "DEMO_READY"].includes(cur.status)) {
    try {
      await transitionProspect(db, who, {
        prospectId,
        to: "OUTREACH_READY",
        reason: `Mensajes v${row.version} preparados (canal sugerido: ${content.channel.suggested}).`,
        nextStep: "Revisar, enviar a mano y marcar como enviado.",
        expectedVersion: cur.version,
      });
    } catch {
      // Si alguien lo movió mientras tanto, se respeta ese cambio.
    }
  }
  return row as OutreachRow;
}

export async function latestMessages(db: Db, who: Principal, prospectId: string): Promise<OutreachRow | null> {
  assertCan(who, "prospects.read");
  const [row] = await db.select().from(outreachMessages).where(eq(outreachMessages.prospectId, prospectId)).orderBy(desc(outreachMessages.version)).limit(1);
  return (row as OutreachRow | undefined) ?? null;
}

export async function getMessages(db: Db, who: Principal, id: string): Promise<OutreachRow> {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El mensaje");
  const [row] = await db.select().from(outreachMessages).where(eq(outreachMessages.id, id)).limit(1);
  if (!row) throw new NotFoundError("El mensaje");
  return row as OutreachRow;
}
