import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { processNow } from "@/agents/orchestrator";
import { siteCopyHandler } from "@/agents/site-copy";
import type { JsonModel } from "@/agents/ai";
import { contrast, ensureContrast, inspectImage, palette } from "@/domain/brand";
import { checkCopy, inventedNumbers, reviewAiCopy, copyFieldsOf } from "@/domain/site-copy";
import { emptyBrief, renderSite, siteQuality, type AssetMeta, type SiteContent } from "@/domain/site";
import { createProspect } from "@/server/services/prospects";
import { getSettings, updateSettings } from "@/server/services/settings";
import { buildSite, latestBrief, listBuilds, previewHtml, requestSiteCopy, saveBrief, siteZip, uploadBrandAsset } from "@/server/services/site";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

// ── Imágenes mínimas válidas (solo cabeceras) ──
function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
function jpeg(w: number, h: number): Uint8Array {
  const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0]);
  return b;
}
function webpX(w: number, h: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X")]);
  b.set([(w - 1) & 255, ((w - 1) >> 8) & 255, 0], 24);
  b.set([(h - 1) & 255, ((h - 1) >> 8) & 255, 0], 27);
  return b;
}

describe("marca: imágenes", () => {
  it("reconoce PNG, JPEG y WebP por su contenido y lee las medidas", () => {
    expect(inspectImage(png(800, 300))).toEqual({ mime: "image/png", width: 800, height: 300 });
    expect(inspectImage(jpeg(1200, 900))).toEqual({ mime: "image/jpeg", width: 1200, height: 900 });
    expect(inspectImage(webpX(640, 480))).toEqual({ mime: "image/webp", width: 640, height: 480 });
  });

  it("rechaza SVG, HTML y archivos rotos", () => {
    expect(inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(inspectImage(Buffer.from("<html></html>"))).toBeNull();
    expect(inspectImage(png(0, 10))).toBeNull();
    expect(inspectImage(new Uint8Array([0xff, 0xd8, 0x00]))).toBeNull();
  });
});

describe("marca: colores", () => {
  it("contraste WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("respeta el color si ya se lee; si no, lo ajusta lo mínimo", () => {
    expect(ensureContrast("#1f4e79", "#ffffff", "#000000")).toBe("#1f4e79");
    const fixed = ensureContrast("#f5c542", "#ffffff", "#1a1a1a");
    expect(contrast(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const p = palette({ primary: "#f5c542", secondary: null, background: "#ffffff", text: "#1a1a1a" });
    expect(p.brand).toBe("#f5c542");
    expect(contrast(p.onButton, p.button)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(p.adjusted.length).toBeGreaterThan(0);
  });
});

describe("textos sin rastro de IA", () => {
  it("detecta frases de plantilla, marcadores, emojis y mayúsculas al estilo inglés", () => {
    const issues = checkCopy([
      { where: "a", text: "Llevamos tu negocio al siguiente nivel con soluciones innovadoras" },
      { where: "b", text: "Nuestros Servicios Profesionales", heading: true },
      { where: "c", text: "Escribinos a [email] 🚀" },
      { where: "d", text: "Como modelo de lenguaje no puedo" },
    ]);
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["cliche", "titlecase", "placeholder", "emoji", "ai-mention"]));
  });

  it("no marca castellano normal", () => {
    expect(checkCopy([{ where: "a", text: "Amasamos todo en el local, todos los días." }, { where: "b", text: "Pan de masa madre", heading: true }])).toEqual([]);
    // Nombres propios en títulos se respetan.
    expect(checkCopy([{ where: "a", text: "Panadería La Espiga Dorada", heading: true }], ["La Espiga Dorada"])).toEqual([]);
    expect(checkCopy([{ where: "a", text: "TODO: revisar" }])[0]?.kind).toBe("placeholder");
  });

  it("detecta números que la IA agregó", () => {
    expect(inventedNumbers("Desde 1998, 8 personas", "Desde 1998 somos 8 personas y 500 clientes")).toEqual(["500"]);
    expect(inventedNumbers("Tel 4833-0000", "Llamá al 4833-0000")).toEqual([]);
  });
});

const photo: AssetMeta = { id: "00000000-0000-4000-8000-000000000002", kind: "foto", mime: "image/jpeg", width: 1200, height: 900, alt: "Mostrador" };
const logo: AssetMeta = { id: "00000000-0000-4000-8000-000000000001", kind: "logo", mime: "image/png", width: 800, height: 300, alt: "" };

function goodBrief() {
  const b = emptyBrief("La Espiga", { whatsapp: "5491100000000" });
  b.brand.logoId = logo.id;
  b.content = {
    ...b.content,
    tagline: "Pan de masa madre, horneado cada mañana",
    intro: "Panadería de barrio desde 1998.",
    about: "Empezamos como un horno familiar y seguimos amasando todo en el local. Fermentamos cada masa entre 18 y 24 horas con harinas de molinos de la provincia.",
    services: [{ title: "Pan de masa madre", description: "Hogazas de campo, centeno e integral, dos horneadas por día." }],
    seoDescription: "Panadería de masa madre en Palermo: pan, facturas y tortas por encargo. Pedidos por WhatsApp.",
    heroPhotoId: photo.id,
    cta: { label: "Hacé tu pedido", channel: "whatsapp" },
  };
  return b;
}

describe("plantilla del sitio", () => {
  it("HTML limpio: escapa textos, sin JavaScript, sin menciones a IA ni créditos", () => {
    const b = goodBrief();
    b.content.businessName = `Sol <script>alert(1)</script>`;
    const { html, css } = renderSite({ ...b, assets: [logo, photo], year: 2026 });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("Sol &lt;script&gt;");
    // El único <script> es el de datos estructurados, sin "<" crudo adentro.
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toMatch(/<script type="application\/ld\+json">[^<]*<\/script>/);
    expect(html + css).not.toMatch(/\bIA\b|inteligencia artificial|generated|generator|claude|núcleo|nucleo/i);
    expect(html).toContain('href="https://wa.me/5491100000000"');
    expect(html).toContain('src="img/logo.png"');
    expect(html).toContain('src="img/foto-1.jpg"');
    expect(html).toContain('lang="es"');
  });

  it("control de calidad: listo con datos completos; falla sin contacto o con frases de plantilla", () => {
    const b = goodBrief();
    expect(siteQuality({ ...b, assets: [logo, photo] }).ready).toBe(true);

    const noContact = goodBrief();
    noContact.content.contact.whatsapp = "";
    const q1 = siteQuality({ ...noContact, assets: [logo, photo] });
    expect(q1.ready).toBe(false);
    expect(q1.checks.find((c) => c.id === "contacto")?.status).toBe("falla");

    const cliche = goodBrief();
    cliche.content.intro = "Soluciones innovadoras para llevar tu mesa al siguiente nivel.";
    expect(siteQuality({ ...cliche, assets: [logo, photo] }).checks.find((c) => c.id === "textos")?.status).toBe("falla");

    const title = goodBrief();
    title.content.services = [{ title: "Nuestros Servicios Premium", description: "Hogazas de campo, centeno e integral, dos horneadas por día." }];
    const t = siteQuality({ ...title, assets: [logo, photo] }).checks.find((c) => c.id === "textos");
    expect(t?.status).toBe("aviso");
    expect(t?.detail).toMatch(/Mayúsculas al estilo inglés/);

    const noAlt = goodBrief();
    expect(siteQuality({ ...noAlt, assets: [logo, { ...photo, alt: "" }] }).checks.find((c) => c.id === "fotos")?.status).toBe("falla");
  });

  it("la IA no puede agregar números, cambiar servicios ni usar frases de plantilla", () => {
    const before = copyFieldsOf(goodBrief().content as SiteContent);
    expect(reviewAiCopy(JSON.stringify(before), before, before)).toEqual([]);
    const bad = { ...before, intro: "Más de 500 clientes felices. Soluciones innovadoras.", services: [] };
    const problems = reviewAiCopy(JSON.stringify(before), before, bad).join(" ");
    expect(problems).toMatch(/cantidad de servicios/);
    expect(problems).toMatch(/500/);
    expect(problems).toMatch(/soluciones innovadoras/);
  });
});

// ── Servicio ──

async function client() {
  const owner = await makeUser("owner");
  const p = await createProspect(db(), owner, { name: "La Espiga", country: "AR", websiteUrl: "https://espiga.test/" });
  return { owner, p };
}

async function approve(id: string) {
  await db().execute(sql`UPDATE prospects SET status = 'APPROVED', version = version + 1 WHERE id = ${id}`);
}

describe("sitio: servicio", () => {
  it("solo para clientes: antes del proyecto aprobado no se cargan imágenes ni fichas", async () => {
    const { owner, p } = await client();
    await expect(uploadBrandAsset(db(), owner, { prospectId: p.id, kind: "logo", bytes: png(800, 300), alt: "" })).rejects.toThrow(/ya es cliente/);
    const b = goodBrief();
    await expect(saveBrief(db(), owner, { prospectId: p.id, ...b, brand: { ...b.brand, logoId: null }, content: { ...b.content, heroPhotoId: null }, authorizationNote: "Nos mandó el logo por mail" })).rejects.toThrow(/ya es cliente/);
  });

  it("carga, ficha versionada, sitio generado, vista previa y ZIP; todo inmutable", async () => {
    const { owner, p } = await client();
    await approve(p.id);
    await expect(uploadBrandAsset(db(), owner, { prospectId: p.id, kind: "logo", bytes: Buffer.from("<svg/>"), alt: "" })).rejects.toThrow(/SVG no/);
    await expect(uploadBrandAsset(db(), owner, { prospectId: p.id, kind: "foto", bytes: jpeg(1200, 900), alt: "" })).rejects.toThrow(/Describí la foto/);
    const lg = await uploadBrandAsset(db(), owner, { prospectId: p.id, kind: "logo", bytes: png(800, 300), alt: "" });
    const ph = await uploadBrandAsset(db(), owner, { prospectId: p.id, kind: "foto", bytes: jpeg(1200, 900), alt: "Mostrador con pan" });
    // Subir lo mismo otra vez no duplica.
    expect((await uploadBrandAsset(db(), owner, { prospectId: p.id, kind: "logo", bytes: png(800, 300), alt: "" })).id).toBe(lg.id);

    const b = goodBrief();
    await expect(saveBrief(db(), owner, { prospectId: p.id, ...b, authorizationNote: "ok" })).rejects.toThrow(/Autorización/);
    await expect(saveBrief(db(), owner, { prospectId: p.id, ...b, authorizationNote: "Nos mandó el logo por mail" })).rejects.toThrow(/no es de este cliente/);

    const brief = await saveBrief(db(), owner, {
      prospectId: p.id,
      brand: { ...b.brand, logoId: lg.id },
      content: { ...b.content, heroPhotoId: ph.id },
      authorizationNote: "Nos mandó el logo por mail el 30/09",
    });
    expect(brief.version).toBe(1);

    const build = await buildSite(db(), owner, p.id);
    expect(build.ready).toBe(true);
    expect((await listBuilds(db(), owner, p.id))[0]?.version).toBe(1);
    const [{ status }] = (await db().execute<{ status: string }>(sql`SELECT status FROM prospects WHERE id = ${p.id}`)).rows as [{ status: string }];
    expect(status).toBe("BUILDING");

    const preview = await previewHtml(db(), owner, build.id);
    expect(preview).toContain("<style>");
    expect(preview).toContain("data:image/png;base64,");
    expect(preview).not.toContain('"img/logo.png"');

    const z = await siteZip(db(), owner, build.id);
    expect(z.name).toBe("la-espiga-v1.zip");
    const names = z.data.toString("latin1");
    for (const f of ["index.html", "styles.css", "img/logo.png", "img/foto-1.jpg"]) expect(names).toContain(f);

    await expect(db().execute(sql`UPDATE site_builds SET html = 'x' WHERE id = ${build.id}`)).rejects.toThrow();
    await expect(db().execute(sql`DELETE FROM brand_assets WHERE id = ${lg.id}`)).rejects.toThrow();
    await expect(db().execute(sql`UPDATE site_briefs SET content = '{}' WHERE id = ${brief.id}`)).rejects.toThrow();
  });

  it("una versión que no pasa el control de calidad no se descarga", async () => {
    const { owner, p } = await client();
    await approve(p.id);
    const b = goodBrief();
    await saveBrief(db(), owner, {
      prospectId: p.id,
      brand: { ...b.brand, logoId: null },
      content: { ...b.content, heroPhotoId: null, intro: "Soluciones innovadoras para tu mesa." },
      authorizationNote: "Autorizó por WhatsApp el 30/09",
    });
    const build = await buildSite(db(), owner, p.id);
    expect(build.ready).toBe(false);
    await expect(siteZip(db(), owner, build.id)).rejects.toThrow(/control de calidad/);
  });

  it("redacción con IA: guarda una ficha nueva si pasa; la descarta si inventa", async () => {
    const { owner, p } = await client();
    await approve(p.id);
    const b = goodBrief();
    const base = { prospectId: p.id, brand: { ...b.brand, logoId: null }, content: { ...b.content, heroPhotoId: null }, authorizationNote: "Autorizó por mail el 30/09" };
    await saveBrief(db(), owner, base);
    const s = await getSettings(db(), owner);
    await updateSettings(db(), owner, { ...s.data, apiBudgetUsdMonthly: 5 }, s.version);
    const fields = copyFieldsOf(base.content as SiteContent);
    const model = (out: unknown): JsonModel => async () => ({ kind: "ok", text: JSON.stringify(out), usage: { input_tokens: 3000, output_tokens: 800 }, model: "claude-opus-5-5" });

    let { run } = await requestSiteCopy(db(), owner, p.id);
    expect(await processNow(db(), run.id, { handlers: { "site-copy": siteCopyHandler(model({ ...fields, tagline: "Pan de masa madre, recién horneado cada mañana" }), () => true) } })).toBe("succeeded");
    const v2 = await latestBrief(db(), owner, p.id);
    expect(v2?.version).toBe(2);
    expect(v2?.content.tagline).toBe("Pan de masa madre, recién horneado cada mañana");
    expect(v2?.createdByType).toBe("agent");

    ({ run } = await requestSiteCopy(db(), owner, p.id));
    expect(await processNow(db(), run.id, { handlers: { "site-copy": siteCopyHandler(model({ ...fields, intro: "Más de 5000 clientes nos eligen." }), () => true) } })).toBe("blocked");
    expect((await latestBrief(db(), owner, p.id))?.version).toBe(2);
  });
});
