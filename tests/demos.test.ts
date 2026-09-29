import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { demos } from "@/db/schema";
import { demoContentSchema, draftDemoContent, renderDemoHtml, type DemoContent } from "@/domain/demo";
import { buildOutreach, improvementsFrom } from "@/domain/outreach";
import type { Check } from "@/domain/site-audit";
import { ForbiddenError } from "@/domain/permissions";
import { createDemo, demoDraft, latestMessages, prepareMessages, publicDemo, revokeDemo } from "@/server/services/demos";
import { addFact, createProspect, getProspect, transitionProspect } from "@/server/services/prospects";
import { getSettings, updateSettings } from "@/server/services/settings";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

const content = (over: Partial<DemoContent> = {}): DemoContent => ({
  businessName: "Panadería Sol",
  industry: "Panadería",
  city: "Rosario",
  headline: "Pan de horno de barro",
  subheadline: "Desde 1985.",
  about: "",
  services: [{ title: "Pan", text: "" }],
  highlights: [],
  testimonials: [],
  contact: { phone: "341 555 0000", whatsapp: "", email: "", address: "", hours: "" },
  ctaLabel: "Consultar",
  colors: { primary: "#1f3a5f", accent: "#c8872b" },
  ...over,
});

describe("demo: plantilla", () => {
  it("escapa todo el texto: un <script> en el contenido no se ejecuta", () => {
    const html = renderDemoHtml(content({ headline: `<script>alert("x")</script>`, businessName: `A&B "Sol"` }), { version: 1, agencyName: "Núcleo", createdAt: new Date() });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A&amp;B &quot;Sol&quot;");
  });

  it("lleva noindex y el aviso de propuesta no oficial, sin scripts ni formularios", () => {
    const html = renderDemoHtml(content(), { version: 2, agencyName: "Núcleo", createdAt: new Date() });
    expect(html).toContain('name="robots" content="noindex');
    expect(html).toContain("Propuesta conceptual no oficial");
    expect(html).not.toMatch(/<script|<form|<iframe|https?:\/\/(?!schema)/i);
  });

  it("no muestra testimonios si no hay; los que hay necesitan URL de origen", () => {
    expect(renderDemoHtml(content(), { version: 1, agencyName: "", createdAt: new Date() })).not.toContain("Opiniones públicas");
    expect(demoContentSchema.safeParse(content({ testimonials: [{ quote: "Muy buenos", author: "Ana", sourceUrl: "" }] })).success).toBe(false);
  });

  it("el borrador usa solo hechos observados, nunca inferencias", () => {
    const d = draftDemoContent({ name: "Sol", industry: "Panadería", city: "Rosario" }, [
      { category: "business", field: "Servicios", value: "Pan, facturas; tortas", kind: "observed" },
      { category: "business", field: "Diferencial", value: "Horno de barro", kind: "inference" },
      { category: "contact", field: "Teléfono", value: "341 555", kind: "observed" },
      { category: "visual", field: "Colores", value: "#aa3311 y #ffcc00", kind: "observed" },
    ]);
    expect(d.services.map((s) => s.title)).toEqual(["Pan", "facturas", "tortas"]);
    expect(d.highlights).toEqual([]);
    expect(d.contact.phone).toBe("341 555");
    expect(d.colors).toEqual({ primary: "#aa3311", accent: "#ffcc00" });
  });
});

describe("mensajes: armado", () => {
  const checks: Check[] = [
    { id: "viewport", category: "movil", label: "", status: "fail", detail: "", weight: 3 },
    { id: "cta", category: "conversion", label: "", status: "warn", detail: "", weight: 2 },
    { id: "https", category: "seguridad", label: "", status: "fail", detail: "", weight: 3 },
    { id: "hsts", category: "seguridad", label: "", status: "warn", detail: "", weight: 1 },
  ];
  const sender = { agencyName: "Núcleo", senderName: "Jaz", replyEmail: "hola@nucleo.test", whatsapp: "", website: "" };

  it("tres mejoras como beneficios, primero lo más importante", () => {
    expect(improvementsFrom(checks)).toEqual([
      "que el sitio se adapte bien al celular",
      "sumar conexión segura (HTTPS), para que el navegador no muestre el aviso de «No seguro»",
      "botones claros para consultar o pedir presupuesto",
    ]);
  });

  it("no inventa un elogio: si no hay dato observado, avisa", () => {
    const m = buildOutreach({ businessName: "Sol", country: "AR", facts: [], auditChecks: checks, demoUrl: "https://x.test/demo/abc", sender, allowedChannels: ["email"] });
    expect(m.positive).toBeNull();
    expect(m.warnings.join()).toMatch(/dato observado positivo/);
    expect(m.channel.suggested).toBe("ninguno");
    expect(m.emailText).toContain("https://x.test/demo/abc");
    expect(m.emailText).not.toMatch(/urgente|última oportunidad|garantizado/i);
  });

  it("usa el dato real y sugiere el canal disponible", () => {
    const m = buildOutreach({
      businessName: `Sol <b>`,
      country: "AR",
      facts: [
        { category: "business", field: "Antigüedad", value: "Desde 1985", kind: "observed" },
        { category: "contact", field: "WhatsApp", value: "https://wa.me/549341", kind: "observed" },
      ],
      auditChecks: checks,
      demoUrl: "https://x.test/demo/abc",
      sender,
      allowedChannels: ["email", "whatsapp"],
    });
    expect(m.positive).toBe("Desde 1985");
    expect(m.channel.suggested).toBe("whatsapp");
    expect(m.emailHtml).toContain("Sol &lt;b&gt;");
    expect(m.emailHtml).not.toMatch(/<script/i);
    expect(m.subjects).toHaveLength(3);
    expect(m.bestTime.basis).toMatch(/No es un dato medido/);
  });
});

describe("demos y mensajes: servicio", () => {
  async function audited(owner: Awaited<ReturnType<typeof makeUser>>) {
    const p = await createProspect(db(), owner, { name: "Panadería Sol", country: "AR", websiteUrl: "https://sol.test/" });
    let cur = p;
    for (const to of ["RESEARCHING", "QUALIFIED", "AUDITED"] as const) {
      cur = await transitionProspect(db(), owner, { prospectId: p.id, to, reason: "Paso de prueba", expectedVersion: cur.version });
    }
    return cur;
  }

  it("crea versiones con enlace propio, mueve el estado y se puede revocar", async () => {
    const owner = await makeUser();
    const p = await audited(owner);
    const d1 = await createDemo(db(), owner, p.id, content());
    expect(d1.version).toBe(1);
    expect(d1.token.length).toBeGreaterThanOrEqual(43);
    expect((await getProspect(db(), owner, p.id)).p.status).toBe("DEMO_READY");

    const d2 = await createDemo(db(), owner, p.id, content({ headline: "Otra idea" }));
    expect(d2.version).toBe(2);
    expect(d2.token).not.toBe(d1.token);
    expect((await demoDraft(db(), owner, p.id)).headline).toBe("Otra idea");

    expect(await publicDemo(db(), d1.token)).toMatchObject({ demo: { id: d1.id }, agencyName: "Núcleo" });
    await revokeDemo(db(), owner, d1.id);
    expect(await publicDemo(db(), d1.token)).toEqual({ gone: true });
    expect(await publicDemo(db(), "no-existe")).toBeNull();

    const cause = (e: unknown) => String((e as { cause?: Error }).cause?.message ?? e);
    await expect(db().update(demos).set({ content: {} }).where(eq(demos.id, d2.id)).catch((e) => { throw new Error(cause(e)); })).rejects.toThrow(/no se modifica/);
    await expect(db().execute(sql`DELETE FROM demos`).catch((e) => { throw new Error(cause(e)); })).rejects.toThrow(/solo agregado/);
  });

  it("valida el contenido y los permisos", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    const p = await audited(owner);
    await expect(createDemo(db(), viewer, p.id, content())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createDemo(db(), owner, p.id, content({ colors: { primary: "red", accent: "#000000" } }))).rejects.toThrow(/#RRGGBB/);
  });

  it("prepara mensajes con el enlace vigente y pasa a Mensaje listo", async () => {
    const owner = await makeUser();
    const s = await getSettings(db(), owner);
    await updateSettings(db(), owner, { ...s.data, sender: { ...s.data.sender, senderName: "Jaz", replyEmail: "hola@nucleo.test" } }, s.version);
    const p = await audited(owner);
    await expect(prepareMessages(db(), owner, p.id, "https://panel.test")).rejects.toThrow(/Primero generá una demo/);

    await addFact(db(), owner, { prospectId: p.id, category: "contact", field: "Email", value: "info@sol.test", kind: "observed", verification: "verified", confidence: 90, sourceUrl: "https://sol.test/" });
    const d = await createDemo(db(), owner, p.id, content());
    const m = await prepareMessages(db(), owner, p.id, "https://panel.test/");
    const saved = (await latestMessages(db(), owner, p.id))!;
    expect(saved.id).toBe(m.id);
    expect(saved.content.demoUrl).toBe(`https://panel.test/demo/${d.token}`);
    expect(saved.content.channel.suggested).toBe("email");
    expect(saved.content.emailText).toContain("Soy Jaz, de Núcleo.");
    expect((await getProspect(db(), owner, p.id)).p.status).toBe("OUTREACH_READY");

    await revokeDemo(db(), owner, d.id);
    await expect(prepareMessages(db(), owner, p.id, "https://panel.test")).rejects.toThrow(/enlace vigente/);
  });
});
