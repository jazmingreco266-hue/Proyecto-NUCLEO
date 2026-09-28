/**
 * Auditoría técnica objetiva de un sitio, sin IA.
 *
 * Solo puntúa lo que se puede medir en el HTML y en la respuesta del servidor.
 * Las categorías que requieren criterio humano (diseño, claridad comercial, calidad del
 * contenido, potencial de automatización) quedan como "no evaluadas": nunca se inventa un número.
 *
 * Los textos de problemas describen hechos observables, sin lenguaje despectivo
 * sobre el trabajo actual de la empresa.
 */
import { parse, type HTMLElement } from "node-html-parser";

export const AUDIT_TOOL = "nucleo-auditoria-tecnica/1";

// ─────────────────────────── Categorías ───────────────────────────

export const AUDIT_CATEGORIES = [
  { key: "diseno", label: "Diseño y percepción profesional", auto: false },
  { key: "movil", label: "Experiencia móvil", auto: true },
  { key: "velocidad", label: "Velocidad", auto: true },
  { key: "claridad", label: "Claridad comercial", auto: false },
  { key: "navegacion", label: "Navegación", auto: true },
  { key: "accesibilidad", label: "Accesibilidad", auto: true },
  { key: "seo", label: "SEO técnico", auto: true },
  { key: "seguridad", label: "Seguridad visible", auto: true },
  { key: "conversion", label: "Conversión y contacto", auto: true },
  { key: "contenido", label: "Calidad de contenido", auto: false },
  { key: "actualizacion", label: "Actualización", auto: true },
  { key: "integraciones", label: "Integraciones", auto: true },
  { key: "automatizacion", label: "Potencial de automatización", auto: false },
] as const;

export type CategoryKey = (typeof AUDIT_CATEGORIES)[number]["key"];

export const NOT_AUTOMATIC_REASON =
  "No evaluado automáticamente: requiere criterio humano o del agente de investigación con IA.";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type Check = {
  id: string;
  category: CategoryKey;
  label: string;
  status: CheckStatus;
  /** Qué se observó, con números concretos cuando los hay. */
  detail: string;
  /** Importancia relativa dentro de la categoría (1 a 3). */
  weight: 1 | 2 | 3;
  /** Texto neutral para la lista de problemas, si el resultado es warn o fail. */
  issue?: string;
  /** Texto para la lista de fortalezas, si el resultado es pass. */
  strength?: string;
};

export type CategoryResult = { score: number | null; measured: boolean; note: string };

export type ExtractedContact = { field: string; value: string };
export type ExtractedTech = { field: string; value: string };

export type LinkCheck = { url: string; status: number | null; error?: string };

export type AuditInput = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  ms: number;
  bytes: number;
  truncated: boolean;
  robotsSitemaps: string[];
  links?: LinkCheck[];
  now: Date;
};

export type AuditResult = {
  checks: Check[];
  categories: Record<CategoryKey, CategoryResult>;
  siteScore: number | null;
  issues: string[];
  strengths: string[];
  contacts: ExtractedContact[];
  tech: ExtractedTech[];
};

// ─────────────────────────── Utilidades ───────────────────────────

const attr = (el: HTMLElement, name: string) => el.getAttribute(name)?.trim() ?? "";

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

const FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|avi|mov)(\?|$)/i;

/** Enlaces internos http(s) únicos, sin anclas ni archivos, para verificar si responden. */
export function extractInternalLinks(html: string, baseUrl: string, max = 10): string[] {
  const root = parse(html);
  const base = hostOf(baseUrl);
  const self = baseUrl.replace(/#.*$/, "");
  const out = new Set<string>();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = attr(a, "href");
    if (!href || /^(mailto|tel|javascript|data|whatsapp|sms):/i.test(href) || href.startsWith("#")) continue;
    let u: URL;
    try {
      u = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || hostOf(u.href) !== base || FILE_EXT.test(u.pathname)) continue;
    u.hash = "";
    if (u.href === self) continue;
    out.add(u.href);
    if (out.size >= max) break;
  }
  return [...out];
}

// ─────────────────────────── Contactos y tecnología ───────────────────────────

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const IMG_LIKE = /\.(png|jpe?g|gif|webp|svg)$/i;

const SOCIAL: { field: string; re: RegExp }[] = [
  { field: "Instagram", re: /^https?:\/\/(www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|share)([A-Za-z0-9_.]+)\/?/i },
  { field: "Facebook", re: /^https?:\/\/(www\.|m\.|es-la\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)([^?#]+)/i },
  // Solo páginas de empresa: los perfiles personales (/in/) no se recolectan.
  { field: "LinkedIn", re: /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/company\/([^/?#]+)/i },
  { field: "X / Twitter", re: /^https?:\/\/(www\.)?(twitter|x)\.com\/(?!intent|share|home)([A-Za-z0-9_]+)\/?$/i },
  { field: "YouTube", re: /^https?:\/\/(www\.)?youtube\.com\/(@|c\/|channel\/|user\/)[^?#]+/i },
  { field: "TikTok", re: /^https?:\/\/(www\.)?tiktok\.com\/@[^?#/]+/i },
];

function extractContacts(root: HTMLElement, text: string): ExtractedContact[] {
  const out: ExtractedContact[] = [];
  const seen = new Set<string>();
  const add = (field: string, value: string) => {
    const k = `${field}|${value.toLowerCase()}`;
    if (!value || seen.has(k)) return;
    seen.add(k);
    out.push({ field, value });
  };

  for (const a of root.querySelectorAll("a[href]")) {
    const href = attr(a, "href");
    if (/^mailto:/i.test(href)) {
      const email = decodeURIComponent(href.slice(7).split("?")[0] ?? "").trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) add("Email", email);
    } else if (/^tel:/i.test(href)) {
      const tel = decodeURIComponent(href.slice(4)).replace(/[^\d+]/g, "");
      if (tel.replace(/\D/g, "").length >= 6) add("Teléfono", tel);
    } else {
      const wa =
        /^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send)\/?(?:\?phone=)?\+?(\d{6,15})/i.exec(href) ??
        /[?&]phone=\+?(\d{6,15})/i.exec(/whatsapp\.com/i.test(href) ? href : "");
      if (wa) {
        add("WhatsApp", `https://wa.me/${wa[1]}`);
        continue;
      }
      for (const s of SOCIAL) {
        if (s.re.test(href)) {
          add(s.field, href.split(/[?#]/)[0]!.replace(/\/$/, ""));
          break;
        }
      }
    }
  }
  // Emails escritos como texto (hasta 5), descartando nombres de archivos de imagen.
  let n = 0;
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (IMG_LIKE.test(e)) continue;
    add("Email", e);
    if (++n >= 5) break;
  }
  return out;
}

function jqueryVersion(srcs: string[]): string | null {
  for (const s of srcs) {
    const m =
      /jquery[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.slim)?(?:\.min)?\.js/i.exec(s) ??
      /jquery\/(\d+\.\d+(?:\.\d+)?)\//i.exec(s) ??
      /jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i.exec(s);
    if (m) return m[1]!;
  }
  return null;
}

// ─────────────────────────── Auditoría ───────────────────────────

const INPUT_SKIP = new Set(["hidden", "submit", "button", "image", "reset"]);
const CTA_RE =
  /\b(contact|consult|ped[ií]|reserv|compr|cotiz|presupuesto|turno|agend|llam|escrib|whatsapp|solicit|suscrib|inscrib|book|buy|order|quote|call|get started|sign up)/i;
const ANALYTICS_RE = /googletagmanager\.com|google-analytics\.com|gtag\(|fbq\(|plausible\.io|static\.hotjar\.com|clarity\.ms|matomo/i;

export function auditHtml(input: AuditInput): AuditResult {
  const root = parse(input.html, { comment: false });
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const h = input.headers;
  const isHttps = input.finalUrl.startsWith("https:");
  const htmlEl = root.querySelector("html");
  const head = root.querySelector("head") ?? root;
  const text = root.querySelector("body")?.text ?? root.text;
  const scripts = root.querySelectorAll("script");
  const scriptSrcs = scripts.map((s) => attr(s, "src")).filter(Boolean);
  const imgs = root.querySelectorAll("img");
  const anchors = root.querySelectorAll("a[href]");
  const hrefs = anchors.map((a) => attr(a, "href"));
  const year = input.now.getUTCFullYear();

  // ── Respuesta
  add({
    id: "http-status",
    category: "seo",
    label: "La página principal responde correctamente",
    status: input.status === 200 ? "pass" : "fail",
    detail: `Código HTTP ${input.status}.`,
    weight: 3,
    issue: `La página principal respondió con código ${input.status} en lugar de 200.`,
  });

  // ── Seguridad visible
  add({
    id: "https",
    category: "seguridad",
    label: "Conexión segura (HTTPS)",
    status: isHttps ? "pass" : "fail",
    detail: isHttps ? "El sitio se sirve por HTTPS." : "El sitio se sirve por HTTP, sin cifrado.",
    weight: 3,
    issue: "El sitio no usa HTTPS: los navegadores lo muestran como «No seguro».",
    strength: "Usa conexión segura (HTTPS).",
  });
  if (input.requestedUrl.startsWith("http:") && isHttps) {
    add({
      id: "https-redirect",
      category: "seguridad",
      label: "Redirige de HTTP a HTTPS",
      status: "pass",
      detail: "Quien entra por http:// es llevado a https://.",
      weight: 1,
    });
  }
  if (isHttps) {
    add({
      id: "hsts",
      category: "seguridad",
      label: "Política HSTS",
      status: h["strict-transport-security"] ? "pass" : "warn",
      detail: h["strict-transport-security"] ? "Presente." : "No se envía el encabezado Strict-Transport-Security.",
      weight: 1,
      issue: "No envía la política HSTS, que obliga al navegador a usar siempre HTTPS.",
    });
    const mixed = root
      .querySelectorAll("script[src], iframe[src], img[src], link[rel=stylesheet][href], source[src]")
      .filter((el) => /^http:\/\//i.test(attr(el, "src") || attr(el, "href")));
    const activeMixed = mixed.filter((el) => ["script", "iframe", "link"].includes(el.tagName.toLowerCase()));
    add({
      id: "mixed-content",
      category: "seguridad",
      label: "Sin contenido mixto (recursos por HTTP dentro de HTTPS)",
      status: mixed.length === 0 ? "pass" : activeMixed.length ? "fail" : "warn",
      detail: mixed.length === 0 ? "Todos los recursos se cargan por HTTPS." : `${plural(mixed.length, "recurso se carga", "recursos se cargan")} por HTTP.`,
      weight: 2,
      issue: "Algunos recursos se cargan sin cifrar dentro de una página segura; el navegador puede bloquearlos.",
    });
  }
  const secHeaders = ["x-content-type-options", "content-security-policy", "x-frame-options"].filter((k) => !h[k]);
  add({
    id: "security-headers",
    category: "seguridad",
    label: "Encabezados de seguridad básicos",
    status: secHeaders.length === 0 ? "pass" : secHeaders.length === 3 ? "warn" : "pass",
    detail: secHeaders.length ? `Faltan: ${secHeaders.join(", ")}.` : "Presentes.",
    weight: 1,
    issue: "No envía encabezados de seguridad básicos del navegador.",
  });

  // ── Experiencia móvil
  const viewport = head.querySelector("meta[name=viewport]");
  const vp = viewport ? attr(viewport, "content").toLowerCase() : "";
  add({
    id: "viewport",
    category: "movil",
    label: "Declara adaptación a celulares (meta viewport)",
    status: vp.includes("width=device-width") ? "pass" : "fail",
    detail: vp ? `viewport: "${vp}"` : "No tiene la etiqueta meta viewport.",
    weight: 3,
    issue: "No declara adaptación a celulares: en el teléfono la página se ve como la de escritorio, achicada.",
    strength: "Declara adaptación a pantallas de celular.",
  });
  const maxScale = /maximum-scale\s*=\s*([\d.]+)/.exec(vp)?.[1];
  const zoomBlocked = /user-scalable\s*=\s*(no|0)/.test(vp) || (maxScale != null && Number(maxScale) < 2);
  if (viewport) {
    add({
      id: "zoom",
      category: "movil",
      label: "Permite hacer zoom",
      status: zoomBlocked ? "warn" : "pass",
      detail: zoomBlocked ? "El viewport impide ampliar la página." : "No bloquea el zoom.",
      weight: 1,
      issue: "Impide ampliar la página con los dedos, algo que muchas personas necesitan para leer.",
    });
  }
  const flash = root.querySelectorAll("object, embed").some((el) => /\.swf|shockwave/i.test(el.outerHTML));
  const fixedWidth = root
    .querySelectorAll("table[width], body[width], div[style], table[style]")
    .some((el) => Number(attr(el, "width")) >= 700 || /(^|;)\s*width\s*:\s*(7\d\d|[89]\d\d|\d{4,})px/i.test(attr(el, "style")));
  add({
    id: "fixed-width",
    category: "movil",
    label: "Sin anchos fijos grandes en el HTML",
    status: fixedWidth ? "warn" : "pass",
    detail: fixedWidth ? "Hay tablas o bloques con ancho fijo de 700 px o más." : "No se encontraron anchos fijos grandes en el HTML.",
    weight: 1,
    issue: "Usa anchos fijos en píxeles, un indicio de diseño que no se adapta a pantallas chicas.",
  });

  // ── Velocidad (una sola medición desde el servidor de Núcleo)
  add({
    id: "response-time",
    category: "velocidad",
    label: "Tiempo de descarga del HTML",
    status: input.ms < 1000 ? "pass" : input.ms < 2500 ? "warn" : "fail",
    detail: `${input.ms} ms en una sola medición desde el servidor de Núcleo (no reemplaza una prueba de Core Web Vitals).`,
    weight: 2,
    issue: `La página tardó ${(input.ms / 1000).toFixed(1)} s en descargarse en nuestra medición.`,
    strength: "El servidor respondió rápido en nuestra medición.",
  });
  add({
    id: "html-size",
    category: "velocidad",
    label: "Peso del HTML",
    status: input.bytes < 150 * 1024 ? "pass" : input.bytes < 400 * 1024 ? "warn" : "fail",
    detail: `${kb(input.bytes)}${input.truncated ? " (se leyó hasta el tope; el total es mayor)" : ""}.`,
    weight: 1,
    issue: `El HTML de la página principal pesa ${kb(input.bytes)}${input.truncated ? " o más" : ""}.`,
  });
  if (input.bytes > 10 * 1024) {
    const enc = h["content-encoding"];
    add({
      id: "compression",
      category: "velocidad",
      label: "Compresión de la respuesta",
      status: enc ? "pass" : "warn",
      detail: enc ? `Comprimido con ${enc}.` : "El servidor no comprime el HTML.",
      weight: 1,
      issue: "El servidor envía el HTML sin comprimir.",
    });
  }
  const blocking = head.querySelectorAll("script[src]").filter((s) => !s.hasAttribute("async") && !s.hasAttribute("defer") && attr(s, "type") !== "module");
  add({
    id: "blocking-scripts",
    category: "velocidad",
    label: "Scripts que bloquean la carga",
    status: blocking.length <= 3 ? "pass" : blocking.length <= 8 ? "warn" : "fail",
    detail: `${plural(blocking.length, "script externo", "scripts externos")} en <head> sin async ni defer; ${plural(scriptSrcs.length, "script externo", "scripts externos")} en total.`,
    weight: 1,
    issue: `Hay ${blocking.length} scripts que frenan la primera vista de la página.`,
  });
  if (imgs.length >= 3) {
    const noDims = imgs.filter((i) => !i.hasAttribute("width") || !i.hasAttribute("height")).length;
    add({
      id: "img-dimensions",
      category: "velocidad",
      label: "Imágenes con dimensiones declaradas",
      status: noDims / imgs.length <= 0.5 ? "pass" : "warn",
      detail: `${noDims} de ${imgs.length} imágenes no declaran ancho y alto.`,
      weight: 1,
      issue: "Muchas imágenes no declaran su tamaño, lo que hace saltar el contenido mientras carga.",
    });
  }
  if (imgs.length >= 6) {
    const lazy = imgs.filter((i) => attr(i, "loading").toLowerCase() === "lazy").length;
    add({
      id: "lazy-images",
      category: "velocidad",
      label: "Carga diferida de imágenes",
      status: lazy > 0 ? "pass" : "warn",
      detail: `${lazy} de ${imgs.length} imágenes usan loading="lazy".`,
      weight: 1,
      issue: "Todas las imágenes se descargan de entrada, aunque no estén a la vista.",
    });
  }

  // ── SEO técnico
  const title = root.querySelector("title")?.text.trim() ?? "";
  add({
    id: "title",
    category: "seo",
    label: "Título de la página",
    status: !title ? "fail" : title.length < 10 || title.length > 65 ? "warn" : "pass",
    detail: title ? `"${title.slice(0, 120)}" (${title.length} caracteres).` : "No tiene <title>.",
    weight: 2,
    issue: !title ? "La página no tiene título para buscadores." : "El título de la página es demasiado corto o largo para mostrarse bien en Google.",
  });
  const desc = attr(head.querySelector("meta[name=description]") ?? parse("<i></i>"), "content");
  add({
    id: "meta-description",
    category: "seo",
    label: "Meta descripción",
    status: !desc ? "warn" : desc.length < 50 || desc.length > 170 ? "warn" : "pass",
    detail: desc ? `${desc.length} caracteres.` : "No tiene meta descripción.",
    weight: 2,
    issue: !desc ? "No tiene descripción para los resultados de búsqueda." : "La descripción para buscadores es demasiado corta o larga.",
  });
  const h1 = root.querySelectorAll("h1").length;
  add({
    id: "h1",
    category: "seo",
    label: "Un título principal (H1)",
    status: h1 === 1 ? "pass" : "warn",
    detail: `${plural(h1, "encabezado H1", "encabezados H1")}.`,
    weight: 1,
    issue: h1 === 0 ? "La página no tiene un título principal (H1)." : "La página tiene varios títulos principales (H1).",
  });
  add({
    id: "canonical",
    category: "seo",
    label: "URL canónica",
    status: head.querySelector("link[rel=canonical]") ? "pass" : "warn",
    detail: head.querySelector("link[rel=canonical]") ? "Declarada." : "No declara URL canónica.",
    weight: 1,
    issue: "No declara la URL canónica, lo que puede generar contenido duplicado en buscadores.",
  });
  const robotsMeta = attr(head.querySelector("meta[name=robots]") ?? parse("<i></i>"), "content").toLowerCase();
  const xRobots = (h["x-robots-tag"] ?? "").toLowerCase();
  const noindex = robotsMeta.includes("noindex") || xRobots.includes("noindex");
  add({
    id: "indexable",
    category: "seo",
    label: "Indexable por buscadores",
    status: noindex ? "fail" : "pass",
    detail: noindex ? "La página pide no ser indexada (noindex)." : "No pide exclusión de buscadores.",
    weight: 2,
    issue: "La página principal pide no aparecer en buscadores (noindex).",
  });
  const og = head.querySelector("meta[property='og:title']") && head.querySelector("meta[property='og:image']");
  add({
    id: "open-graph",
    category: "seo",
    label: "Vista previa al compartir (Open Graph)",
    status: og ? "pass" : "warn",
    detail: og ? "Tiene og:title y og:image." : "Falta og:title u og:image.",
    weight: 1,
    issue: "Al compartir el enlace por WhatsApp o redes no aparece una vista previa con imagen.",
  });
  const structured = root.querySelectorAll("script[type='application/ld+json']").length > 0 || root.querySelector("[itemscope]") != null;
  add({
    id: "structured-data",
    category: "seo",
    label: "Datos estructurados",
    status: structured ? "pass" : "warn",
    detail: structured ? "Tiene datos estructurados." : "No se encontraron datos estructurados (JSON-LD o microdatos).",
    weight: 1,
    issue: "No tiene datos estructurados que ayuden a Google a entender el negocio (dirección, horarios, rubro).",
  });
  add({
    id: "sitemap",
    category: "seo",
    label: "Sitemap declarado",
    status: input.robotsSitemaps.length ? "pass" : "info",
    detail: input.robotsSitemaps.length
      ? `Declarado en robots.txt: ${input.robotsSitemaps[0]}`
      : "No se declara en robots.txt (puede existir igual; no se verificó).",
    weight: 1,
  });

  // ── Accesibilidad
  const lang = htmlEl ? attr(htmlEl, "lang") : "";
  add({
    id: "lang",
    category: "accesibilidad",
    label: "Idioma declarado",
    status: lang ? "pass" : "fail",
    detail: lang ? `lang="${lang}"` : "No declara el idioma de la página.",
    weight: 2,
    issue: "No declara el idioma, así que los lectores de pantalla pueden pronunciar mal el contenido.",
  });
  if (imgs.length) {
    const noAlt = imgs.filter((i) => !i.hasAttribute("alt")).length;
    add({
      id: "img-alt",
      category: "accesibilidad",
      label: "Imágenes con texto alternativo",
      status: noAlt === 0 ? "pass" : noAlt / imgs.length <= 0.2 ? "warn" : "fail",
      detail: `${noAlt} de ${imgs.length} imágenes no tienen atributo alt.`,
      weight: 2,
      issue: `${noAlt} de ${imgs.length} imágenes no tienen texto alternativo para lectores de pantalla ni para Google.`,
      strength: "Las imágenes tienen texto alternativo.",
    });
  }
  const labelFor = new Set(root.querySelectorAll("label[for]").map((l) => attr(l, "for")));
  const fields = root
    .querySelectorAll("input, select, textarea")
    .filter((el) => !INPUT_SKIP.has(attr(el, "type").toLowerCase()));
  if (fields.length) {
    const unlabeled = fields.filter((el) => {
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return false;
      const id = attr(el, "id");
      if (id && labelFor.has(id)) return false;
      let p = el.parentNode as HTMLElement | null;
      while (p) {
        if (p.tagName?.toLowerCase() === "label") return false;
        p = p.parentNode as HTMLElement | null;
      }
      return true;
    }).length;
    add({
      id: "form-labels",
      category: "accesibilidad",
      label: "Campos de formulario con etiqueta",
      status: unlabeled === 0 ? "pass" : unlabeled < fields.length ? "warn" : "fail",
      detail: `${unlabeled} de ${fields.length} campos sin etiqueta asociada.`,
      weight: 2,
      issue: "Hay campos de formulario sin etiqueta: con lector de pantalla no se sabe qué completar.",
    });
  }
  const emptyLinks = anchors.filter(
    (a) => !a.text.trim() && !a.getAttribute("aria-label") && !a.getAttribute("title") && !a.querySelectorAll("img[alt]").some((i) => attr(i, "alt")),
  ).length;
  add({
    id: "empty-links",
    category: "accesibilidad",
    label: "Enlaces con texto",
    status: emptyLinks === 0 ? "pass" : "warn",
    detail: `${plural(emptyLinks, "enlace sin texto", "enlaces sin texto")} ni descripción.`,
    weight: 1,
    issue: "Hay enlaces sin texto ni descripción (por ejemplo, íconos sin nombre).",
  });
  if (viewport && zoomBlocked) {
    add({
      id: "zoom-a11y",
      category: "accesibilidad",
      label: "No bloquea la ampliación",
      status: "fail",
      detail: "El viewport impide hacer zoom.",
      weight: 1,
      issue: "Bloquear el zoom dificulta la lectura a personas con baja visión.",
    });
  }

  // ── Conversión y contacto
  const contacts = extractContacts(root, text);
  const hasTel = hrefs.some((x) => /^tel:/i.test(x));
  const hasMail = contacts.some((c) => c.field === "Email");
  const hasWa = contacts.some((c) => c.field === "WhatsApp");
  const forms = root.querySelectorAll("form").filter((f) => f.querySelectorAll("input, textarea").some((el) => !INPUT_SKIP.has(attr(el, "type").toLowerCase())));
  const direct = hasTel || hasMail || hasWa || forms.length > 0;
  add({
    id: "contact-channel",
    category: "conversion",
    label: "Medio de contacto directo en la página principal",
    status: direct ? "pass" : "fail",
    detail: [hasTel && "teléfono", hasMail && "email", hasWa && "WhatsApp", forms.length && "formulario"].filter(Boolean).join(", ") || "Ninguno encontrado.",
    weight: 3,
    issue: "La página principal no muestra un medio de contacto directo (teléfono, email, WhatsApp o formulario).",
    strength: "La página principal ofrece un medio de contacto directo.",
  });
  add({
    id: "tel-link",
    category: "conversion",
    label: "Teléfono que se puede tocar para llamar",
    status: hasTel ? "pass" : "warn",
    detail: hasTel ? "Tiene enlace tel:." : "No hay enlace tel:.",
    weight: 1,
    issue: "El teléfono no se puede tocar para llamar desde el celular.",
  });
  add({
    id: "whatsapp",
    category: "conversion",
    label: "Acceso directo a WhatsApp",
    status: hasWa ? "pass" : "warn",
    detail: hasWa ? "Tiene enlace a WhatsApp." : "No hay enlace a WhatsApp.",
    weight: 1,
    issue: "No ofrece un botón para escribir por WhatsApp.",
    strength: "Ofrece contacto directo por WhatsApp.",
  });
  const ctaTexts = root
    .querySelectorAll("a, button, input[type=submit]")
    .map((el) => (el.text || attr(el, "value") || attr(el, "aria-label")).trim())
    .filter((t) => t && t.length <= 60 && CTA_RE.test(t));
  add({
    id: "cta",
    category: "conversion",
    label: "Llamados a la acción",
    status: ctaTexts.length ? "pass" : "warn",
    detail: ctaTexts.length ? `Ejemplos: ${[...new Set(ctaTexts)].slice(0, 3).map((t) => `«${t}»`).join(", ")}.` : "No se detectaron botones o enlaces de acción.",
    weight: 2,
    issue: "No se detectaron llamados a la acción claros (como «Pedir presupuesto» o «Reservar»).",
    strength: "Tiene llamados a la acción visibles.",
  });

  // ── Actualización
  const yearHits = [...text.matchAll(/(?:©|&copy;|copyright|derechos reservados)[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .flatMap((m) => [m[1], m[2]])
    .filter(Boolean)
    .map(Number)
    .filter((y) => y <= year);
  if (yearHits.length) {
    const latest = Math.max(...yearHits);
    add({
      id: "copyright-year",
      category: "actualizacion",
      label: "Año visible en el pie de página",
      status: latest >= year - 1 ? "pass" : latest >= year - 4 ? "warn" : "fail",
      detail: `El año más reciente junto al © es ${latest}.`,
      weight: 2,
      issue: `El pie de página muestra el año ${latest}, lo que puede dar la impresión de un sitio sin actualizar.`,
    });
  } else {
    add({ id: "copyright-year", category: "actualizacion", label: "Año visible en el pie de página", status: "info", detail: "No se encontró un año junto a ©.", weight: 1 });
  }
  const jq = jqueryVersion(scriptSrcs);
  if (jq) {
    const major = Number(jq.split(".")[0]);
    add({
      id: "jquery",
      category: "actualizacion",
      label: "Versión de jQuery",
      status: major >= 3 ? "pass" : "warn",
      detail: `jQuery ${jq}.`,
      weight: 1,
      issue: `Usa jQuery ${jq}, una rama antigua que ya no recibe mantenimiento.`,
    });
  }
  add({
    id: "flash",
    category: "actualizacion",
    label: "Sin Flash",
    status: flash ? "fail" : "pass",
    detail: flash ? "La página incluye contenido Flash (.swf)." : "No usa Flash.",
    weight: 2,
    issue: "Incluye contenido Flash, que los navegadores actuales ya no muestran.",
  });
  const obsolete = ["font", "center", "marquee", "frameset", "frame", "blink"].filter((t) => root.querySelector(t));
  add({
    id: "obsolete-tags",
    category: "actualizacion",
    label: "Sin etiquetas HTML obsoletas",
    status: obsolete.length ? "warn" : "pass",
    detail: obsolete.length ? `Usa: ${obsolete.map((t) => `<${t}>`).join(", ")}.` : "No se encontraron.",
    weight: 1,
    issue: "Usa etiquetas HTML obsoletas, propias de sitios construidos hace muchos años.",
  });

  // ── Integraciones
  const analytics = ANALYTICS_RE.test(input.html);
  add({
    id: "analytics",
    category: "integraciones",
    label: "Herramienta de analítica",
    status: analytics ? "pass" : "warn",
    detail: analytics ? "Se detectó una herramienta de medición de visitas." : "No se detectó en el HTML (podría cargarse de otra forma).",
    weight: 1,
    issue: "No se detectó una herramienta para medir visitas y consultas.",
  });
  const socials = contacts.filter((c) => SOCIAL.some((s) => s.field === c.field));
  add({
    id: "social",
    category: "integraciones",
    label: "Enlaces a redes sociales",
    status: socials.length ? "pass" : "warn",
    detail: socials.length ? socials.map((s) => s.field).join(", ") + "." : "No hay enlaces a perfiles de redes.",
    weight: 1,
    issue: "No enlaza a sus redes sociales.",
  });
  const maps = root.querySelectorAll("iframe[src]").some((f) => /google\.[a-z.]+\/maps|maps\.google/i.test(attr(f, "src")));
  add({ id: "maps", category: "integraciones", label: "Mapa integrado", status: "info", detail: maps ? "Tiene un mapa integrado." : "No tiene mapa integrado.", weight: 1 });

  // ── Navegación
  const base = hostOf(input.finalUrl);
  const internal = hrefs.filter((x) => {
    if (!x || x.startsWith("#") || /^(mailto|tel|javascript):/i.test(x)) return false;
    try {
      return hostOf(new URL(x, input.finalUrl).href) === base;
    } catch {
      return false;
    }
  });
  add({
    id: "internal-links",
    category: "navegacion",
    label: "Menú o enlaces internos",
    status: internal.length >= 3 ? "pass" : "warn",
    detail: `${plural(internal.length, "enlace interno", "enlaces internos")}${root.querySelector("nav") ? ", con <nav>" : ""}.`,
    weight: 1,
    issue: "La página principal casi no tiene enlaces a otras secciones.",
  });
  if (input.links?.length) {
    const broken = input.links.filter((l) => l.status == null || l.status >= 400);
    add({
      id: "broken-links",
      category: "navegacion",
      label: "Enlaces internos que funcionan",
      status: broken.length === 0 ? "pass" : "fail",
      detail: broken.length
        ? `${broken.length} de ${input.links.length} enlaces revisados fallan: ${broken
            .slice(0, 3)
            .map((b) => `${b.url} (${b.status ?? b.error ?? "sin respuesta"})`)
            .join("; ")}.`
        : `Los ${input.links.length} enlaces internos revisados responden.`,
      weight: 2,
      issue: `${plural(broken.length, "enlace interno lleva", "enlaces internos llevan")} a páginas con error.`,
      strength: "Los enlaces internos revisados funcionan.",
    });
  } else {
    add({ id: "broken-links", category: "navegacion", label: "Enlaces internos que funcionan", status: "info", detail: "No se revisaron enlaces internos.", weight: 1 });
  }

  // ── Tecnología observada
  const tech: ExtractedTech[] = [];
  const generator = attr(head.querySelector("meta[name=generator]") ?? parse("<i></i>"), "content");
  if (generator) tech.push({ field: "Generador declarado", value: generator.slice(0, 200) });
  const html = input.html;
  const platform =
    /\/wp-content\/|\/wp-includes\//i.test(html) ? "WordPress" :
    /static\.wixstatic\.com|wix\.com/i.test(html) ? "Wix" :
    /cdn\.shopify\.com/i.test(html) ? "Shopify" :
    /static1\.squarespace\.com|squarespace\.com/i.test(html) ? "Squarespace" :
    /\/sites\/default\/files\/|drupal\.js/i.test(html) ? "Drupal" :
    /\/media\/jui\/|\/components\/com_/i.test(html) ? "Joomla" :
    null;
  if (platform) tech.push({ field: "Plataforma", value: `${platform} (detectado en el código de la página)` });
  if (jq) tech.push({ field: "jQuery", value: jq });

  // ── Puntajes
  const value = { pass: 1, warn: 0.5, fail: 0 } as const;
  const categories = {} as Record<CategoryKey, CategoryResult>;
  for (const c of AUDIT_CATEGORIES) {
    const scored = checks.filter((k) => k.category === c.key && k.status !== "info");
    if (!c.auto || scored.length === 0) {
      categories[c.key] = { score: null, measured: false, note: c.auto ? "Sin datos suficientes." : NOT_AUTOMATIC_REASON };
      continue;
    }
    const total = scored.reduce((s, k) => s + k.weight, 0);
    const got = scored.reduce((s, k) => s + k.weight * value[k.status as "pass" | "warn" | "fail"], 0);
    categories[c.key] = {
      score: Math.round((100 * got) / total),
      measured: true,
      note: `${plural(scored.length, "verificación", "verificaciones")} automática${scored.length === 1 ? "" : "s"}.`,
    };
  }
  const measured = Object.values(categories).filter((c) => c.score != null).map((c) => c.score!);
  const siteScore = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null;

  const rank = { fail: 0, warn: 1 } as const;
  const issues = checks
    .filter((c) => (c.status === "fail" || c.status === "warn") && c.issue)
    .sort((a, b) => rank[a.status as "fail" | "warn"] - rank[b.status as "fail" | "warn"] || b.weight - a.weight)
    .map((c) => c.issue!);
  const strengths = checks.filter((c) => c.status === "pass" && c.strength).sort((a, b) => b.weight - a.weight).map((c) => c.strength!);

  return { checks, categories, siteScore, issues: [...new Set(issues)], strengths, contacts, tech };
}

// ─────────────────────────── Recomendación preliminar ───────────────────────────

export type Recommendation = {
  action: "contactar" | "observar" | "descartar";
  urgency: "alta" | "media" | "baja";
  reasons: string[];
  preliminary: true;
};

/**
 * Recomendación basada solo en mediciones técnicas. Es preliminar: el esfuerzo,
 * el valor comercial y la capacidad de pago no se estiman acá porque no se pueden medir.
 */
export function recommend(
  r: Pick<AuditResult, "checks" | "siteScore" | "contacts">,
  opts: { skipIfSiteScoreAbove: number; requirePublicContact: boolean },
): Recommendation {
  const reasons: string[] = [];
  const failed = (id: string) => r.checks.some((c) => c.id === id && c.status === "fail");
  const severe = ["https", "viewport", "http-status", "flash", "contact-channel", "broken-links"].filter(failed);
  const urgency = severe.length >= 2 ? "alta" : severe.length === 1 ? "media" : "baja";
  const reachable = r.contacts.some((c) => ["Email", "Teléfono", "WhatsApp"].includes(c.field));

  if (r.siteScore == null) {
    return { action: "observar", urgency, reasons: ["No hubo datos suficientes para puntuar el sitio."], preliminary: true };
  }
  if (r.siteScore > opts.skipIfSiteScoreAbove) {
    reasons.push(
      `El puntaje técnico (${r.siteScore}) supera el umbral de descarte configurado (${opts.skipIfSiteScoreAbove}): el sitio ya cumple bien lo medible.`,
    );
    return { action: "descartar", urgency, reasons, preliminary: true };
  }
  if (opts.requirePublicContact && !reachable) {
    reasons.push("No se encontró un email, teléfono o WhatsApp publicado en la página principal. Buscá otro medio antes de avanzar.");
    return { action: "observar", urgency, reasons, preliminary: true };
  }
  if (r.siteScore < 60 || severe.length > 0) {
    reasons.push(`Puntaje técnico ${r.siteScore}/100${severe.length ? ` y ${plural(severe.length, "problema importante", "problemas importantes")}` : ""}.`);
    if (reachable) reasons.push("Tiene un medio de contacto público.");
    return { action: "contactar", urgency, reasons, preliminary: true };
  }
  reasons.push(`Puntaje técnico ${r.siteScore}/100: hay mejoras posibles pero no urgentes.`);
  return { action: "observar", urgency, reasons, preliminary: true };
}
