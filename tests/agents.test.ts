import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { agentRuns, siteAudits } from "@/db/schema";
import { budgetGuard, isBlockedDomain, scheduleGuard, withinSchedule, backoffMs } from "@/domain/agent-guards";
import { ForbiddenError } from "@/domain/permissions";
import { DEFAULT_SETTINGS } from "@/domain/validation";
import { PoliteFetcher, type RawResponse, type Transport } from "@/agents/http";
import { processNext, processNow, tick } from "@/agents/orchestrator";
import {
  cancelRun,
  claimNext,
  enqueueRun,
  failRun,
  listRuns,
  recoverStale,
  retryRun,
} from "@/server/services/agent-runs";
import { getAudit, listAudits, requestAudit } from "@/server/services/audits";
import { createProspect, getProspect, listEvents, listFacts, setPaused, transitionProspect } from "@/server/services/prospects";
import { getSettings, updateSettings } from "@/server/services/settings";
import { agent, db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

// ─────────────────────────── Guardas (puras) ───────────────────────────

describe("guardas del orquestador", () => {
  const s = DEFAULT_SETTINGS; // lunes a viernes, 8 a 20, Buenos Aires (UTC-3)

  it("horario: respeta días, horas y zona horaria", () => {
    expect(withinSchedule(s.schedule, new Date("2026-09-28T13:00:00Z"))).toBe(true); // lunes 10:00
    expect(withinSchedule(s.schedule, new Date("2026-09-28T23:30:00Z"))).toBe(false); // lunes 20:30
    expect(withinSchedule(s.schedule, new Date("2026-09-27T13:00:00Z"))).toBe(false); // domingo
  });

  it("autonomía manual pospone lo automático, nunca lo pedido por una persona", () => {
    const monday = new Date("2026-09-28T13:00:00Z");
    expect(scheduleGuard(s, false, monday)).toMatchObject({ ok: false, kind: "postpone" });
    expect(scheduleGuard(s, true, monday)).toEqual({ ok: true });
    expect(scheduleGuard({ ...s, autonomy: "assisted" }, false, monday)).toEqual({ ok: true });
  });

  it("presupuesto 0: un trabajo con costo no corre; uno sin costo sí", () => {
    expect(budgetGuard(0, 0, 0.05)).toMatchObject({ ok: false, kind: "block" });
    expect(budgetGuard(0, 0, 0)).toEqual({ ok: true });
    expect(budgetGuard(10, 9.99, 0.02)).toMatchObject({ ok: false });
  });

  it("espera creciente con tope y dominios bloqueados con subdominios", () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([60_000, 240_000, 960_000]);
    expect(backoffMs(20)).toBe(6 * 3600_000);
    expect(isBlockedDomain("tienda.ejemplo.com", ["https://www.ejemplo.com/"])).toBe(true);
    expect(isBlockedDomain("otroejemplo.com", ["ejemplo.com"])).toBe(false);
  });
});

// ─────────────────────────── Cola ───────────────────────────

describe("cola de trabajos", () => {
  it("no encola dos veces el mismo trabajo", async () => {
    const a = await db().transaction((tx) => enqueueRun(tx, agent, { agent: "x", task: "t", dedupeKey: "k1" }));
    const b = await db().transaction((tx) => enqueueRun(tx, agent, { agent: "x", task: "t", dedupeKey: "k1" }));
    expect(a.created).toBe(true);
    expect(b).toMatchObject({ created: false, run: { id: a.run.id } });
  });

  it("dos workers en paralelo nunca toman el mismo trabajo", async () => {
    for (let i = 0; i < 5; i++) await db().transaction((tx) => enqueueRun(tx, agent, { agent: "x", task: `t${i}` }));
    const claims = await Promise.all(Array.from({ length: 8 }, (_, i) => claimNext(db(), `w${i}`)));
    const ids = claims.filter(Boolean).map((r) => r!.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it("reintenta con espera creciente y queda fallido al agotar intentos", async () => {
    await db().transaction((tx) => enqueueRun(tx, agent, { agent: "x", task: "t", maxAttempts: 2 }));
    const r1 = (await claimNext(db(), "w"))!;
    await failRun(db(), r1, "caída de red");
    let [row] = await db().select().from(agentRuns).where(eq(agentRuns.id, r1.id));
    expect(row).toMatchObject({ status: "queued", attempt: 2, error: "caída de red" });
    expect(row!.runAfter.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect(await claimNext(db(), "w")).toBeNull(); // todavía no es hora

    await db().update(agentRuns).set({ runAfter: new Date(0) }).where(eq(agentRuns.id, r1.id));
    const r2 = (await claimNext(db(), "w"))!;
    await failRun(db(), r2, "otra vez");
    [row] = await db().select().from(agentRuns).where(eq(agentRuns.id, r1.id));
    expect(row).toMatchObject({ status: "failed", attempt: 2 });
  });

  it("recupera trabajos colgados de un worker caído", async () => {
    await db().transaction((tx) => enqueueRun(tx, agent, { agent: "x", task: "t" }));
    const r = (await claimNext(db(), "w"))!;
    await db().execute(sql`UPDATE agent_runs SET locked_at = now() - interval '1 hour' WHERE id = ${r.id}`);
    expect(await recoverStale(db())).toBe(1);
    const [row] = await db().select().from(agentRuns).where(eq(agentRuns.id, r.id));
    expect(row).toMatchObject({ status: "queued", attempt: 2 });
  });

  it("reintentar crea una ejecución nueva y conserva la fallida; cancelar solo en cola", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    await db().transaction((tx) => enqueueRun(tx, agent, { agent: "x", task: "t", maxAttempts: 1, dedupeKey: "k" }));
    const r = (await claimNext(db(), "w"))!;
    await failRun(db(), r, "error");
    await expect(retryRun(db(), viewer, r.id)).rejects.toBeInstanceOf(ForbiddenError);
    const again = await retryRun(db(), owner, r.id);
    expect(again.id).not.toBe(r.id);
    const { rows } = await listRuns(db(), viewer, { status: "problemas" });
    expect(rows.map((x) => x.r.id)).toEqual([r.id]);
    await cancelRun(db(), owner, again.id);
    await expect(cancelRun(db(), owner, again.id)).rejects.toThrow(/en cola/);
  });

  it("un trabajo con costo se bloquea si supera el presupuesto (presupuesto 0 por defecto)", async () => {
    await db().transaction((tx) => enqueueRun(tx, agent, { agent: "website-audit", task: "t", estimatedCostUsd: 0.5 }));
    // Pedido por el sistema y en horario no importa: el presupuesto se controla siempre.
    await db().execute(sql`UPDATE agent_runs SET requested_by_type = 'user'`);
    expect(await processNext(db())).toBe(true);
    const [row] = await db().select().from(agentRuns);
    expect(row).toMatchObject({ status: "blocked" });
    expect(row!.error).toMatch(/Presupuesto mensual alcanzado/);
  });
});

// ─────────────────────────── Agente de auditoría ───────────────────────────

const OLD_HOME = `<html><head><title>Ferretería Ejemplo</title></head><body>
<a href="/productos">Productos</a><a href="/roto">Roto</a><a href="/privado/x">Privado</a>
<a href="mailto:ventas@ferreteria.test">ventas@ferreteria.test</a>
<a href="https://wa.me/5491155550000">WhatsApp</a>
<p>© 2015</p></body></html>`;

function site(routes: Record<string, Partial<RawResponse> & { text?: string }>, log: string[] = []): () => PoliteFetcher {
  const transport: Transport = async (url, req) => {
    log.push(`${req.method} ${url.href}`);
    const r = routes[url.href];
    if (!r) return { status: 404, headers: {}, body: Buffer.from(""), truncated: false, ms: 3 };
    return { status: r.status ?? 200, headers: r.headers ?? { "content-type": "text/html" }, body: Buffer.from(r.text ?? ""), truncated: false, ms: r.ms ?? 120 };
  };
  return () => new PoliteFetcher({ transport, minIntervalMs: 0, sleep: async () => {} });
}

const ROUTES = {
  "https://ferreteria.test/robots.txt": { text: "User-agent: *\nDisallow: /privado/\nSitemap: https://ferreteria.test/sitemap.xml", headers: { "content-type": "text/plain" } },
  "https://ferreteria.test/": { text: OLD_HOME },
  "https://ferreteria.test/productos": { text: "" },
};

async function qualified(owner: Awaited<ReturnType<typeof makeUser>>) {
  const p = await createProspect(db(), owner, { name: "Ferretería Ejemplo", country: "AR", websiteUrl: "https://ferreteria.test/" });
  let cur = await transitionProspect(db(), owner, { prospectId: p.id, to: "RESEARCHING", reason: "Investigar", expectedVersion: p.version });
  cur = await transitionProspect(db(), owner, { prospectId: p.id, to: "QUALIFIED", reason: "Calificado", expectedVersion: cur.version });
  return cur;
}

describe("agente de auditoría web", () => {
  it("audita, guarda la versión, registra datos con fuente y pasa a Auditado", async () => {
    const owner = await makeUser();
    const p = await qualified(owner);
    const log: string[] = [];
    const { run } = await requestAudit(db(), owner, p.id);
    expect(await processNow(db(), run.id, { fetcher: site(ROUTES, log) })).toBe("succeeded");

    // robots.txt respetado: /privado/ nunca se pidió
    expect(log.some((l) => l.includes("/privado/"))).toBe(false);

    const a = (await getAudit(db(), owner, p.id))!;
    expect(a).toMatchObject({ version: 1, finalUrl: "https://ferreteria.test/", httpStatus: 200, runId: run.id });
    expect(a.siteScore).not.toBeNull();
    expect(a.siteScore!).toBeLessThan(80);
    const broken = (a.checks as { id: string; status: string; detail: string }[]).find((c) => c.id === "broken-links")!;
    expect(broken).toMatchObject({ status: "fail" });
    expect(broken.detail).toContain("https://ferreteria.test/roto (404)");

    const { p: after } = await getProspect(db(), owner, p.id);
    expect(after).toMatchObject({ status: "AUDITED", siteScore: a.siteScore });
    expect(after.mainIssues.length).toBeGreaterThan(0);
    const ev = (await listEvents(db(), owner, p.id))[0]!;
    expect(ev).toMatchObject({ toStatus: "AUDITED", actorType: "agent" });

    const facts = await listFacts(db(), owner, p.id);
    const email = facts.find((f) => f.value === "ventas@ferreteria.test")!;
    expect(email).toMatchObject({ category: "contact", kind: "observed", verification: "probable", sourceUrl: "https://ferreteria.test/" });
    expect(email.verifiedAt).not.toBeNull();
    expect(facts.some((f) => f.field === "WhatsApp" && f.value === "https://wa.me/5491155550000")).toBe(true);

    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r).toMatchObject({ status: "succeeded", costUsd: "0.0000", tool: "nucleo-auditoria-tecnica/1", requestedByType: "user" });
  });

  it("regenerar crea la versión 2 sin tocar la 1 ni duplicar datos", async () => {
    const owner = await makeUser();
    const p = await qualified(owner);
    for (let i = 0; i < 2; i++) {
      const { run } = await requestAudit(db(), owner, p.id);
      await processNow(db(), run.id, { fetcher: site(ROUTES) });
    }
    expect((await listAudits(db(), owner, p.id)).map((a) => a.version)).toEqual([2, 1]);
    expect((await getAudit(db(), owner, p.id, 1))!.version).toBe(1);
    const facts = await listFacts(db(), owner, p.id);
    expect(facts.filter((f) => f.value === "ventas@ferreteria.test")).toHaveLength(1);
    const cause = (e: unknown) => String((e as { cause?: Error }).cause?.message ?? e);
    await expect(db().execute(sql`UPDATE site_audits SET site_score = 100`).catch((e) => { throw new Error(cause(e)); })).rejects.toThrow(/solo agregado/);
    await expect(db().delete(siteAudits).catch((e) => { throw new Error(cause(e)); })).rejects.toThrow(/solo agregado/);
  });

  it("si robots.txt prohíbe el sitio, se bloquea sin leerlo ni reintentar", async () => {
    const owner = await makeUser();
    const p = await qualified(owner);
    const log: string[] = [];
    const { run } = await requestAudit(db(), owner, p.id);
    const result = await processNow(db(), run.id, {
      fetcher: site({ "https://ferreteria.test/robots.txt": { text: "User-agent: *\nDisallow: /" } }, log),
    });
    expect(result).toBe("blocked");
    expect(log).toEqual(["GET https://ferreteria.test/robots.txt"]);
    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r!.error).toMatch(/robots\.txt/);
    expect((await getProspect(db(), owner, p.id)).p.status).toBe("QUALIFIED");
  });

  it("un sitio que no responde queda para reintentar", async () => {
    const owner = await makeUser();
    const p = await qualified(owner);
    const { run } = await requestAudit(db(), owner, p.id);
    const down = () => new PoliteFetcher({ minIntervalMs: 0, transport: async () => { throw new Error("ECONNRESET"); } });
    expect(await processNow(db(), run.id, { fetcher: down })).toBe("queued");
    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r).toMatchObject({ status: "queued", attempt: 2 });
  });

  it("pausado: se audita pero no se mueve de estado", async () => {
    const owner = await makeUser();
    const p = await qualified(owner);
    await setPaused(db(), owner, { prospectId: p.id, paused: true, reason: "Esperar", expectedVersion: p.version });
    const { run } = await requestAudit(db(), owner, p.id);
    await processNow(db(), run.id, { fetcher: site(ROUTES) });
    const { p: after } = await getProspect(db(), owner, p.id);
    expect(after.status).toBe("QUALIFIED");
    expect(after.siteScore).not.toBeNull();
  });

  it("permisos y validaciones al pedir una auditoría", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    const p = await qualified(owner);
    await expect(requestAudit(db(), viewer, p.id)).rejects.toBeInstanceOf(ForbiddenError);
    const sinSitio = await createProspect(db(), owner, { name: "Sin Sitio", country: "AR" });
    await expect(requestAudit(db(), owner, sinSitio.id)).rejects.toThrow(/no tiene sitio/);
    const muestra = await createProspect(db(), owner, { name: "Muestra", country: "AR", websiteUrl: "muestra.example" }, { isSample: true });
    await expect(requestAudit(db(), owner, muestra.id)).rejects.toThrow(/ejemplo/);
    const s = await getSettings(db(), owner);
    await updateSettings(db(), owner, { ...s.data, blockedSources: ["ferreteria.test"] }, s.version);
    await expect(requestAudit(db(), owner, p.id)).rejects.toThrow(/fuentes bloqueadas/);
  });
});

// ─────────────────────────── Orquestador ───────────────────────────

describe("orquestador", () => {
  const mondayMorning = () => new Date("2026-09-28T13:00:00Z");

  it("con autonomía manual no encola nada solo", async () => {
    const owner = await makeUser();
    await qualified(owner);
    expect(await tick(db(), { now: mondayMorning })).toEqual({ recovered: 0, enqueued: 0 });
  });

  it("en modo asistido y en horario encola auditorías de calificados, una sola vez y dentro del tope", async () => {
    const owner = await makeUser();
    const s = await getSettings(db(), owner);
    await updateSettings(db(), owner, { ...s.data, autonomy: "assisted", maxLeadsPerDay: 1 }, s.version);
    await qualified(owner);
    const p2 = await createProspect(db(), owner, { name: "Otra", country: "AR", websiteUrl: "https://otra.test/" });
    await transitionProspect(db(), owner, { prospectId: p2.id, to: "RESEARCHING", reason: "Investigar", expectedVersion: 1 });
    await transitionProspect(db(), owner, { prospectId: p2.id, to: "QUALIFIED", reason: "Calificado", expectedVersion: 2 });

    expect((await tick(db(), { now: mondayMorning })).enqueued).toBe(1);
    expect((await tick(db(), { now: mondayMorning })).enqueued).toBe(0); // tope diario alcanzado
    const fuera = new Date("2026-09-27T13:00:00Z"); // domingo
    await db().execute(sql`TRUNCATE agent_runs CASCADE`);
    expect((await tick(db(), { now: () => fuera })).enqueued).toBe(0);
  });

  it("un trabajo automático fuera de horario se pospone sin gastar intentos", async () => {
    await db().transaction((tx) => enqueueRun(tx, "system", { agent: "website-audit", task: "t" }));
    const sunday = () => new Date("2026-09-27T13:00:00Z");
    expect(await processNext(db(), { now: sunday })).toBe(true);
    const [r] = await db().select().from(agentRuns);
    expect(r).toMatchObject({ status: "queued", attempt: 1 });
    expect(r!.error).toMatch(/En espera/);
  });
});
