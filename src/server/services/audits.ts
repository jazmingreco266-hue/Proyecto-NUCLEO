/**
 * Auditorías técnicas de sitios: pedido, guardado versionado y consulta.
 * Ninguna auditoría se sobrescribe: cada una es una versión nueva (la tabla es de solo agregado).
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { prospectFacts, prospects, siteAudits } from "@/db/schema";
import { isBlockedDomain } from "@/domain/agent-guards";
import type { AuditResult, Recommendation } from "@/domain/site-audit";
import { audit } from "../audit";
import { actorOf, assertCan, NotFoundError, UserFacingError, type Principal } from "../principal";
import { enqueueRun } from "./agent-runs";
import { getSettings } from "./settings";

export const AUDIT_AGENT = "website-audit";
export type SiteAudit = typeof siteAudits.$inferSelect;

const uuid = z.string().uuid();

/** Pide una auditoría (desde el panel o el orquestador). No gasta API: estimado US$ 0. */
export async function requestAudit(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.write");
  if (!uuid.safeParse(prospectId).success) throw new NotFoundError("El prospecto");
  const { data: settings } = await getSettings(db, who);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), isNull(prospects.deletedAt)))
      .limit(1);
    if (!p) throw new NotFoundError("El prospecto");
    if (!p.websiteUrl || !p.websiteDomain) throw new UserFacingError("El prospecto no tiene sitio web cargado.");
    if (p.isSample) throw new UserFacingError("Los prospectos de ejemplo usan dominios ficticios: no se auditan.");
    if (isBlockedDomain(p.websiteDomain, settings.blockedSources)) {
      throw new UserFacingError(`El dominio ${p.websiteDomain} está en las fuentes bloqueadas de la configuración.`);
    }
    return enqueueRun(tx, who, {
      agent: AUDIT_AGENT,
      task: "Auditoría técnica del sitio",
      prospectId: p.id,
      input: { url: p.websiteUrl },
      dedupeKey: `${AUDIT_AGENT}:${p.id}`,
      estimatedCostUsd: 0,
      maxAttempts: 3,
    });
  });
}

export type SaveAuditInput = {
  prospectId: string;
  runId: string | null;
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  responseMs: number;
  htmlBytes: number;
  fetchedAt: Date;
  result: AuditResult;
  recommendation: Recommendation;
  tool: string;
};

/**
 * Guarda una nueva versión de la auditoría y actualiza el prospecto.
 * Contactos y tecnología encontrados en el sitio se registran como hechos observados con fuente:
 * contactos como "probable" (podrían ser, por ejemplo, del diseñador del sitio) y tecnología como
 * "verificado" (es literalmente lo que muestra el código). No se duplican.
 */
export async function saveAudit(db: Db, who: Principal, a: SaveAuditInput): Promise<SiteAudit> {
  assertCan(who, "facts.write");
  const actor = actorOf(who);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(eq(prospects.id, a.prospectId), isNull(prospects.deletedAt)))
      .for("update")
      .limit(1);
    if (!p) throw new NotFoundError("El prospecto");

    const [{ next }] = (
      await tx.execute<{ next: number }>(sql`SELECT coalesce(max(version), 0)::int + 1 AS next FROM site_audits WHERE prospect_id = ${a.prospectId}`)
    ).rows as [{ next: number }];

    const [row] = await tx
      .insert(siteAudits)
      .values({
        prospectId: a.prospectId,
        version: next,
        runId: a.runId,
        requestedUrl: a.requestedUrl,
        finalUrl: a.finalUrl,
        httpStatus: a.httpStatus,
        responseMs: a.responseMs,
        htmlBytes: a.htmlBytes,
        fetchedAt: a.fetchedAt,
        siteScore: a.result.siteScore,
        categories: a.result.categories,
        checks: a.result.checks,
        issues: a.result.issues,
        strengths: a.result.strengths,
        recommendation: a.recommendation,
        tool: a.tool,
        createdByType: actor.type,
        createdById: actor.id,
      })
      .returning();

    await tx
      .update(prospects)
      .set({ siteScore: a.result.siteScore, mainIssues: a.result.issues.slice(0, 5), updatedAt: new Date() })
      .where(eq(prospects.id, a.prospectId));

    const existing = await tx
      .select({ field: prospectFacts.field, value: prospectFacts.value })
      .from(prospectFacts)
      .where(and(eq(prospectFacts.prospectId, a.prospectId), isNull(prospectFacts.deletedAt)));
    const have = new Set(existing.map((f) => `${f.field}|${f.value.toLowerCase()}`));
    const facts = [
      ...a.result.contacts.map((c) => ({ ...c, category: "contact" as const, verification: "probable" as const, confidence: 70 })),
      ...a.result.tech.map((t) => ({ ...t, category: "tech" as const, verification: "verified" as const, confidence: 90 })),
    ].filter((f) => !have.has(`${f.field}|${f.value.toLowerCase()}`));
    if (facts.length) {
      await tx.insert(prospectFacts).values(
        facts.map((f) => ({
          prospectId: a.prospectId,
          category: f.category,
          field: f.field,
          value: f.value,
          kind: "observed" as const,
          verification: f.verification,
          confidence: f.confidence,
          sourceName: "Sitio web de la empresa (lectura automática)",
          sourceUrl: a.finalUrl,
          verifiedAt: a.fetchedAt,
          collectedByType: actor.type,
          collectedById: actor.id,
        })),
      );
    }

    await audit(tx, who, {
      action: "audit.create",
      entityType: "prospect",
      entityId: a.prospectId,
      metadata: { version: next, puntaje: a.result.siteScore, recomendacion: a.recommendation.action, datosNuevos: facts.length },
    });
    return row!;
  });
}

export async function listAudits(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  return db
    .select({ id: siteAudits.id, version: siteAudits.version, siteScore: siteAudits.siteScore, createdAt: siteAudits.createdAt })
    .from(siteAudits)
    .where(eq(siteAudits.prospectId, prospectId))
    .orderBy(desc(siteAudits.version));
}

/** Última versión, o la pedida. */
export async function getAudit(db: Db, who: Principal, prospectId: string, version?: number): Promise<SiteAudit | null> {
  assertCan(who, "prospects.read");
  const [row] = await db
    .select()
    .from(siteAudits)
    .where(and(eq(siteAudits.prospectId, prospectId), version ? eq(siteAudits.version, version) : undefined))
    .orderBy(desc(siteAudits.version))
    .limit(1);
  return row ?? null;
}
