/**
 * Demo conceptual: contenido, borrador a partir de datos reales y plantilla HTML.
 *
 * Reglas (sección F del documento maestro):
 * - Solo usa datos cargados en la ficha (cada uno con su fuente) o textos que escribe una persona.
 * - Testimonios solo si son públicos y tienen URL de origen. Nunca se inventan.
 * - La página lleva noindex, un aviso visible de "propuesta conceptual no oficial",
 *   no tiene scripts, formularios ni recursos externos, y no captura datos.
 */
import { z } from "zod";

// ─────────────────────────── Contenido ───────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;
const text = (max: number) => z.string().trim().max(max);

export const demoContentSchema = z.object({
  businessName: text(120).min(2, "Falta el nombre del negocio"),
  industry: text(120),
  city: text(120),
  headline: text(140).min(3, "Falta el título principal"),
  subheadline: text(400),
  about: text(1500),
  services: z
    .array(z.object({ title: text(80).min(2), text: text(300) }))
    .max(8),
  highlights: z.array(text(160).min(2)).max(6),
  testimonials: z
    .array(
      z.object({
        quote: text(400).min(5),
        author: text(80).min(2),
        sourceUrl: z.string().trim().url("Cada testimonio necesita la URL pública de donde se tomó"),
      }),
    )
    .max(4),
  contact: z.object({
    phone: text(60),
    whatsapp: text(60),
    email: text(254),
    address: text(200),
    hours: text(200),
  }),
  ctaLabel: text(40).min(2),
  colors: z.object({
    primary: z.string().regex(HEX, "Color principal: usá el formato #RRGGBB"),
    accent: z.string().regex(HEX, "Color de acento: usá el formato #RRGGBB"),
  }),
});
export type DemoContent = z.infer<typeof demoContentSchema>;

export const DEFAULT_COLORS = { primary: "#1f3a5f", accent: "#c8872b" };

// ─────────────────────────── Borrador desde datos reales ───────────────────────────

export type FactLike = { category: string; field: string; value: string; kind: string };

const splitList = (v: string) =>
  v
    .split(/\n|;|,(?![^(]*\))| y (?=[A-ZÁÉÍÓÚ])/)
    .map((s) => s.replace(/^[-•·*]\s*/, "").trim())
    .filter((s) => s.length >= 3 && s.length <= 80);

/**
 * Arma un primer borrador con lo que ya se sabe de la empresa. Solo toma hechos observados
 * (con fuente); las inferencias no se usan como texto de la demo. Todo es editable antes de generar.
 */
export function draftDemoContent(
  p: { name: string; industry: string | null; city: string | null },
  facts: FactLike[],
  researchSummary?: string | null,
): DemoContent {
  const observed = facts.filter((f) => f.kind === "observed");
  const find = (re: RegExp, cat?: string) => observed.find((f) => (!cat || f.category === cat) && re.test(f.field))?.value ?? "";

  const services = observed
    .filter((f) => f.category === "business" && /servicio|producto|oferta|especialidad/i.test(f.field))
    .flatMap((f) => splitList(f.value))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6)
    .map((title) => ({ title, text: "" }));

  const highlights = observed
    .filter((f) => f.category === "business" && /diferencial|antig[üu]edad|historia|experiencia|trayectoria|tipo de empresa/i.test(f.field))
    .map((f) => f.value.slice(0, 160))
    .slice(0, 4);

  const hex = observed.filter((f) => f.category === "visual").flatMap((f) => f.value.match(/#[0-9a-f]{6}\b/gi) ?? []);
  const place = [p.industry, p.city ? `en ${p.city}` : ""].filter(Boolean).join(" ");

  return {
    businessName: p.name,
    industry: p.industry ?? "",
    city: p.city ?? "",
    headline: p.name,
    subheadline: (researchSummary?.split(/(?<=\.)\s/)[0] ?? "").slice(0, 400) || (place ? `${place[0]!.toUpperCase()}${place.slice(1)}.` : ""),
    about: "",
    services,
    highlights,
    testimonials: [],
    contact: {
      phone: find(/tel[eé]fono/i, "contact"),
      whatsapp: find(/whatsapp/i, "contact").replace(/^https:\/\/wa\.me\//, "+"),
      email: find(/email|correo/i, "contact"),
      address: find(/direcci[oó]n|domicilio|ubicaci[oó]n/i),
      hours: find(/horario/i),
    },
    ctaLabel: "Consultar",
    colors: { primary: hex[0] ?? DEFAULT_COLORS.primary, accent: hex[1] ?? DEFAULT_COLORS.accent },
  };
}

// ─────────────────────────── Plantilla ───────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Texto legible (blanco o casi negro) sobre un color de fondo, por contraste WCAG. */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? "#ffffff" : "#141414";
}

/** Oscurece un color para usarlo como texto sobre fondo claro con buen contraste. */
function textTone(hex: string): string {
  if (inkOn(hex) === "#ffffff") return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.45).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

export type DemoMeta = { version: number; agencyName: string; createdAt: Date };

export function renderDemoHtml(c: DemoContent, meta: DemoMeta): string {
  const e = escapeHtml;
  const primary = c.colors.primary;
  const accent = c.colors.accent;
  const onPrimary = inkOn(primary);
  const onAccent = inkOn(accent);
  const tone = textTone(primary);
  const initials = c.businessName
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const agency = e(meta.agencyName || "una agencia digital");

  const nav = [
    c.services.length ? `<a href="#servicios">Servicios</a>` : "",
    c.about ? `<a href="#nosotros">Nosotros</a>` : "",
    `<a href="#contacto">Contacto</a>`,
  ].join("");

  const services = c.services.length
    ? `<section id="servicios" class="section"><div class="wrap">
        <p class="kicker">Lo que hacemos</p><h2>Servicios</h2>
        <div class="grid">${c.services
          .map(
            (s, i) =>
              `<article class="card"><span class="num">${String(i + 1).padStart(2, "0")}</span><h3>${e(s.title)}</h3>${s.text ? `<p>${e(s.text)}</p>` : ""}</article>`,
          )
          .join("")}</div></div></section>`
    : "";

  const highlights = c.highlights.length
    ? `<section class="section band"><div class="wrap"><p class="kicker">Por qué elegirnos</p><h2>Lo que nos distingue</h2>
        <ul class="checks">${c.highlights.map((h) => `<li>${e(h)}</li>`).join("")}</ul></div></section>`
    : "";

  const about = c.about
    ? `<section id="nosotros" class="section"><div class="wrap narrow"><p class="kicker">Nosotros</p><h2>${e(c.businessName)}</h2>
        ${c.about
          .split(/\n{2,}/)
          .map((para) => `<p class="lead">${e(para)}</p>`)
          .join("")}</div></section>`
    : "";

  const testimonials = c.testimonials.length
    ? `<section class="section band"><div class="wrap"><p class="kicker">Opiniones públicas</p><h2>Lo que dicen sus clientes</h2>
        <div class="grid">${c.testimonials
          .map((t) => `<figure class="card quote"><blockquote>“${e(t.quote)}”</blockquote><figcaption>${e(t.author)} · <span class="muted">Fuente: ${e(new URL(t.sourceUrl).hostname)}</span></figcaption></figure>`)
          .join("")}</div></div></section>`
    : "";

  const contactRows = [
    ["Teléfono", c.contact.phone],
    ["WhatsApp", c.contact.whatsapp],
    ["Email", c.contact.email],
    ["Dirección", c.contact.address],
    ["Horarios", c.contact.hours],
  ].filter(([, v]) => v);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<title>${e(c.businessName)} · Propuesta conceptual (no oficial)</title>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{--p:${primary};--on-p:${onPrimary};--a:${accent};--on-a:${onAccent};--tone:${tone};--ink:#161616;--muted:#5b5b57;--line:#e7e5e0;--bg:#fbfaf7}
html{scroll-behavior:smooth}
body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:ui-serif,Georgia,"Times New Roman",serif;font-weight:600;line-height:1.15;margin:0 0 .6rem;letter-spacing:-.01em}
h1{font-size:clamp(2.2rem,5vw,3.8rem)}h2{font-size:clamp(1.6rem,3.2vw,2.4rem)}h3{font-size:1.15rem}
p{margin:0 0 1rem}a{color:inherit}
.wrap{width:min(1120px,100% - 2rem);margin-inline:auto}.narrow{width:min(760px,100% - 2rem)}
.notice{background:#111;color:#f3f3f1;font-size:.82rem;text-align:center;padding:.55rem 1rem}
.notice strong{color:#fff}
header{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:64px}
.brand{display:flex;align-items:center;gap:.65rem;font-weight:700;text-decoration:none}
.logo{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:var(--p);color:var(--on-p);font-size:.9rem;letter-spacing:.02em}
nav{display:flex;gap:1.3rem;font-size:.95rem}nav a{text-decoration:none;color:var(--muted)}nav a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 1.4rem;border-radius:999px;font-weight:600;text-decoration:none;border:2px solid transparent}
.btn-a{background:var(--a);color:var(--on-a)}.btn-o{border-color:currentColor}
.hero{background:var(--p);color:var(--on-p);padding:clamp(4rem,10vw,7.5rem) 0 clamp(3.5rem,8vw,6rem);position:relative;overflow:hidden}
.hero{border-bottom:6px solid var(--a)}
.hero .kicker{color:inherit;opacity:.8}
.hero p.sub{font-size:clamp(1.05rem,2vw,1.3rem);max-width:46ch;opacity:.92}
.actions{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:1.8rem}
.section{padding:clamp(3.5rem,8vw,6rem) 0}.band{background:#fff;border-block:1px solid var(--line)}
.kicker{text-transform:uppercase;letter-spacing:.14em;font-size:.75rem;font-weight:700;color:var(--tone);margin-bottom:.5rem}
.grid{display:grid;gap:1.1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));margin-top:1.8rem}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:1.5rem}
.band .card{background:var(--bg)}
.num{display:inline-block;font-size:.8rem;font-weight:700;color:var(--tone);margin-bottom:.6rem}
.card p{color:var(--muted);margin:0}
.lead{font-size:1.1rem;color:#33332f}
.checks{list-style:none;padding:0;margin:1.6rem 0 0;display:grid;gap:.9rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.checks li{position:relative;padding-left:2rem}
.checks li::before{content:"";position:absolute;left:0;top:.35rem;width:1.1rem;height:1.1rem;border-radius:50%;background:var(--a)}
.quote blockquote{margin:0 0 .8rem;font-size:1.05rem}.quote figcaption{font-size:.9rem;font-weight:600}.muted{color:var(--muted);font-weight:400}
.contact{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:start}
.dl{display:grid;grid-template-columns:auto 1fr;gap:.7rem 1.2rem;margin:0}.dl dt{color:var(--muted)}.dl dd{margin:0;font-weight:600;overflow-wrap:anywhere}
.panel{background:var(--p);color:var(--on-p);border-radius:22px;padding:2rem}
.panel p{opacity:.9}
footer{padding:2.5rem 0;border-top:1px solid var(--line);font-size:.85rem;color:var(--muted)}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem}
@media (max-width:640px){nav{display:none}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
:focus-visible{outline:3px solid var(--a);outline-offset:3px}
</style>
</head>
<body>
<div class="notice" role="note"><strong>Propuesta conceptual no oficial</strong> preparada por ${agency} para ${e(c.businessName)}. No es el sitio de la empresa ni está publicada.</div>
<header><div class="wrap bar">
  <a class="brand" href="#inicio"><span class="logo" aria-hidden="true">${e(initials || "•")}</span><span>${e(c.businessName)}</span></a>
  <nav aria-label="Secciones">${nav}</nav>
</div></header>
<main id="inicio">
<section class="hero"><div class="wrap">
  ${c.industry || c.city ? `<p class="kicker">${e([c.industry, c.city].filter(Boolean).join(" · "))}</p>` : ""}
  <h1>${e(c.headline)}</h1>
  ${c.subheadline ? `<p class="sub">${e(c.subheadline)}</p>` : ""}
  <div class="actions"><a class="btn btn-a" href="#contacto">${e(c.ctaLabel)}</a>${c.services.length ? `<a class="btn btn-o" href="#servicios">Ver servicios</a>` : ""}</div>
</div></section>
${services}
${highlights}
${about}
${testimonials}
<section id="contacto" class="section"><div class="wrap contact">
  <div><p class="kicker">Contacto</p><h2>Hablemos</h2>
    ${contactRows.length ? `<dl class="dl">${contactRows.map(([k, v]) => `<dt>${k}</dt><dd>${e(v!)}</dd>`).join("")}</dl>` : `<p class="muted">Acá irían los datos de contacto de la empresa.</p>`}
  </div>
  <div class="panel"><h3>${e(c.ctaLabel)}</h3><p>En el sitio real, este bloque llevaría un formulario o un botón directo a WhatsApp. En esta propuesta no se envían ni guardan datos.</p></div>
</div></section>
</main>
<footer><div class="wrap"><span>© ${e(c.businessName)}</span><span>Propuesta conceptual v${meta.version} de ${agency}. Contenido tomado de fuentes públicas de la empresa; no es un sitio oficial.</span></div></footer>
</body>
</html>`;
}
