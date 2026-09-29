import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { computeOpportunity } from "@/domain/opportunity";
import type { Check } from "@/domain/site-audit";
import { PoliteFetcher, type RawResponse, type Transport } from "@/agents/http";
import { processNow } from "@/agents/orchestrator";
import { requestAudit } from "@/server/services/audits";
import { addFact, createProspect, getProspect } from "@/server/services/prospects";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

const check = (id: string, status: Check["status"]): Check => ({ id, category: "seo", label: id, status, detail: "", weight: 1 });

describe("puntaje de oportunidad: reglas", () => {
  it("sin datos suficientes no inventa un número", () => {
    const r = computeOpportunity({ audit: null, facts: [], research: null });
    expect(r.score).toBeNull();
    expect(r.note).toMatch(/al menos 3/);
    // Contacto siempre se mide (0 si no hay): con solo eso no alcanza.
    expect(r.measured).toBe(1);
  });

  it("sitio viejo, con contacto y negocio activo: puntaje alto y explicado", () => {
    const r = computeOpportunity({
      audit: { siteScore: 30, checks: [check("viewport", "fail"), check("https", "fail"), check("cta", "warn")] },
      facts: [
        { category: "contact", field: "Email", kind: "observed", verification: "verified" },
        { category: "contact", field: "WhatsApp", kind: "observed", verification: "probable" },
        { category: "business", field: "Rubro", kind: "observed", verification: "probable" },
      ],
      research: { recommendation: "qualify" },
    });
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThanOrEqual(70);
    const byKey = Object.fromEntries(r.criteria.map((c) => [c.key, c]));
    expect(byKey.modernizacion!.score).toBe(70);
    expect(byKey.visible!.detail).toMatch(/no se adapta al celular/);
    expect(byKey.contacto!.score).toBe(90); // 50 + 2×15 + 1 confirmado×10
    expect(byKey.pago).toMatchObject({ score: null, weight: 0 });
  });

  it("sitio bueno o negocio descartado por la investigación: puntaje bajo", () => {
    const r = computeOpportunity({
      audit: { siteScore: 92, checks: [check("viewport", "pass")] },
      facts: [],
      research: { recommendation: "reject" },
    });
    expect(r.score!).toBeLessThan(20);
  });
});

describe("puntaje de oportunidad: integración", () => {
  const html = `<html><head><title>Ferretería</title></head><body><a href="mailto:ventas@ferre.test">Email</a><p>© 2014</p></body></html>`;
  const transport: Transport = async (url): Promise<RawResponse> =>
    url.href === "https://ferre.test/"
      ? { status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(html), truncated: false, ms: 50 }
      : { status: 404, headers: {}, body: Buffer.from(""), truncated: false, ms: 5 };
  const fetcher = () => new PoliteFetcher({ transport, minIntervalMs: 0, sleep: async () => {} });

  it("se calcula al terminar la auditoría y se actualiza al cargar un dato", async () => {
    const owner = await makeUser();
    const p = await createProspect(db(), owner, { name: "Ferretería", country: "AR", websiteUrl: "https://ferre.test/" });
    const { run } = await requestAudit(db(), owner, p.id);
    await processNow(db(), run.id, { fetcher });

    let { p: after } = await getProspect(db(), owner, p.id);
    expect(after.opportunityScore).not.toBeNull(); // modernización + mejoras visibles + contacto + información
    const first = after.opportunityScore!;
    expect((after.scoreExplanation as { criteria: unknown[] }).criteria.length).toBeGreaterThan(5);

    await addFact(db(), owner, {
      prospectId: p.id,
      category: "contact",
      field: "Teléfono",
      value: "341 555 0000",
      kind: "observed",
      verification: "verified",
      confidence: 90,
      sourceUrl: "https://ferre.test/",
    });
    ({ p: after } = await getProspect(db(), owner, p.id));
    expect(after.opportunityScore!).toBeGreaterThan(first);
  });
});
