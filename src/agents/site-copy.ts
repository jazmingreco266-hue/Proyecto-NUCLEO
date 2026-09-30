/**
 * Agente redactor: pule los textos de la ficha del sitio con Claude, sin agregar datos.
 * Si la respuesta agrega números, cambia los servicios o usa frases de plantilla, se descarta.
 * Si pasa, se guarda como una versión nueva de la ficha: la anterior queda intacta.
 */
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { prospectFacts, prospects, siteBriefs } from "@/db/schema";
import { costUsd } from "@/domain/research";
import { copyFieldsOf, reviewAiCopy, SITE_COPY_JSON_SCHEMA, SITE_COPY_MAX_TOKENS, siteCopyOutputSchema, siteCopyPrompt, siteCopySystem } from "@/domain/site-copy";
import { siteContentSchema, type SiteBrand, type SiteContent } from "@/domain/site";
import { insertBrief } from "@/server/services/site";
import { aiConfigured, claudeJson, isRetryableAiError, type JsonModel } from "./ai";
import type { Handler } from "./orchestrator";

export const SITE_COPY_TOOL = "nucleo-redaccion/1";

export function siteCopyHandler(model: JsonModel = claudeJson, configured: () => boolean = aiConfigured): Handler {
  return async ({ db, run, agent }) => {
    if (!configured()) return { kind: "blocked", reason: "Falta configurar ANTHROPIC_API_KEY en el servidor. Ver docs/06-publicar.md." };
    const briefId = (run.input as { briefId?: string } | null)?.briefId;
    const [brief] = briefId ? await db.select().from(siteBriefs).where(eq(siteBriefs.id, briefId)).limit(1) : [];
    if (!brief) return { kind: "blocked", reason: "La ficha del sitio ya no existe." };
    const [latest] = await db.select({ id: siteBriefs.id }).from(siteBriefs).where(eq(siteBriefs.prospectId, brief.prospectId)).orderBy(desc(siteBriefs.version)).limit(1);
    if (latest?.id !== brief.id) return { kind: "blocked", reason: "Hay una ficha más nueva: pedí la redacción otra vez sobre esa." };
    const [p] = await db.select().from(prospects).where(and(eq(prospects.id, brief.prospectId), isNull(prospects.deletedAt))).limit(1);
    if (!p) return { kind: "blocked", reason: "El cliente ya no existe." };

    const content = brief.content as SiteContent;
    const before = copyFieldsOf(content);
    // Solo datos confirmados por una persona u observados con fuente.
    const facts = await db
      .select({ field: prospectFacts.field, value: prospectFacts.value })
      .from(prospectFacts)
      .where(and(eq(prospectFacts.prospectId, p.id), isNull(prospectFacts.deletedAt), or(eq(prospectFacts.verification, "verified"), eq(prospectFacts.kind, "observed"))));
    const prompt = siteCopyPrompt(p, before, facts);

    let res;
    try {
      res = await model({ system: siteCopySystem(content.trato), schema: SITE_COPY_JSON_SCHEMA, maxTokens: SITE_COPY_MAX_TOKENS, prompt });
    } catch (err) {
      if (isRetryableAiError(err)) return { kind: "retry", error: `La API de IA no respondió: ${(err as Error).message}`.slice(0, 500) };
      return { kind: "blocked", reason: `La API de IA rechazó el pedido: ${(err as Error).message}`.slice(0, 500) };
    }
    const spent = { costUsd: costUsd(res.usage), model: res.model, tool: SITE_COPY_TOOL };
    if (res.kind === "refused") return { kind: "blocked", reason: `El modelo declinó el pedido (categoría: ${res.category ?? "sin dato"}).`, spent };
    if (res.kind === "truncated") return { kind: "blocked", reason: "La respuesta superó el largo máximo y se descartó.", spent };

    let out;
    try {
      out = siteCopyOutputSchema.safeParse(JSON.parse(res.text));
    } catch {
      out = null;
    }
    if (!out?.success) return { kind: "retry", error: "La respuesta de la IA no tuvo el formato esperado.", spent };
    const after = out.data;

    const problems = reviewAiCopy(prompt, before, after);
    const next = siteContentSchema.safeParse({
      ...content,
      tagline: after.tagline,
      intro: after.intro,
      about: after.about,
      services: after.services,
      highlights: after.highlights.filter((h) => h.trim()),
      seoDescription: after.seoDescription,
      cta: { ...content.cta, label: after.ctaLabel },
    });
    if (!next.success) problems.push(`Un texto no respeta los límites: ${next.error.issues[0]?.message ?? "formato inválido"}.`);
    if (problems.length || !next.success) {
      return { kind: "blocked", reason: `Se descartó la redacción de la IA: ${problems.join(" ")}`.slice(0, 1000), spent };
    }

    const saved = await insertBrief(db, agent, p.id, brief.brand as SiteBrand, next.data, brief.authorizationNote, "site.copy", { desde: brief.version, modelo: res.model });
    return {
      kind: "done",
      costUsd: spent.costUsd,
      model: res.model,
      tool: SITE_COPY_TOOL,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      output: { fichaAnterior: brief.version, fichaNueva: saved.version },
    };
  };
}
