/**
 * Recalcula el puntaje de oportunidad de un prospecto con los datos vigentes
 * (última auditoría, datos con fuente e investigación) y guarda la explicación.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { agentRuns, prospectFacts, prospects, siteAudits } from "@/db/schema";
import { computeOpportunity, type Opportunity } from "@/domain/opportunity";
import type { Check } from "@/domain/site-audit";

const RESEARCH_AGENT = "business-research";

export async function recomputeOpportunity(db: Db, prospectId: string): Promise<Opportunity> {
  const [audit] = await db
    .select({ siteScore: siteAudits.siteScore, checks: siteAudits.checks })
    .from(siteAudits)
    .where(eq(siteAudits.prospectId, prospectId))
    .orderBy(desc(siteAudits.version))
    .limit(1);
  const facts = await db
    .select({ category: prospectFacts.category, field: prospectFacts.field, value: prospectFacts.value, kind: prospectFacts.kind, verification: prospectFacts.verification })
    .from(prospectFacts)
    .where(and(eq(prospectFacts.prospectId, prospectId), isNull(prospectFacts.deletedAt)));
  const [research] = await db
    .select({ output: agentRuns.output })
    .from(agentRuns)
    .where(and(eq(agentRuns.prospectId, prospectId), eq(agentRuns.agent, RESEARCH_AGENT), eq(agentRuns.status, "succeeded")))
    .orderBy(desc(agentRuns.finishedAt))
    .limit(1);
  const rec = (research?.output as { recomendacion?: "qualify" | "reject" | "unsure" } | null)?.recomendacion;

  const result = computeOpportunity({
    audit: audit ? { siteScore: audit.siteScore, checks: audit.checks as Check[] } : null,
    facts,
    research: rec ? { recommendation: rec } : null,
  });
  // No cambia la versión del prospecto: el puntaje no es una edición de una persona.
  await db
    .update(prospects)
    .set({ opportunityScore: result.score, scoreExplanation: { ...result, calculado: new Date().toISOString() } })
    .where(eq(prospects.id, prospectId));
  return result;
}
