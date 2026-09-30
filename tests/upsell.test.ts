import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { quoteSplit } from "@/domain/finance";
import { buildOutreach } from "@/domain/outreach";
import { detectUpsells } from "@/domain/upsell";
import { computeOpportunity } from "@/domain/opportunity";
import { createQuote, listPortfolio, quoteToSale, savePortfolioItem, setQuoteStatus } from "@/server/services/finance";
import { DEFAULT_SETTINGS } from "@/domain/validation";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

const fact = (category: string, field: string, value: string, kind = "observed") => ({ category, field, value, kind, sourceUrl: "https://a.test/" });

describe("servicios adicionales: detección", () => {
  it("sugiere chatbot y base de datos con el dato que lo motivó", () => {
    const u = detectUpsells(
      [fact("contact", "WhatsApp", "https://wa.me/549341"), fact("business", "Servicios", "Turnos para peluquería y venta de productos")],
      DEFAULT_SETTINGS.pricing.items,
    );
    expect(u.map((x) => x.service)).toEqual(["Chatbot", "Base de datos / CRM"]);
    expect(u[0]!.signals[0]).toMatchObject({ id: "whatsapp", evidence: "WhatsApp: https://wa.me/549341", sourceUrl: "https://a.test/" });
    expect(u[1]!.signals.map((s) => s.id)).toEqual(["turnos", "catalogo"]);
    expect(u[0]!.priceItems.map((p) => p.name)).toEqual(["Chatbot de WhatsApp (desarrollo)"]);
    expect(u[1]!.priceItems.some((p) => p.recurring)).toBe(true);
  });

  it("sin señales no sugiere nada", () => {
    expect(detectUpsells([fact("business", "Rubro", "Estudio contable")])).toEqual([]);
    // un email no es señal de chatbot; un WhatsApp escrito en otra categoría tampoco
    expect(detectUpsells([fact("contact", "Email", "a@b.test"), fact("business", "Nota", "sin whatsapp")]).map((x) => x.service)).toEqual([]);
  });

  it("los mensajes lo mencionan solo si hay una señal", () => {
    const sender = { agencyName: "Núcleo", senderName: "Jaz", replyEmail: "", whatsapp: "", website: "" };
    const base = { businessName: "Sol", country: "AR", facts: [], auditChecks: null, sender, allowedChannels: ["email"] };
    expect(buildOutreach(base).extras).toEqual([]);
    const m = buildOutreach({ ...base, upsells: detectUpsells([fact("business", "Servicios", "Reservas por teléfono")]) });
    expect(m.extras).toEqual(["También vi que manejan turnos o reservas: una base de datos simple podría ordenar clientes, turnos o pedidos en un solo lugar."]);
    expect(m.emailText).toContain(m.extras[0]);
    expect(m.emailHtml).toContain("También vi que manejan turnos o reservas");
  });

  it("suma al puntaje de oportunidad como un criterio más", () => {
    const r = computeOpportunity({
      audit: null,
      facts: [{ category: "business", field: "Servicios", value: "Turnos online", kind: "observed", verification: "probable" }],
      research: { recommendation: "qualify" },
    });
    expect(r.criteria.find((c) => c.key === "adicionales")).toMatchObject({ score: 60 });
  });
});

describe("cotizador con abonos mensuales", () => {
  it("separa pago único y abono mensual", () => {
    const s = quoteSplit(
      [
        { description: "Chatbot (desarrollo)", quantity: 1, unitPrice: 800000 },
        { description: "Mantenimiento", quantity: 1, unitPrice: 120000, recurring: true },
      ],
      10,
      0,
    );
    expect(s.oneTime.total).toBe(720000);
    expect(s.monthly.total).toBe(108000);
  });

  it("guarda el abono mensual; la venta registra solo el pago único", async () => {
    const owner = await makeUser();
    const q = await createQuote(db(), owner, {
      clientName: "Peluquería de prueba",
      currency: "ARS",
      lines: [
        { description: "Base de datos de turnos", quantity: 1, unitPrice: 2000000 },
        { description: "Mantenimiento", quantity: 1, unitPrice: 120000, recurring: true },
      ],
      discountPct: 0,
      taxPct: 0,
    });
    expect(q).toMatchObject({ total: "2000000.00", monthlyTotal: "120000.00" });
    await setQuoteStatus(db(), owner, q.id, "enviado");
    await setQuoteStatus(db(), owner, q.id, "aceptado");
    expect((await quoteToSale(db(), owner, q.id)).amount).toBe("2000000.00");

    const soloMensual = await createQuote(db(), owner, {
      clientName: "Solo abono",
      currency: "ARS",
      lines: [{ description: "Mantenimiento", quantity: 1, unitPrice: 50000, recurring: true }],
      discountPct: 0,
      taxPct: 0,
    });
    await setQuoteStatus(db(), owner, soloMensual.id, "enviado");
    await setQuoteStatus(db(), owner, soloMensual.id, "aceptado");
    await expect(quoteToSale(db(), owner, soloMensual.id)).rejects.toThrow(/cobro mensual/);
  });
});

describe("portafolio con tipo de servicio", () => {
  it("guarda qué se hizo y rechaza servicios desconocidos", async () => {
    const owner = await makeUser();
    const base = { title: "Turnos online", clientName: "Peluquería", url: "", year: 2026, summary: "", highlights: [], tags: [], featured: false, clientOk: true };
    await savePortfolioItem(db(), owner, { ...base, services: ["Chatbot", "Base de datos / CRM"] });
    expect((await listPortfolio(db(), owner))[0]!.services).toEqual(["Chatbot", "Base de datos / CRM"]);
    await expect(savePortfolioItem(db(), owner, { ...base, services: ["Otra cosa"] })).rejects.toThrow();
  });
});
