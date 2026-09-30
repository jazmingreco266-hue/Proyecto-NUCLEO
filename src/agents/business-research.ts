/**
 * Agente de investigación: lee la página principal y hasta 4 internas útiles
 * (nosotros, servicios, contacto…), le pide a Claude los datos del negocio y guarda
 * solo lo que pasa la verificación de citas.
 */
import { and, eq, isNull } from "drizzle-orm";
import { prospects } from "@/db/schema";
import { isBlockedDomain } from "@/domain/agent-guards";
import { costUsd, MAX_PAGES, pageText, pickResearchLinks, researchOutputSchema, researchPrompt, verifyFacts, type Page } from "@/domain/research";
import { extractInternalLinks } from "@/domain/site-audit";
import { saveResearchFacts } from "@/server/services/research";
import { transitionProspect } from "@/server/services/prospects";
import { aiConfigured, claudeResearch, isRetryableAiError, type ResearchModel } from "./ai";
import type { Handler } from "./orchestrator";

export const RESEARCH_TOOL = "nucleo-investigacion/1";

export function businessResearchHandler(model: ResearchModel = claudeResearch, configured: () => boolean = aiConfigured): Handler {
  return async ({ db, run, agent, settings, fetcher, now }) => {
    if (!configured()) {
      return { kind: "blocked", reason: "Falta configurar ANTHROPIC_API_KEY en el servidor. Ver docs/06-publicar.md." };
    }
    const [p] = await db
      .select()
      .from(prospects)
      .where(and(eq(prospects.id, run.prospectId ?? "00000000-0000-0000-0000-000000000000"), isNull(prospects.deletedAt)))
      .limit(1);
    if (!p) return { kind: "blocked", reason: "El prospecto ya no existe." };
    if (!p.websiteUrl || !p.websiteDomain) return { kind: "blocked", reason: "El prospecto no tiene sitio web cargado." };
    if (p.isSample) return { kind: "blocked", reason: "Prospecto de ejemplo: no se investiga." };
    if (isBlockedDomain(p.websiteDomain, settings.blockedSources)) {
      return { kind: "blocked", reason: `El dominio ${p.websiteDomain} está en las fuentes bloqueadas.` };
    }

    // ── Lectura de páginas (sin IA, sin costo)
    const f = fetcher();
    const home = await f.get(p.websiteUrl);
    if (!home.ok) {
      return home.reason === "network" ? { kind: "retry", error: home.detail } : { kind: "blocked", reason: home.detail };
    }
    if (home.status >= 500) return { kind: "retry", error: `El sitio respondió ${home.status}.` };
    if (home.status >= 400) return { kind: "blocked", reason: `La página principal respondió ${home.status}.` };

    const pages: Page[] = [pageText(home.body, home.url)];
    for (const url of pickResearchLinks(extractInternalLinks(home.body, home.url, 40))) {
      if (pages.length >= MAX_PAGES) break;
      const r = await f.get(url);
      if (r.ok && r.status === 200 && /html/i.test(r.headers["content-type"] ?? "text/html")) pages.push(pageText(r.body, r.url));
    }
    if (pages.every((pg) => pg.text.length < 40)) {
      return { kind: "blocked", reason: "Las páginas no tienen texto legible (por ejemplo, el sitio se arma solo con JavaScript). No se gastó en IA." };
    }

    // ── Pedido a Claude
    let res;
    try {
      res = await model({ prompt: researchPrompt(p, pages) });
    } catch (err) {
      if (isRetryableAiError(err)) return { kind: "retry", error: `La API de IA no respondió: ${(err as Error).message}`.slice(0, 500) };
      return { kind: "blocked", reason: `La API de IA rechazó el pedido: ${(err as Error).message}`.slice(0, 500) };
    }
    const spent = { costUsd: costUsd(res.usage), model: res.model, tool: RESEARCH_TOOL };
    if (res.kind === "refused") {
      return { kind: "blocked", reason: `El modelo declinó el pedido (categoría: ${res.category ?? "sin dato"}). Revisalo a mano.`, spent };
    }
    if (res.kind === "truncated") return { kind: "blocked", reason: "La respuesta superó el largo máximo y se descartó.", spent };

    let parsed;
    try {
      parsed = researchOutputSchema.safeParse(JSON.parse(res.text));
    } catch {
      parsed = null;
    }
    if (!parsed?.success) return { kind: "retry", error: "La respuesta de la IA no tuvo el formato esperado.", spent };

    // ── Verificación y guardado
    const { accepted, rejected } = verifyFacts(parsed.data, pages);
    const saved = await saveResearchFacts(db, agent, p.id, accepted, now, res.model);

    // Descubierto → Investigando → Calificado cuando la IA lo recomienda. Descartar lo decide una persona.
    const q = parsed.data.qualification;
    let movedTo: string | null = null;
    if (!p.paused) {
      try {
        let cur = p;
        if (cur.status === "DISCOVERED") {
          cur = await transitionProspect(db, agent, {
            prospectId: p.id,
            to: "RESEARCHING",
            reason: "Investigación con IA iniciada sobre el sitio público.",
            expectedVersion: cur.version,
          });
          movedTo = "RESEARCHING";
        }
        if (cur.status === "RESEARCHING" && q.recommendation === "qualify") {
          await transitionProspect(db, agent, {
            prospectId: p.id,
            to: "QUALIFIED",
            reason: `La investigación recomienda calificarlo: ${q.reasons.slice(0, 3).join("; ") || "sin motivos detallados"}.`,
            nextStep: "Auditar el sitio y revisar los datos marcados como probables.",
            expectedVersion: cur.version,
          });
          movedTo = "QUALIFIED";
        }
      } catch {
        // Si alguien lo movió mientras tanto, se respeta ese cambio.
      }
    }

    return {
      kind: "done",
      costUsd: spent.costUsd,
      model: res.model,
      tool: RESEARCH_TOOL,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      output: {
        resumen: parsed.data.summary,
        recomendacion: q.recommendation,
        motivos: q.reasons,
        paginas: pages.map((pg) => ({ url: pg.url, recortada: pg.truncated })),
        datosAceptados: accepted.length,
        datosNuevos: saved,
        datosDescartados: rejected,
        estado: movedTo,
      },
    };
  };
}
