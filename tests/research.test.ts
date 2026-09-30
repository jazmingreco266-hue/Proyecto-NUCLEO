import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { agentRuns } from "@/db/schema";
import { ForbiddenError } from "@/domain/permissions";
import { costUsd, pageText, pickResearchLinks, verifyFacts, type ResearchOutput } from "@/domain/research";
import { PoliteFetcher, type RawResponse, type Transport } from "@/agents/http";
import type { ResearchModel } from "@/agents/ai";
import { businessResearchHandler } from "@/agents/business-research";
import { processNow, tick } from "@/agents/orchestrator";
import { createProspect, getProspect, listFacts, setPaused } from "@/server/services/prospects";
import { latestResearch, requestResearch } from "@/server/services/research";
import { getSettings, updateSettings } from "@/server/services/settings";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

// ─────────────────────────── Reglas puras ───────────────────────────

describe("investigación: reglas puras", () => {
  it("costo según la tabla oficial de precios de Opus 5.5", () => {
    expect(costUsd({ input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
    expect(costUsd({ input_tokens: 0, output_tokens: 1_000_000 })).toBe(20);
    expect(costUsd({ input_tokens: 10_000, output_tokens: 2_000, cache_read_input_tokens: 1_000_000 })).toBe(0.28);
  });

  it("extrae texto legible sin scripts ni estilos", () => {
    const p = pageText(`<html><head><title>Hola</title><style>.x{}</style></head><body><script>alert(1)</script><h1>Panadería</h1><p>Abierto   desde 1985</p></body></html>`, "https://a.test/");
    expect(p.title).toBe("Hola");
    expect(p.text).toContain("Panadería");
    expect(p.text).toContain("Abierto desde 1985");
    expect(p.text).not.toContain("alert");
  });

  it("elige páginas internas útiles", () => {
    expect(
      pickResearchLinks(["https://a.test/nosotros", "https://a.test/blog/post-1", "https://a.test/contacto", "https://a.test/servicios/x"]),
    ).toEqual(["https://a.test/nosotros", "https://a.test/contacto", "https://a.test/servicios/x"]);
  });

  it("solo acepta hechos observados con cita textual en una página leída", () => {
    const pages = [{ url: "https://a.test/", title: "Panadería Sol", text: "Horno   de barro desde 1985.\nPedidos al 4555-1234", truncated: false }];
    const out: ResearchOutput = {
      summary: "x",
      qualification: { recommendation: "qualify", reasons: [] },
      facts: [
        { category: "business", field: "Antigüedad", value: "Desde 1985", kind: "observed", source_url: "https://a.test/", evidence: "horno de barro desde 1985", confidence: 90 },
        { category: "contact", field: "Email", value: "info@sol.test", kind: "observed", source_url: "https://a.test/", evidence: "info@sol.test", confidence: 90 },
        { category: "business", field: "Sucursales", value: "3", kind: "observed", source_url: "https://otro.test/", evidence: "Horno de barro", confidence: 90 },
        { category: "business", field: "Pedidos", value: "Toma pedidos por teléfono", kind: "inference", source_url: "https://inventada.test/", evidence: "Pedidos al 4555-1234", confidence: 70 },
      ],
    };
    const { accepted, rejected } = verifyFacts(out, pages);
    expect(accepted.map((f) => f.field)).toEqual(["Antigüedad", "Pedidos"]);
    expect(accepted[1]!.sourceUrl).toBeNull(); // URL desconocida en una inferencia: se guarda sin URL
    expect(rejected.map((r) => r.reason)).toEqual(["La cita no aparece textual en la página.", "La URL citada no es una de las páginas leídas."]);
  });
});

// ─────────────────────────── Agente ───────────────────────────

const HOME = `<html><head><title>Panadería Sol</title></head><body>
<h1>Panadería Sol</h1><p>Horno de barro desde 1985 en Rosario.</p>
<a href="/nosotros">Nosotros</a><a href="/blog/x">Blog</a></body></html>`;
const ABOUT = `<html><body><p>Somos una empresa familiar. Hacemos pedidos para eventos por teléfono.</p></body></html>`;

function site(): () => PoliteFetcher {
  const routes: Record<string, string> = { "https://sol.test/": HOME, "https://sol.test/nosotros": ABOUT };
  const transport: Transport = async (url) => {
    const text = routes[url.href];
    const r: RawResponse = text
      ? { status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(text), truncated: false, ms: 5 }
      : { status: 404, headers: {}, body: Buffer.from(""), truncated: false, ms: 5 };
    return r;
  };
  return () => new PoliteFetcher({ transport, minIntervalMs: 0, sleep: async () => {} });
}

const GOOD: ResearchOutput = {
  summary: "Panadería familiar de Rosario con horno de barro.",
  qualification: { recommendation: "qualify", reasons: ["Negocio activo", "Toma pedidos por teléfono"] },
  facts: [
    { category: "business", field: "Antigüedad", value: "Desde 1985", kind: "observed", source_url: "https://sol.test/", evidence: "Horno de barro desde 1985 en Rosario.", confidence: 95 },
    { category: "business", field: "Tipo de empresa", value: "Familiar", kind: "observed", source_url: "https://sol.test/nosotros", evidence: "Somos una empresa familiar.", confidence: 95 },
    { category: "business", field: "Necesidad digital", value: "Pedidos online para eventos", kind: "inference", source_url: "https://sol.test/nosotros", evidence: "Hoy toma pedidos por teléfono.", confidence: 90 },
    { category: "contact", field: "Teléfono", value: "341-555-0000", kind: "observed", source_url: "https://sol.test/", evidence: "341-555-0000", confidence: 90 },
  ],
};

function fakeModel(out: unknown, calls: string[] = []): ResearchModel {
  return async ({ prompt }) => {
    calls.push(prompt);
    return { kind: "ok", text: JSON.stringify(out), usage: { input_tokens: 5000, output_tokens: 1000 }, model: "claude-opus-5-5" };
  };
}

async function withBudget(owner: Awaited<ReturnType<typeof makeUser>>, usd: number, extra: object = {}) {
  const s = await getSettings(db(), owner);
  await updateSettings(db(), owner, { ...s.data, apiBudgetUsdMonthly: usd, ...extra }, s.version);
}

describe("agente de investigación", () => {
  it("con presupuesto 0 (valor inicial) no llama a la IA", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    const calls: string[] = [];
    const { run } = await requestResearch(db(), owner, p.id);
    const res = await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(fakeModel(GOOD, calls), () => true) } });
    expect(res).toBe("blocked");
    expect(calls).toHaveLength(0);
    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r!.error).toMatch(/Presupuesto mensual/);
  });

  it("sin API key queda bloqueado sin gastar", async () => {
    const owner = await makeUser();
    await withBudget(owner, 10);
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    const { run } = await requestResearch(db(), owner, p.id);
    const res = await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(fakeModel(GOOD), () => false) } });
    expect(res).toBe("blocked");
    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r).toMatchObject({ costUsd: "0.0000" });
    expect(r!.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("investiga, guarda solo lo verificable, registra el costo y lo califica", async () => {
    const owner = await makeUser();
    await withBudget(owner, 10);
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    const calls: string[] = [];
    const { run } = await requestResearch(db(), owner, p.id);
    const res = await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(fakeModel(GOOD, calls), () => true) } });
    expect(res).toBe("succeeded");

    // Leyó la principal y "nosotros", no el blog; el texto de las páginas va marcado como contenido
    expect(calls[0]).toContain('<page url="https://sol.test/nosotros"');
    expect(calls[0]).not.toContain("blog");

    const facts = await listFacts(db(), owner, p.id);
    const byField = Object.fromEntries(facts.map((f) => [f.field, f]));
    expect(byField["Antigüedad"]).toMatchObject({ kind: "observed", verification: "probable", confidence: 80, sourceUrl: "https://sol.test/" });
    expect(byField["Necesidad digital"]).toMatchObject({ kind: "inference", verification: "unconfirmed", confidence: 60 });
    expect(byField["Teléfono"]).toBeUndefined(); // el teléfono no está en la página: descartado

    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r).toMatchObject({ status: "succeeded", costUsd: "0.0400", model: "claude-opus-5-5", tokensIn: 5000, tokensOut: 1000 });
    const out = r!.output as { datosDescartados: { field: string }[]; datosNuevos: number };
    expect(out.datosDescartados.map((d) => d.field)).toEqual(["Teléfono"]);
    expect(out.datosNuevos).toBe(3);

    expect((await getProspect(db(), owner, p.id)).p.status).toBe("QUALIFIED");
    expect((await latestResearch(db(), owner, p.id))!.id).toBe(run.id);
  });

  it("repetir la investigación no duplica datos", async () => {
    const owner = await makeUser();
    await withBudget(owner, 10);
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    for (let i = 0; i < 2; i++) {
      const { run } = await requestResearch(db(), owner, p.id);
      await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(fakeModel(GOOD), () => true) } });
    }
    const facts = await listFacts(db(), owner, p.id);
    expect(facts.filter((f) => f.field === "Antigüedad")).toHaveLength(1);
  });

  it("un rechazo del modelo se bloquea y su costo igual cuenta", async () => {
    const owner = await makeUser();
    await withBudget(owner, 10);
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    const refused: ResearchModel = async () => ({ kind: "refused", category: "cyber", usage: { input_tokens: 10_000, output_tokens: 0 }, model: "claude-opus-5-5" });
    const { run } = await requestResearch(db(), owner, p.id);
    expect(await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(refused, () => true) } })).toBe("blocked");
    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r).toMatchObject({ status: "blocked", costUsd: "0.0400" });
    expect(r!.error).toMatch(/declinó/);
  });

  it("una respuesta con formato inválido se reintenta, acumulando el costo", async () => {
    const owner = await makeUser();
    await withBudget(owner, 10);
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    const { run } = await requestResearch(db(), owner, p.id);
    await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(fakeModel({ facts: "no" }), () => true) } });
    const [r] = await db().select().from(agentRuns).where(eq(agentRuns.id, run.id));
    expect(r).toMatchObject({ status: "queued", attempt: 2, costUsd: "0.0400" });
  });

  it("pausado: guarda datos pero no cambia el estado; y permisos", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    await withBudget(owner, 10);
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    await expect(requestResearch(db(), viewer, p.id)).rejects.toBeInstanceOf(ForbiddenError);
    await setPaused(db(), owner, { prospectId: p.id, paused: true, reason: "Esperar", expectedVersion: p.version });
    const { run } = await requestResearch(db(), owner, p.id);
    await processNow(db(), run.id, { fetcher: site(), handlers: { "business-research": businessResearchHandler(fakeModel(GOOD), () => true) } });
    expect((await getProspect(db(), owner, p.id)).p.status).toBe("DISCOVERED");
    expect((await listFacts(db(), owner, p.id)).length).toBeGreaterThan(0);
  });
});

describe("orquestador con IA", () => {
  const monday = () => new Date("2026-09-28T13:00:00Z");

  it("en modo asistido encola investigaciones solo con API key y presupuesto", async () => {
    const owner = await makeUser();
    await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    await withBudget(owner, 0, { autonomy: "assisted" });
    expect((await tick(db(), { now: monday, aiConfigured: () => true })).enqueued).toBe(0); // sin presupuesto
    await withBudget(owner, 5, { autonomy: "assisted" });
    expect((await tick(db(), { now: monday, aiConfigured: () => false })).enqueued).toBe(0); // sin API key
    expect((await tick(db(), { now: monday, aiConfigured: () => true })).enqueued).toBe(1);
    expect((await tick(db(), { now: monday, aiConfigured: () => true })).enqueued).toBe(0); // no repite
  });
});
