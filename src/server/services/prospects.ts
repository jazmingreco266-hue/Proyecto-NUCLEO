import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { approvals, notes, outreachMessages, pipelineEvents, prospectFacts, prospects, users } from "@/db/schema";
import {
  canTransition,
  PIPELINE_STATUSES,
  STATUS_GROUP,
  STATUS_LABELS,
  type PipelineStatus,
  type StatusGroup,
} from "@/domain/pipeline";
import {
  factInputSchema,
  normalizeWebsite,
  prospectInputSchema,
  transitionInputSchema,
} from "@/domain/validation";
import { z } from "zod";
import { audit } from "../audit";
import {
  actorOf,
  assertCan,
  ConflictError,
  NotFoundError,
  UserFacingError,
  type Principal,
} from "../principal";

export type ProspectRow = typeof prospects.$inferSelect;

function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(" · ");
}

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserFacingError(zodMessage(r.error));
  return r.data;
}

// ─────────────────────────── Alta ───────────────────────────

export async function createProspect(
  db: Db,
  who: Principal,
  input: unknown,
  opts: { isSample?: boolean } = {},
): Promise<ProspectRow> {
  assertCan(who, "prospects.write");
  const data = parse(prospectInputSchema, input);
  let site: { url: string; domain: string } | null = null;
  if (data.websiteUrl) {
    try {
      site = normalizeWebsite(data.websiteUrl);
    } catch (e) {
      throw new UserFacingError((e as Error).message);
    }
  }
  const actor = actorOf(who);

  return db.transaction(async (tx) => {
    if (site) {
      const [dup] = await tx
        .select({ id: prospects.id, name: prospects.name })
        .from(prospects)
        .where(and(eq(prospects.websiteDomain, site.domain), isNull(prospects.deletedAt)))
        .limit(1);
      if (dup) {
        throw new ConflictError(`Ya existe un prospecto con el dominio ${site.domain}: ${dup.name}.`);
      }
    }
    const [row] = await tx
      .insert(prospects)
      .values({
        name: data.name,
        legalName: data.legalName ?? null,
        country: data.country,
        region: data.region ?? null,
        city: data.city ?? null,
        language: data.language ?? null,
        industry: data.industry ?? null,
        websiteUrl: site?.url ?? null,
        websiteDomain: site?.domain ?? null,
        currency: data.currency ?? null,
        estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : null,
        isSample: opts.isSample ?? false,
        ownerUserId: who.kind === "user" ? who.id : null,
        createdByType: actor.type,
        createdById: actor.id,
      })
      .returning();
    if (!row) throw new Error("No se pudo crear el prospecto");

    await tx.insert(pipelineEvents).values({
      prospectId: row.id,
      fromStatus: null,
      toStatus: "DISCOVERED",
      actorType: actor.type,
      actorId: actor.id,
      actorLabel: actor.label,
      reason: who.kind === "user" ? "Alta manual desde el panel" : "Descubierto por agente",
      action: "prospect.create",
      result: "Prospecto registrado",
      nextStep: "Investigar la empresa y verificar sus datos públicos",
    });
    await audit(tx, who, {
      action: "prospect.create",
      entityType: "prospect",
      entityId: row.id,
      metadata: { nombre: row.name, dominio: row.websiteDomain, ejemplo: row.isSample },
    });
    return row;
  });
}

// ─────────────────────────── Listado ───────────────────────────

export const listFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(PIPELINE_STATUSES).optional(),
  group: z.enum(["prospeccion", "contacto", "venta", "proyecto", "cerrado"]).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  industry: z.string().trim().max(120).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  sort: z.enum(["recientes", "puntaje", "nombre", "verificacion"]).default("recientes"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ListFilters = z.infer<typeof listFiltersSchema>;
export const PAGE_SIZE = 50;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listProspects(db: Db, who: Principal, rawFilters: unknown) {
  assertCan(who, "prospects.read");
  const f = listFiltersSchema.catch(listFiltersSchema.parse({})).parse(rawFilters ?? {});
  const where: SQL[] = [isNull(prospects.deletedAt)];
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(prospects.name, like), ilike(prospects.websiteDomain, like), ilike(prospects.city, like))!);
  }
  if (f.status) where.push(eq(prospects.status, f.status));
  if (f.group) {
    const inGroup = PIPELINE_STATUSES.filter((s) => STATUS_GROUP[s] === (f.group as StatusGroup));
    where.push(inArray(prospects.status, inGroup));
  }
  if (f.country) where.push(eq(prospects.country, f.country));
  if (f.industry) where.push(ilike(prospects.industry, escapeLike(f.industry)));
  if (f.minScore != null) where.push(gte(prospects.opportunityScore, f.minScore));

  const order =
    f.sort === "puntaje"
      ? [sql`${prospects.opportunityScore} DESC NULLS LAST`, desc(prospects.discoveredAt)]
      : f.sort === "nombre"
        ? [asc(prospects.name)]
        : f.sort === "verificacion"
          ? [sql`${prospects.lastVerifiedAt} ASC NULLS FIRST`]
          : [desc(prospects.discoveredAt)];

  // Resumen de verificación por prospecto: cuántos hechos hay y cuántos están verificados.
  const factStats = db
    .select({
      prospectId: prospectFacts.prospectId,
      total: sql<number>`count(*)::int`.as("total"),
      verified: sql<number>`count(*) FILTER (WHERE ${prospectFacts.verification} = 'verified')::int`.as(
        "verified",
      ),
      contacts: sql<number>`count(*) FILTER (WHERE ${prospectFacts.category} = 'contact')::int`.as(
        "contacts",
      ),
    })
    .from(prospectFacts)
    .where(isNull(prospectFacts.deletedAt))
    .groupBy(prospectFacts.prospectId)
    .as("fact_stats");

  const rows = await db
    .select({
      p: prospects,
      ownerName: users.name,
      factsTotal: sql<number>`coalesce(${factStats.total}, 0)`,
      factsVerified: sql<number>`coalesce(${factStats.verified}, 0)`,
      contacts: sql<number>`coalesce(${factStats.contacts}, 0)`,
      totalCount: sql<number>`count(*) OVER ()::int`,
    })
    .from(prospects)
    .leftJoin(users, eq(users.id, prospects.ownerUserId))
    .leftJoin(factStats, eq(factStats.prospectId, prospects.id))
    .where(and(...where))
    .orderBy(...order)
    .limit(PAGE_SIZE)
    .offset((f.page - 1) * PAGE_SIZE);

  return { filters: f, total: rows[0]?.totalCount ?? 0, rows };
}

export async function listFilterOptions(db: Db, who: Principal) {
  assertCan(who, "prospects.read");
  const [countries, industries] = await Promise.all([
    db
      .selectDistinct({ v: prospects.country })
      .from(prospects)
      .where(isNull(prospects.deletedAt))
      .orderBy(prospects.country),
    db
      .selectDistinct({ v: prospects.industry })
      .from(prospects)
      .where(and(isNull(prospects.deletedAt), sql`${prospects.industry} IS NOT NULL`))
      .orderBy(prospects.industry),
  ]);
  return { countries: countries.map((r) => r.v), industries: industries.map((r) => r.v as string) };
}

// ─────────────────────────── Detalle ───────────────────────────

export async function getProspect(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.read");
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("El prospecto");
  const [row] = await db
    .select({ p: prospects, ownerName: users.name })
    .from(prospects)
    .leftJoin(users, eq(users.id, prospects.ownerUserId))
    .where(and(eq(prospects.id, id), isNull(prospects.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("El prospecto");
  return row;
}

export async function listEvents(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  return db
    .select()
    .from(pipelineEvents)
    .where(eq(pipelineEvents.prospectId, prospectId))
    .orderBy(desc(pipelineEvents.createdAt), desc(pipelineEvents.id));
}

// ─────────────────────────── Cambio de estado ───────────────────────────

export async function transitionProspect(db: Db, who: Principal, input: unknown) {
  assertCan(who, "prospects.transition");
  const data = parse(transitionInputSchema, input);
  const actor = actorOf(who);

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, data.prospectId), isNull(prospects.deletedAt)))
      .for("update")
      .limit(1);
    if (!current) throw new NotFoundError("El prospecto");
    if (current.version !== data.expectedVersion) {
      throw new ConflictError(
        "Alguien más modificó este prospecto mientras lo mirabas. Recargá la página y revisá el estado actual.",
      );
    }
    if (who.kind === "agent" && current.paused) {
      throw new ConflictError("El prospecto está pausado: los agentes no pueden moverlo.");
    }

    const check = canTransition(
      current.status,
      data.to,
      who.kind === "user" ? { type: "user", role: who.role } : { type: "agent" },
    );
    if (!check.ok) throw new UserFacingError(check.reason);

    let approvalId: string | null = null;
    if (check.requiresApproval) {
      const [ap] = await tx
        .select({ id: approvals.id })
        .from(approvals)
        .where(
          and(
            eq(approvals.prospectId, current.id),
            eq(approvals.action, check.requiresApproval),
            eq(approvals.status, "approved"),
          ),
        )
        .orderBy(desc(approvals.decidedAt))
        .limit(1);
      if (!ap) {
        throw new UserFacingError(
          `Para pasar a ${STATUS_LABELS[data.to]} primero tiene que existir una aprobación de publicación en producción.`,
        );
      }
      approvalId = ap.id;
      await tx
        .update(approvals)
        .set({ status: "executed", executedAt: new Date() })
        .where(eq(approvals.id, ap.id));
    }

    const [updated] = await tx
      .update(prospects)
      .set({ status: data.to, version: current.version + 1, updatedAt: new Date() })
      .where(and(eq(prospects.id, current.id), eq(prospects.version, current.version)))
      .returning();
    if (!updated) throw new ConflictError("El prospecto cambió mientras se guardaba. Probá de nuevo.");

    // Al marcar como enviado, la última versión de los mensajes queda registrada como la enviada.
    let sentVersion: number | null = null;
    if (data.to === "SENT_MANUALLY") {
      const [last] = await tx
        .select({ id: outreachMessages.id, version: outreachMessages.version })
        .from(outreachMessages)
        .where(eq(outreachMessages.prospectId, current.id))
        .orderBy(desc(outreachMessages.version))
        .limit(1);
      if (last) {
        await tx
          .update(outreachMessages)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(outreachMessages.id, last.id));
        sentVersion = last.version;
      }
    }

    await tx.insert(pipelineEvents).values({
      prospectId: current.id,
      fromStatus: current.status,
      toStatus: data.to,
      actorType: actor.type,
      actorId: actor.id,
      actorLabel: actor.label,
      reason: data.reason,
      action: "prospect.transition",
      result:
        `${STATUS_LABELS[current.status]} → ${STATUS_LABELS[data.to]}` +
        (sentVersion ? ` (mensajes versión ${sentVersion})` : ""),
      nextStep: data.nextStep ?? null,
    });
    await audit(tx, who, {
      action: "prospect.transition",
      entityType: "prospect",
      entityId: current.id,
      metadata: { desde: current.status, hacia: data.to, motivo: data.reason, aprobacion: approvalId },
    });
    return updated;
  });
}

// ─────────────────────────── Pausa ───────────────────────────

export async function setPaused(
  db: Db,
  who: Principal,
  input: { prospectId: string; paused: boolean; reason: string; expectedVersion: number },
) {
  assertCan(who, "prospects.write");
  if (who.kind !== "user") throw new UserFacingError("Solo una persona puede pausar o reanudar.");
  const reason = input.reason?.trim();
  if (!reason || reason.length < 3) throw new UserFacingError("Explicá el motivo.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(prospects)
      .set({ paused: input.paused, version: sql`${prospects.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(prospects.id, input.prospectId),
          eq(prospects.version, input.expectedVersion),
          isNull(prospects.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new ConflictError("El prospecto cambió o no existe. Recargá la página.");
    await audit(tx, who, {
      action: input.paused ? "prospect.pause" : "prospect.resume",
      entityType: "prospect",
      entityId: row.id,
      metadata: { motivo: reason },
    });
    return row;
  });
}

// ─────────────────────────── Hechos con fuente ───────────────────────────

export async function addFact(db: Db, who: Principal, input: unknown) {
  assertCan(who, "facts.write");
  const data = parse(factInputSchema, input);
  const actor = actorOf(who);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(eq(prospects.id, data.prospectId), isNull(prospects.deletedAt)))
      .limit(1);
    if (!p) throw new NotFoundError("El prospecto");
    const now = new Date();
    const [fact] = await tx
      .insert(prospectFacts)
      .values({
        prospectId: data.prospectId,
        category: data.category,
        field: data.field,
        value: data.value,
        kind: data.kind,
        verification: data.verification,
        confidence: data.confidence,
        sourceName: data.sourceName ?? null,
        sourceUrl: data.sourceUrl ?? null,
        verifiedAt: data.sourceUrl ? now : null,
        collectedByType: actor.type,
        collectedById: actor.id,
      })
      .returning();
    if (data.verification === "verified") {
      await tx.update(prospects).set({ lastVerifiedAt: now }).where(eq(prospects.id, data.prospectId));
    }
    await audit(tx, who, {
      action: "fact.create",
      entityType: "prospect",
      entityId: data.prospectId,
      metadata: { campo: data.field, tipo: data.kind, estado: data.verification, fuente: data.sourceUrl },
    });
    return fact!;
  });
}

export async function listFacts(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  return db
    .select()
    .from(prospectFacts)
    .where(and(eq(prospectFacts.prospectId, prospectId), isNull(prospectFacts.deletedAt)))
    .orderBy(asc(prospectFacts.category), desc(prospectFacts.createdAt));
}

export async function removeFact(db: Db, who: Principal, factId: string, reason: string) {
  assertCan(who, "facts.write");
  if (who.kind !== "user") throw new UserFacingError("Solo una persona puede retirar un dato.");
  if (!reason?.trim()) throw new UserFacingError("Explicá por qué se retira el dato.");
  return db.transaction(async (tx) => {
    const [f] = await tx
      .update(prospectFacts)
      .set({ deletedAt: new Date() })
      .where(and(eq(prospectFacts.id, factId), isNull(prospectFacts.deletedAt)))
      .returning();
    if (!f) throw new NotFoundError("El dato");
    await audit(tx, who, {
      action: "fact.remove",
      entityType: "prospect",
      entityId: f.prospectId,
      metadata: { dato: f.id, campo: f.field, motivo: reason },
    });
  });
}

// ─────────────────────────── Notas ───────────────────────────

export async function addNote(db: Db, who: Principal, prospectId: string, body: string) {
  assertCan(who, "notes.write");
  if (who.kind !== "user") throw new UserFacingError("Las notas son de las personas del equipo.");
  const text = body?.trim();
  if (!text) throw new UserFacingError("La nota está vacía.");
  if (text.length > 5000) throw new UserFacingError("La nota es demasiado larga (máximo 5000 caracteres).");
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), isNull(prospects.deletedAt)))
      .limit(1);
    if (!p) throw new NotFoundError("El prospecto");
    const [n] = await tx.insert(notes).values({ prospectId, authorId: who.id, body: text }).returning();
    await audit(tx, who, { action: "note.create", entityType: "prospect", entityId: prospectId });
    return n!;
  });
}

export async function listNotes(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  return db
    .select({ n: notes, author: users.name })
    .from(notes)
    .innerJoin(users, eq(users.id, notes.authorId))
    .where(and(eq(notes.prospectId, prospectId), isNull(notes.deletedAt)))
    .orderBy(desc(notes.createdAt));
}
