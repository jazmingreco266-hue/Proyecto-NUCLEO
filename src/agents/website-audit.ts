/**
 * Agente de auditoría web: lee la página principal con el lector respetuoso,
 * revisa algunos enlaces internos y guarda una auditoría técnica versionada.
 */
import { and, eq, isNull } from "drizzle-orm";
import { prospects } from "@/db/schema";
import { isBlockedDomain } from "@/domain/agent-guards";
import { AUDIT_TOOL, auditHtml, extractInternalLinks, recommend, type LinkCheck } from "@/domain/site-audit";
import { saveAudit } from "@/server/services/audits";
import { transitionProspect } from "@/server/services/prospects";
import type { Handler } from "./orchestrator";

const MAX_LINKS = 8;
/** Tiempo total para revisar enlaces: si se pasa, se deja de revisar (y se informa). */
const LINKS_BUDGET_MS = 30_000;

export const websiteAuditHandler: Handler = async ({ db, run, agent, settings, fetcher, now }) => {
  const [p] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.id, run.prospectId ?? "00000000-0000-0000-0000-000000000000"), isNull(prospects.deletedAt)))
    .limit(1);
  if (!p) return { kind: "blocked", reason: "El prospecto ya no existe." };
  if (!p.websiteUrl || !p.websiteDomain) return { kind: "blocked", reason: "El prospecto no tiene sitio web cargado." };
  if (p.isSample) return { kind: "blocked", reason: "Prospecto de ejemplo: no se audita." };
  if (isBlockedDomain(p.websiteDomain, settings.blockedSources)) {
    return { kind: "blocked", reason: `El dominio ${p.websiteDomain} está en las fuentes bloqueadas.` };
  }

  const f = fetcher();
  let res = await f.get(p.websiteUrl);
  // Si HTTPS no responde, se prueba HTTP: un sitio sin HTTPS igual se puede auditar (y es un hallazgo).
  if (!res.ok && res.reason === "network" && p.websiteUrl.startsWith("https:")) {
    const alt = await f.get(p.websiteUrl.replace(/^https:/, "http:"));
    if (alt.ok) res = alt;
  }
  if (!res.ok) {
    if (res.reason === "network" || res.reason === "too_many_redirects") return { kind: "retry", error: res.detail };
    return { kind: "blocked", reason: res.detail };
  }
  if (res.status >= 500) return { kind: "retry", error: `El sitio respondió ${res.status}.` };
  if (res.status >= 400) return { kind: "blocked", reason: `La página principal respondió ${res.status}. Verificá que la URL sea correcta.` };
  const type = res.headers["content-type"] ?? "";
  if (type && !/html/i.test(type)) return { kind: "blocked", reason: `La dirección no devuelve una página web (${type.split(";")[0]}).` };

  const { robots } = await f.robots(new URL(res.url).origin);

  const links: LinkCheck[] = [];
  const started = Date.now();
  let linksCut = false;
  for (const url of extractInternalLinks(res.body, res.url, MAX_LINKS)) {
    if (Date.now() - started > LINKS_BUDGET_MS) {
      linksCut = true;
      break;
    }
    let r = await f.get(url, { method: "HEAD" });
    if (r.ok && (r.status === 405 || r.status === 501)) r = await f.get(url, { maxBytes: 64 * 1024 });
    if (r.ok) links.push({ url, status: r.status });
    else if (r.reason === "network") links.push({ url, status: null, error: "sin respuesta" });
    // robots.txt o acceso negado: ese enlace no se revisa ni se cuenta.
  }

  const result = auditHtml({
    requestedUrl: p.websiteUrl,
    finalUrl: res.url,
    status: res.status,
    headers: res.headers,
    html: res.body,
    ms: res.ms,
    bytes: res.bytes,
    truncated: res.truncated,
    robotsSitemaps: robots.sitemaps,
    links,
    now,
  });
  const recommendation = recommend(result, {
    skipIfSiteScoreAbove: settings.discard.skipIfSiteScoreAbove,
    requirePublicContact: settings.discard.requirePublicContact,
  });

  const saved = await saveAudit(db, agent, {
    prospectId: p.id,
    runId: run.id,
    requestedUrl: p.websiteUrl,
    finalUrl: res.url,
    httpStatus: res.status,
    responseMs: res.ms,
    htmlBytes: res.bytes,
    fetchedAt: now,
    result,
    recommendation,
    tool: AUDIT_TOOL,
  });

  // Un prospecto calificado pasa a "Auditado". En cualquier otro estado, la auditoría queda guardada sin mover nada.
  let moved = false;
  if (p.status === "QUALIFIED" && !p.paused) {
    const [cur] = await db.select({ version: prospects.version, status: prospects.status }).from(prospects).where(eq(prospects.id, p.id));
    if (cur?.status === "QUALIFIED") {
      try {
        await transitionProspect(db, agent, {
          prospectId: p.id,
          to: "AUDITED",
          reason: `Auditoría técnica v${saved.version} completada: puntaje ${result.siteScore ?? "sin datos"}/100, recomendación preliminar «${recommendation.action}».`,
          nextStep: "Revisar la auditoría y decidir si se prepara una demo.",
          expectedVersion: cur.version,
        });
        moved = true;
      } catch {
        // Si alguien lo movió mientras tanto, se respeta ese cambio.
      }
    }
  }

  return {
    kind: "done",
    tool: AUDIT_TOOL,
    output: {
      auditoria: saved.id,
      version: saved.version,
      puntaje: result.siteScore,
      recomendacion: recommendation.action,
      pedidosHttp: f.requests,
      enlacesRevisados: links.length,
      enlacesCortadosPorTiempo: linksCut,
      pasoAAuditado: moved,
    },
  };
};
