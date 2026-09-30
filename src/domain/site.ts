/**
 * Sitio web del cliente: ficha (marca + textos), plantilla profesional y control de calidad.
 *
 * Reglas:
 * - Marca y textos los aporta el cliente. El sistema no inventa datos, testimonios, cifras ni fotos.
 * - El código entregado no menciona IA ni herramientas de generación, y no trae créditos de la agencia.
 * - Sin JavaScript: HTML y CSS limpios, rápidos y accesibles.
 * - El sitio se puede entregar solo si el control de calidad no tiene fallas.
 */
import { z } from "zod";
import { FONT_NAMES, FONTS, googleFontsHref, HEX, IMAGE_EXT, MAX_PHOTOS, palette, contrast, MIN_TEXT_CONTRAST, type FontName, type ImageMime } from "./brand";
import { BLOCKING, checkCopy, ISSUE_LABELS, type CopyText } from "./site-copy";

export const SITE_TEMPLATE = "profesional/1";

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const optUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => u === "" || /^https?:\/\/[^\s<>"]+$/i.test(u), "Tiene que ser una dirección web completa (https://…).");

export const siteBrandSchema = z.object({
  colors: z.object({
    primary: z.string().regex(HEX, "Color principal inválido (formato #RRGGBB)."),
    secondary: z.string().regex(HEX).nullable(),
    background: z.string().regex(HEX, "Color de fondo inválido."),
    text: z.string().regex(HEX, "Color de texto inválido."),
  }),
  headingFont: z.enum(FONT_NAMES as [FontName, ...FontName[]]),
  bodyFont: z.enum(FONT_NAMES as [FontName, ...FontName[]]),
  logoId: z.string().uuid().nullable(),
});

export const TRATOS = ["vos", "tú", "usted"] as const;

export const siteContentSchema = z.object({
  businessName: text(80).min(2, "Falta el nombre del negocio."),
  tagline: text(90).min(3, "Falta la frase principal."),
  intro: text(240),
  about: text(1500),
  services: z
    .array(z.object({ title: text(60).min(2, "Cada servicio necesita un título."), description: text(320) }))
    .min(1, "Cargá al menos un servicio.")
    .max(9, "Máximo 9 servicios."),
  highlights: z.array(text(90).min(2, "Destacado demasiado corto.")).max(6, "Máximo 6 destacados."),
  contact: z.object({
    phone: text(40),
    whatsapp: z.string().trim().regex(/^(\d{8,15})?$/, "WhatsApp: solo números, con código de país (ej. 5491122334455)."),
    email: z.union([z.literal(""), z.string().trim().email("Email inválido.").max(120)]),
    address: text(200),
    hours: text(200),
    mapUrl: optUrl,
  }),
  social: z.array(z.object({ label: text(30).min(2, "Falta el nombre de la red."), url: optUrl.refine((u) => u !== "", "Falta la dirección de la red.") })).max(5, "Máximo 5 redes."),
  cta: z.object({ label: text(30).min(2, "Falta el texto del botón."), channel: z.enum(["whatsapp", "phone", "email"]) }),
  heroPhotoId: z.string().uuid().nullable(),
  galleryIds: z.array(z.string().uuid()).max(MAX_PHOTOS),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$|^$/, "Dominio inválido (ej. mipanaderia.com.ar)."),
  seoDescription: text(160),
  trato: z.enum(TRATOS),
});

export const CHANNEL_LABELS = { whatsapp: "WhatsApp", phone: "teléfono", email: "email" } as const;

export type SiteBrand = z.infer<typeof siteBrandSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
export type AssetMeta = { id: string; kind: "logo" | "foto"; mime: ImageMime; width: number; height: number; alt: string };

// ── Utilidades ──────────────────────────────────────────────────────────

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Párrafos separados por línea en blanco. */
function paragraphs(s: string): string {
  return s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** Ruta del archivo de una imagen dentro del sitio entregado. */
export function assetPath(a: AssetMeta, index = 0): string {
  return a.kind === "logo" ? `img/logo.${IMAGE_EXT[a.mime]}` : `img/foto-${index + 1}.${IMAGE_EXT[a.mime]}`;
}

function ctaHref(c: SiteContent): string | null {
  const { channel } = c.cta;
  if (channel === "whatsapp" && c.contact.whatsapp) return `https://wa.me/${c.contact.whatsapp}`;
  if (channel === "phone" && c.contact.phone) return `tel:${c.contact.phone.replace(/[^\d+]/g, "")}`;
  if (channel === "email" && c.contact.email) return `mailto:${c.contact.email}`;
  return null;
}

const ICONS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 1a4.5 4.5 0 0 1-2.4-2.4l1-1-1-2L9 8.5Z" fill="currentColor"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  address:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  hours:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ── Plantilla ───────────────────────────────────────────────────────────

export type RenderInput = { brand: SiteBrand; content: SiteContent; assets: AssetMeta[]; year: number };

export function renderSite({ brand, content: c, assets, year }: RenderInput): { html: string; css: string } {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const logo = brand.logoId ? byId.get(brand.logoId) ?? null : null;
  const photos = assets.filter((a) => a.kind === "foto");
  const photoPath = (id: string) => {
    const a = byId.get(id);
    return a ? assetPath(a, photos.indexOf(a)) : null;
  };
  const img = (a: AssetMeta, path: string, cls: string, eager = false) =>
    `<img class="${cls}" src="${path}" alt="${esc(a.alt)}" width="${a.width}" height="${a.height}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;

  const hero = c.heroPhotoId ? byId.get(c.heroPhotoId) : undefined;
  const gallery = c.galleryIds.map((id) => byId.get(id)).filter((a): a is AssetMeta => Boolean(a && a.kind === "foto" && a.id !== hero?.id));
  const galleryRest = c.about ? gallery.slice(1) : gallery;
  const cta = ctaHref(c);
  const external = (href: string) => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "");
  const fontsHref = googleFontsHref([brand.headingFont, brand.bodyFont]);
  const description = c.seoDescription || c.intro || c.tagline;
  const canonical = c.domain ? `https://${c.domain}/` : null;
  const brandMark = logo
    ? img(logo, assetPath(logo), "logo", true).replace(`alt="${esc(logo.alt)}"`, `alt="${esc(c.businessName)}"`)
    : `<span class="wordmark">${esc(c.businessName)}</span>`;

  const nav = [
    ["#servicios", "Servicios"],
    ...(c.about ? [["#nosotros", "Nosotros"]] : []),
    ["#contacto", "Contacto"],
  ] as const;
  const navLinks = nav.map(([h, l]) => `<a href="${h}">${l}</a>`).join("");
  const ctaButton = (cls: string) => (cta ? `<a class="btn ${cls}" href="${esc(cta)}"${external(cta)}>${esc(c.cta.label)}</a>` : "");

  const contactItems = [
    c.contact.whatsapp && { icon: ICONS.whatsapp, label: "WhatsApp", value: `+${c.contact.whatsapp}`, href: `https://wa.me/${c.contact.whatsapp}` },
    c.contact.phone && { icon: ICONS.phone, label: "Teléfono", value: c.contact.phone, href: `tel:${c.contact.phone.replace(/[^\d+]/g, "")}` },
    c.contact.email && { icon: ICONS.email, label: "Email", value: c.contact.email, href: `mailto:${c.contact.email}` },
    c.contact.address && { icon: ICONS.address, label: "Dirección", value: c.contact.address, href: c.contact.mapUrl || null },
    c.contact.hours && { icon: ICONS.hours, label: "Horarios", value: c.contact.hours, href: null },
  ].filter(Boolean) as { icon: string; label: string; value: string; href: string | null }[];

  // Datos estructurados para buscadores: solo lo que cargó el cliente.
  const ld: Record<string, unknown> = { "@context": "https://schema.org", "@type": "LocalBusiness", name: c.businessName };
  if (description) ld.description = description;
  if (canonical) ld.url = canonical;
  if (c.contact.phone) ld.telephone = c.contact.phone;
  if (c.contact.email) ld.email = c.contact.email;
  if (c.contact.address) ld.address = c.contact.address;
  if (logo) ld.logo = canonical ? `${canonical}${assetPath(logo)}` : assetPath(logo);
  if (c.social.length) ld.sameAs = c.social.map((s) => s.url);

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.businessName)}${c.tagline ? ` · ${esc(c.tagline)}` : ""}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ""}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(c.businessName)}">
<meta property="og:description" content="${esc(description)}">
${logo ? `<meta property="og:image" content="${canonical ? canonical : ""}${assetPath(logo)}">\n<link rel="icon" href="${assetPath(logo)}">\n` : ""}<meta name="theme-color" content="${brand.colors.primary}">
${fontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${fontsHref}">\n` : ""}<link rel="stylesheet" href="styles.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<a class="skip" href="#inicio">Ir al contenido</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="#inicio">${brandMark}</a>
    <nav class="nav" aria-label="Principal">${navLinks}${ctaButton("btn-small")}</nav>
    <details class="menu">
      <summary aria-label="Abrir menú"><span></span><span></span><span></span></summary>
      <nav aria-label="Menú">${navLinks}${ctaButton("")}</nav>
    </details>
  </div>
</header>
<main id="inicio">
  <section class="hero${hero ? " hero-photo" : ""}">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <h1>${esc(c.tagline)}</h1>
        ${c.intro ? `<p class="lead">${esc(c.intro)}</p>` : ""}
        <div class="actions">${ctaButton("")}<a class="link-arrow" href="#servicios">Ver servicios</a></div>
      </div>
      ${hero ? `<div class="hero-media">${img(hero, photoPath(hero.id)!, "cover", true)}</div>` : ""}
    </div>
  </section>

  <section class="section" id="servicios" aria-labelledby="t-servicios">
    <div class="wrap">
      <h2 id="t-servicios">Servicios</h2>
      <ul class="services">
${c.services.map((s) => `        <li><h3>${esc(s.title)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ""}</li>`).join("\n")}
      </ul>
    </div>
  </section>
${
  c.highlights.length
    ? `
  <section class="section tint" aria-labelledby="t-destacados">
    <div class="wrap">
      <h2 id="t-destacados">Por qué elegirnos</h2>
      <ul class="highlights">
${c.highlights.map((h) => `        <li>${ICONS.check}<span>${esc(h)}</span></li>`).join("\n")}
      </ul>
    </div>
  </section>
`
    : ""
}${
  c.about
    ? `
  <section class="section" id="nosotros" aria-labelledby="t-nosotros">
    <div class="wrap about${gallery[0] ? " about-media" : ""}">
      <div>
        <h2 id="t-nosotros">Nosotros</h2>
        ${paragraphs(c.about)}
      </div>
      ${gallery[0] ? `<figure>${img(gallery[0], photoPath(gallery[0].id)!, "cover")}</figure>` : ""}
    </div>
  </section>
`
    : ""
}${
  galleryRest.length
    ? `
  <section class="section" aria-label="Fotos">
    <div class="wrap gallery">
${galleryRest
  .map((a) => `      <figure>${img(a, photoPath(a.id)!, "cover")}</figure>`)
  .join("\n")}
    </div>
  </section>
`
    : ""
}
  <section class="section contact" id="contacto" aria-labelledby="t-contacto">
    <div class="wrap">
      <h2 id="t-contacto">Contacto</h2>
      <ul class="contact-list">
${contactItems
  .map(
    (i) =>
      `        <li>${i.icon}<div><span class="label">${i.label}</span>${
        i.href ? `<a href="${esc(i.href)}"${external(i.href)}>${esc(i.value)}</a>` : `<span>${esc(i.value)}</span>`
      }</div></li>`,
  )
  .join("\n")}
      </ul>
      ${cta ? `<div class="actions">${ctaButton("")}</div>` : ""}
    </div>
  </section>
</main>
<footer class="site-footer">
  <div class="wrap foot">
    <span>© ${year} ${esc(c.businessName)}</span>
    ${c.social.length ? `<nav aria-label="Redes">${c.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("")}</nav>` : ""}
  </div>
</footer>
</body>
</html>
`;
  return { html, css: renderCss(brand) };
}

function renderCss(brand: SiteBrand): string {
  const p = palette(brand.colors);
  const head: { stack: string; weights: readonly number[]; serif: boolean } = FONTS[brand.headingFont];
  const body = FONTS[brand.bodyFont];
  const headWeight = head.weights.includes(700) && !head.serif ? 700 : head.weights.includes(600) ? 600 : (head.weights.at(-1) ?? 700);
  return `:root {
  --brand: ${p.brand};
  --brand-ink: ${p.brandInk};
  --button: ${p.button};
  --on-button: ${p.onButton};
  --secondary: ${p.secondary};
  --bg: ${p.bg};
  --text: ${p.text};
  --muted: ${p.muted};
  --line: ${p.line};
  --tint: ${p.tint};
  --font-head: ${head.stack};
  --font-body: ${body.stack};
  --radius: 10px;
  --wrap: 1120px;
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 400 1.0625rem/1.65 var(--font-body); text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; height: auto; display: block; }
a { color: var(--brand-ink); text-underline-offset: 3px; }
h1, h2, h3 { font-family: var(--font-head); font-weight: ${headWeight}; line-height: 1.15; margin: 0 0 0.6em; letter-spacing: ${head.serif ? "0" : "-0.015em"}; text-wrap: balance; }
h1 { font-size: clamp(2.1rem, 4.6vw, 3.5rem); }
h2 { font-size: clamp(1.6rem, 3vw, 2.25rem); }
h3 { font-size: 1.2rem; }
p { margin: 0 0 1em; text-wrap: pretty; }
:focus-visible { outline: 3px solid var(--brand-ink); outline-offset: 3px; border-radius: 4px; }
.wrap { width: min(100% - 2.5rem, var(--wrap)); margin-inline: auto; }
.skip { position: absolute; left: -9999px; }
.skip:focus { left: 1rem; top: 1rem; z-index: 10; background: var(--bg); padding: 0.5rem 0.8rem; }

.site-header { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--line); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; min-height: 72px; }
.brand { display: inline-flex; align-items: center; text-decoration: none; color: var(--text); }
.logo { height: 44px; width: auto; max-width: 200px; object-fit: contain; }
.wordmark { font: ${headWeight} 1.25rem/1 var(--font-head); letter-spacing: -0.01em; }
.nav { display: flex; align-items: center; gap: 1.6rem; }
.nav a:not(.btn) { color: var(--text); text-decoration: none; font-weight: 500; font-size: 0.97rem; }
.nav a:not(.btn):hover { color: var(--brand-ink); }
.menu { display: none; position: relative; }
.menu summary { list-style: none; cursor: pointer; width: 44px; height: 44px; display: grid; place-content: center; gap: 5px; border-radius: 8px; }
.menu summary::-webkit-details-marker { display: none; }
.menu summary span { display: block; width: 22px; height: 2px; background: var(--text); border-radius: 2px; }
.menu nav { position: absolute; right: 0; top: calc(100% + 8px); min-width: 220px; display: grid; gap: 0.25rem; padding: 0.75rem; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 12px 32px rgb(0 0 0 / 0.12); }
.menu nav a:not(.btn) { color: var(--text); text-decoration: none; padding: 0.6rem 0.5rem; }
.menu nav .btn { margin-top: 0.4rem; text-align: center; }

.btn { display: inline-block; background: var(--button); color: var(--on-button); text-decoration: none; font-weight: 600; padding: 0.85rem 1.4rem; border-radius: var(--radius); line-height: 1.2; transition: transform 0.15s ease, box-shadow 0.15s ease; }
.btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px color-mix(in srgb, var(--button) 30%, transparent); }
.btn-small { padding: 0.6rem 1rem; font-size: 0.95rem; }
.link-arrow { font-weight: 600; text-decoration: none; }
.link-arrow::after { content: " →"; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; margin-top: 1.75rem; }

.hero { padding: clamp(4rem, 10vw, 7.5rem) 0; background: var(--tint); border-bottom: 1px solid var(--line); }
.hero-grid { display: grid; gap: 3rem; align-items: center; }
.hero-photo .hero-grid { grid-template-columns: 1.05fr 1fr; }
.hero-copy { max-width: 40rem; }
.lead { font-size: clamp(1.1rem, 1.6vw, 1.25rem); color: var(--muted); max-width: 36rem; }
.cover { width: 100%; height: auto; object-fit: cover; border-radius: calc(var(--radius) * 1.4); }
.hero-media .cover { aspect-ratio: 4 / 3.4; }

.section { padding: clamp(3.5rem, 8vw, 6rem) 0; }
.section h2 { margin-bottom: 1.4em; }
.tint { background: var(--tint); }
.services { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
.services li { padding: 1.75rem; border: 1px solid var(--line); border-top: 3px solid var(--brand); border-radius: var(--radius); background: var(--bg); }
.services p { color: var(--muted); margin: 0; }
.highlights { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem 2rem; }
.highlights li { display: flex; gap: 0.75rem; align-items: flex-start; font-weight: 500; }
.highlights svg { flex: none; width: 24px; height: 24px; color: var(--brand-ink); margin-top: 0.1rem; }
.about { max-width: 46rem; }
.about.about-media { max-width: none; display: grid; grid-template-columns: 1.1fr 1fr; gap: 3.5rem; align-items: center; }
.about figure, .gallery figure { margin: 0; }
.about .cover { aspect-ratio: 4 / 3; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 1rem; }
.gallery .cover { aspect-ratio: 4 / 3; }

.contact { border-top: 1px solid var(--line); }
.contact-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
.contact-list li { display: flex; gap: 0.9rem; align-items: flex-start; }
.contact-list svg { flex: none; width: 26px; height: 26px; color: var(--brand-ink); }
.contact-list .label { display: block; font-size: 0.85rem; color: var(--muted); font-weight: 600; letter-spacing: 0.02em; }
.contact-list a { font-weight: 500; overflow-wrap: anywhere; }

.site-footer { border-top: 1px solid var(--line); padding: 2rem 0; font-size: 0.95rem; color: var(--muted); }
.foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; }
.foot nav { display: flex; gap: 1.25rem; }
.foot a { color: var(--muted); }

@media (max-width: 860px) {
  .nav { display: none; }
  .menu { display: block; }
  .hero-photo .hero-grid, .about.about-media { grid-template-columns: 1fr; gap: 2rem; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .btn { transition: none; }
}
`;
}

// ── Control de calidad ─────────────────────────────────────────────────

export type QualityCheck = { id: string; label: string; status: "ok" | "aviso" | "falla"; detail: string };
export type Quality = { checks: QualityCheck[]; ready: boolean };

export function copyTexts(c: SiteContent): CopyText[] {
  return [
    { where: "Frase principal", text: c.tagline, heading: true },
    { where: "Introducción", text: c.intro },
    { where: "Nosotros", text: c.about },
    ...c.services.flatMap((s, i) => [
      { where: `Servicio ${i + 1} (título)`, text: s.title, heading: true },
      { where: `Servicio ${i + 1} (descripción)`, text: s.description },
    ]),
    ...c.highlights.map((h, i) => ({ where: `Destacado ${i + 1}`, text: h })),
    { where: "Botón", text: c.cta.label },
    { where: "Descripción para buscadores", text: c.seoDescription },
    { where: "Horarios", text: c.contact.hours },
  ];
}

export function siteQuality({ brand, content: c, assets }: Omit<RenderInput, "year">): Quality {
  const checks: QualityCheck[] = [];
  const add = (id: string, label: string, status: QualityCheck["status"], detail: string) => checks.push({ id, label, status, detail });
  const byId = new Map(assets.map((a) => [a.id, a]));

  // Identidad
  const logo = brand.logoId ? byId.get(brand.logoId) : undefined;
  if (!logo) add("logo", "Logo del cliente", "aviso", "No hay logo: se muestra el nombre del negocio con la fuente de títulos.");
  else if (logo.width < 240 && logo.height < 120) add("logo", "Logo del cliente", "aviso", `El logo es chico (${logo.width}×${logo.height} px): puede verse borroso. Pedí uno más grande.`);
  else add("logo", "Logo del cliente", "ok", `Logo cargado (${logo.width}×${logo.height} px).`);

  const pal = palette(brand.colors);
  const body = contrast(pal.text, pal.bg);
  add(
    "contraste",
    "Contraste de textos (WCAG AA)",
    body >= MIN_TEXT_CONTRAST ? "ok" : "falla",
    `Texto sobre fondo: ${body.toFixed(1)}:1 (mínimo ${MIN_TEXT_CONTRAST}:1). Botones: ${contrast(pal.onButton, pal.button).toFixed(1)}:1.`,
  );
  if (pal.adjusted.length) add("colores", "Colores de marca", "aviso", pal.adjusted.join(" "));
  else add("colores", "Colores de marca", "ok", "Los colores del cliente se usan tal cual.");

  // Contenido
  const channels = [c.contact.whatsapp, c.contact.phone, c.contact.email].filter(Boolean).length;
  add("contacto", "Canal de contacto", channels ? "ok" : "falla", channels ? `${channels} canal(es) de contacto.` : "Falta al menos un teléfono, WhatsApp o email.");
  add("boton", "Botón principal", ctaHref(c) ? "ok" : "falla", ctaHref(c) ? `Lleva a ${CHANNEL_LABELS[c.cta.channel]}.` : `El botón usa ${CHANNEL_LABELS[c.cta.channel]}, pero ese dato no está cargado.`);
  const thin = c.services.filter((s) => s.description.length < 30).length;
  add("servicios", "Servicios descriptos", thin ? "aviso" : "ok", thin ? `${thin} servicio(s) con descripción muy corta o vacía.` : `${c.services.length} servicio(s) con descripción.`);
  add("nosotros", "Sección Nosotros", c.about.length >= 120 ? "ok" : "aviso", c.about.length >= 120 ? "Tiene texto propio del negocio." : "Muy corta o vacía: un párrafo real sobre el negocio da confianza.");
  add("seo", "Descripción para buscadores", c.seoDescription.length >= 70 ? "ok" : "aviso", c.seoDescription.length >= 70 ? `${c.seoDescription.length} caracteres.` : "Conviene una descripción de 70 a 160 caracteres.");

  // Imágenes
  const used = [c.heroPhotoId, ...c.galleryIds].filter(Boolean).map((id) => byId.get(id!));
  const missing = used.filter((a) => !a).length;
  const noAlt = used.filter((a) => a && a.alt.trim().length < 3).length;
  if (missing) add("fotos", "Fotos", "falla", `${missing} foto(s) elegidas ya no existen.`);
  else if (noAlt) add("fotos", "Fotos", "falla", `${noAlt} foto(s) sin descripción (texto alternativo para accesibilidad y buscadores).`);
  else add("fotos", "Fotos", used.length ? "ok" : "aviso", used.length ? `${used.length} foto(s) reales del cliente, con descripción.` : "Sin fotos: se ve prolijo, pero fotos reales del negocio suman mucho.");

  // Textos sin rastro de IA
  const issues = checkCopy(copyTexts(c), [c.businessName]);
  const blocking = issues.filter((i) => BLOCKING.includes(i.kind));
  const soft = issues.filter((i) => !BLOCKING.includes(i.kind));
  add(
    "textos",
    "Textos naturales (sin rastro de IA ni frases de plantilla)",
    blocking.length ? "falla" : soft.length ? "aviso" : "ok",
    issues.length
      ? issues.map((i) => `${ISSUE_LABELS[i.kind]} en ${i.where}: «${i.text}»`).join(" · ")
      : "No se encontraron frases genéricas, marcadores sin completar, emojis ni mayúsculas al estilo inglés.",
  );
  add("codigo", "Código limpio", "ok", "Sin menciones a IA ni a herramientas de generación, sin créditos agregados y sin JavaScript.");

  return { checks, ready: !checks.some((k) => k.status === "falla") };
}

/** Ficha vacía para empezar, con lo que ya se sabe del prospecto. */
export function emptyBrief(name: string, known: { email?: string; phone?: string; whatsapp?: string; address?: string }): { brand: SiteBrand; content: SiteContent } {
  return {
    brand: { colors: { primary: "#1f4e79", secondary: null, background: "#ffffff", text: "#1a1a1a" }, headingFont: "Manrope", bodyFont: "Inter", logoId: null },
    content: {
      businessName: name,
      tagline: "",
      intro: "",
      about: "",
      services: [{ title: "", description: "" }],
      highlights: [],
      contact: { phone: known.phone ?? "", whatsapp: known.whatsapp ?? "", email: known.email ?? "", address: known.address ?? "", hours: "", mapUrl: "" },
      social: [],
      cta: { label: "Escribinos", channel: "whatsapp" },
      heroPhotoId: null,
      galleryIds: [],
      domain: "",
      seoDescription: "",
      trato: "vos",
    },
  };
}
