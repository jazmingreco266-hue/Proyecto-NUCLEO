/**
 * Investigación de empresas con IA: pedido desde el panel, guardado de los datos
 * y consulta del último resultado.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { agentRuns, prospectFacts, prospects } from "@/db/schema";
import { isBlockedDomain } from "@/domain/agent-guards";
import { RESEARCH_ESTIMATED_COST_USD, type CheckedFact } from "@/domain/research";
import { audit } from "../audit";
import { actorOf, assertCan, NotFoundError, UserFacingError, type Principal } from "../principal";
import { enqueueRun } from "./agent-runs";
import { getSettings } from "./settings";

export const RESEARCH_AGENT = "business-research";

export async function requestResearch(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.write");
  if (!z.string().uuid().safeParse(prospectId).success) throw new NotFoundError("El prospecto");
  const { data: settings } = await getSettings(db, who);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, prospectId), isNull(prospects.deletedAt)))
      .limit(1);
    if (!p) throw new NotFoundError("El prospecto");
    if (!p.websiteUrl || !p.websiteDomain) throw new UserFacingError("El prospecto no tiene sitio web cargado: no hay páginas para investigar.");
    if (p.isSample) throw new UserFacingError("Los prospectos de ejemplo usan dominios ficticios: no se investigan.");
    if (isBlockedDomain(p.websiteDomain, settings.blockedSources)) {
      throw new UserFacingError(`El dominio ${p.websiteDomain} está en las fuentes bloqueadas de la configuración.`);
    }
    return enqueueRun(tx, who, {
      agent: RESEARCH_AGENT,
      task: "Investigación del negocio con IA",
      prospectId: p.id,
      input: { url: p.websiteUrl },
      dedupeKey: `${RESEARCH_AGENT}:${p.id}`,
      estimatedCostUsd: RESEARCH_ESTIMATED_COST_USD,
      maxAttempts: 2,
    });
  });
}

/**
 * Guarda los datos aceptados como hechos, sin duplicar los que ya existen.
 * Todo lo que aporta la IA queda como "probable" o "no verificado": una persona lo confirma.
 */
export async function saveResearchFacts(db: Db, who: Principal, prospectId: string, facts: CheckedFact[], readAt: Date, model: string) {
  assertCan(who, "facts.write");
  const actor = actorOf(who);
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ field: prospectFacts.field, value: prospectFacts.value })
      .from(prospectFacts)
      .where(and(eq(prospectFacts.prospectId, prospectId), isNull(prospectFacts.deletedAt)));
    const have = new Set(existing.map((f) => `${f.field.toLowerCase()}|${f.value.toLowerCase()}`));
    const fresh = facts.filter((f) => {
      const k = `${f.field.toLowerCase()}|${f.value.toLowerCase()}`;
      if (have.has(k)) return false;
      have.add(k);
      return true;
    });
    if (fresh.length) {
      await tx.insert(prospectFacts).values(
        fresh.map((f) => ({
          prospectId,
          category: f.category,
          field: f.field,
          value: f.kind === "observed" ? f.value : `${f.value}${f.evidence ? `\nBase: ${f.evidence}` : ""}`.slice(0, 4000),
          kind: f.kind,
          verification: f.kind === "observed" ? ("probable" as const) : ("unconfirmed" as const),
          // La confianza de la IA se limita: nunca figura como certeza.
          confidence: Math.min(f.confidence, f.kind === "observed" ? 80 : 60),
          sourceName: `Investigación con IA (${model}) sobre el sitio de la empresa`,
          sourceUrl: f.sourceUrl,
          verifiedAt: f.sourceUrl ? readAt : null,
          collectedByType: actor.type,
          collectedById: actor.id,
        })),
      );
    }
    await audit(tx, who, { action: "research.facts", entityType: "prospect", entityId: prospectId, metadata: { nuevos: fresh.length, recibidos: facts.length } });
    return fresh.length;
  });
}

/** Último resultado exitoso de investigación, para mostrar en la ficha. */
export async function latestResearch(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  const [row] = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.prospectId, prospectId), eq(agentRuns.agent, RESEARCH_AGENT), eq(agentRuns.status, "succeeded")))
    .orderBy(desc(agentRuns.finishedAt))
    .limit(1);
  return row ?? null;
}
