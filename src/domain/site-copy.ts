import { z } from "zod";
import { costUsd } from "./research";

/**
 * Control de calidad de los textos del sitio: detecta lo que delata un texto hecho con IA
 * o sin terminar (frases genéricas, marcadores, emojis, mayúsculas al estilo inglés…).
 *
 * Aplica igual a textos escritos por una persona o por la IA: el sitio sale solo si pasa.
 */

export type CopyIssue = { where: string; kind: "cliche" | "placeholder" | "emoji" | "titlecase" | "exclamation" | "dash" | "ai-mention"; text: string };

/** Frases genéricas típicas de textos hechos con IA o de plantilla. Se comparan sin tildes ni mayúsculas. */
export const CLICHES = [
  "en el mundo actual",
  "en la era digital",
  "en el cambiante mundo",
  "en el dinamico mundo",
  "al siguiente nivel",
  "a otro nivel",
  "soluciones innovadoras",
  "soluciones integrales",
  "de vanguardia",
  "somos apasionados",
  "nos apasiona",
  "no dudes en contactarnos",
  "no dude en contactarnos",
  "no dudes en",
  "tu socio de confianza",
  "su socio de confianza",
  "socio estrategico",
  "sin lugar a dudas",
  "en constante evolucion",
  "sinergia",
  "experiencia unica",
  "experiencias unicas",
  "a la medida de tus necesidades",
  "adaptadas a tus necesidades",
  "adaptados a tus necesidades",
  "comprometidos con la excelencia",
  "compromiso con la excelencia",
  "calidad y compromiso",
  "desbloquea",
  "sumergite",
  "sumergete",
  "descubri el poder",
  "descubre el poder",
  "revolucionar",
  "revolucionamos",
  "de primer nivel",
  "inigualable",
  "sin igual",
  "potencia tu",
  "potencia al maximo",
  "impulsa tu negocio",
  "impulsamos tu",
  "transformamos tu",
  "llevamos tu",
  "mas que un",
  "tu mejor aliado",
  "tu aliado ideal",
  "elevar tu",
  "eleva tu",
  "embarcate",
  "de clase mundial",
  "world-class",
  "cutting-edge",
  "seamless",
  "unlock",
  "elevate",
  "empower",
  "lorem ipsum",
];

// Solo frases que delatan al autor; no palabras sueltas (un cliente puede llamarse Claude o vender IA).
const AI_MENTIONS = /\b(como (un )?modelo de lenguaje|como (una )?ia\b|generad[oa] (con|por) (la )?ia|hech[oa] con (la )?ia|as an ai|language model)/i;
const PLACEHOLDER = /\[[^\]]{1,40}\]|\{\{[^}]*\}\}|\b(pendiente de completar|nombre de la empresa|tu empresa aqu[ií]|texto de ejemplo)\b|lorem/i;
// En mayúsculas y sin /i: "todo" es una palabra común en castellano.
const PLACEHOLDER_CAPS = /\b(TODO|TBD|XXX)\b/;
const EMOJI = /\p{Extended_Pictographic}/u;

export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Título con mayúscula en cada palabra ("Nuestros Servicios Profesionales"): en castellano se escribe con mayúscula solo al inicio. */
export function isEnglishTitleCase(heading: string, keep: string[] = []): boolean {
  const kept = new Set(keep.flatMap((k) => k.split(/\s+/)).map(fold));
  const words = heading.split(/\s+/).slice(1).filter((w) => w.length >= 4 && /^\p{L}/u.test(w) && !kept.has(fold(w)) && w !== w.toUpperCase());
  return words.length >= 2 && words.every((w) => /^\p{Lu}/u.test(w));
}

export type CopyText = { where: string; text: string; heading?: boolean };

export function checkCopy(texts: CopyText[], keep: string[] = []): CopyIssue[] {
  const issues: CopyIssue[] = [];
  let dashes = 0;
  let exclamations = 0;
  for (const { where, text, heading } of texts) {
    if (!text.trim()) continue;
    const f = fold(text);
    for (const c of CLICHES) if (f.includes(c)) issues.push({ where, kind: "cliche", text: c });
    const m = text.match(AI_MENTIONS);
    if (m) issues.push({ where, kind: "ai-mention", text: m[0] });
    const p = text.match(PLACEHOLDER) ?? text.match(PLACEHOLDER_CAPS);
    if (p) issues.push({ where, kind: "placeholder", text: p[0] });
    if (EMOJI.test(text)) issues.push({ where, kind: "emoji", text: text.match(EMOJI)![0] });
    if (heading && isEnglishTitleCase(text, keep)) issues.push({ where, kind: "titlecase", text });
    dashes += (text.match(/—/g) ?? []).length;
    exclamations += (text.match(/!/g) ?? []).length;
  }
  // La raya (—) repetida es una marca típica de texto generado; en castellano se usa poco.
  if (dashes > 1) issues.push({ where: "Todo el sitio", kind: "dash", text: `${dashes} rayas (—)` });
  if (exclamations > 2) issues.push({ where: "Todo el sitio", kind: "exclamation", text: `${exclamations} signos de exclamación` });
  return issues;
}

export const ISSUE_LABELS: Record<CopyIssue["kind"], string> = {
  cliche: "Frase genérica",
  placeholder: "Texto sin completar",
  emoji: "Emoji",
  titlecase: "Mayúsculas al estilo inglés",
  exclamation: "Demasiadas exclamaciones",
  dash: "Rayas (—) de más",
  "ai-mention": "Mención a IA",
};

/** Qué problemas impiden entregar el sitio y cuáles son solo avisos. */
export const BLOCKING: CopyIssue["kind"][] = ["cliche", "placeholder", "ai-mention", "emoji"];

/** Números (precios, años, porcentajes, cantidades) que aparecen en un texto. */
export function numbersIn(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));
}

/** Números que la IA agregó y no estaban en lo que dio el cliente: posibles datos inventados. */
export function inventedNumbers(source: string, written: string): string[] {
  const have = new Set(numbersIn(source));
  return [...new Set(numbersIn(written).filter((n) => !have.has(n)))];
}

// ── Redacción con IA (opcional) ─────────────────────────────────────────
// La IA solo reescribe lo que dio el cliente para que suene profesional. No agrega datos.


export const SITE_COPY_MAX_TOKENS = 4000;
export const SITE_COPY_ESTIMATED_COST_USD = costUsd({ input_tokens: 6_000, output_tokens: SITE_COPY_MAX_TOKENS });

export type CopyFields = {
  tagline: string;
  intro: string;
  about: string;
  services: { title: string; description: string }[];
  highlights: string[];
  seoDescription: string;
  ctaLabel: string;
};

export const SITE_COPY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tagline", "intro", "about", "services", "highlights", "seoDescription", "ctaLabel"],
  properties: {
    tagline: { type: "string" },
    intro: { type: "string" },
    about: { type: "string" },
    services: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["title", "description"], properties: { title: { type: "string" }, description: { type: "string" } } },
    },
    highlights: { type: "array", items: { type: "string" } },
    seoDescription: { type: "string" },
    ctaLabel: { type: "string" },
  },
} as const;

export const siteCopyOutputSchema = z.object({
  tagline: z.string(),
  intro: z.string(),
  about: z.string(),
  services: z.array(z.object({ title: z.string(), description: z.string() })),
  highlights: z.array(z.string()),
  seoDescription: z.string(),
  ctaLabel: z.string(),
});

const TRATO_TEXT = {
  vos: "Tratá al lector de vos, en castellano rioplatense (ej.: «escribinos», «conocé», «pedí»).",
  tú: "Tratá al lector de tú, en castellano neutro (ej.: «escríbenos», «conoce», «pide»).",
  usted: "Tratá al lector de usted (ej.: «escríbanos», «conozca», «solicite»).",
} as const;

export function siteCopySystem(trato: keyof typeof TRATO_TEXT): string {
  return `Sos redactor web senior de una agencia. Reescribís los textos del sitio de un negocio real para que suenen profesionales, claros y humanos, como si los hubiera escrito una persona del rubro.

Reglas que no se rompen:
1. Usá solo la información que te dan. No agregues datos: ni cifras, años, precios, porcentajes, cantidades de clientes, premios, certificaciones, garantías, testimonios, ubicaciones ni servicios que no estén en el material.
2. Mantené los mismos servicios, en el mismo orden y la misma cantidad. Podés mejorar títulos y descripciones.
3. Si un campo viene vacío y el material no alcanza para escribirlo sin inventar, devolvelo vacío.
4. ${TRATO_TEXT[trato]}
5. Estilo: frases cortas y concretas, verbos directos, detalles específicos del negocio en vez de adjetivos. Nada de relleno.
6. Prohibido: emojis, signos de exclamación, rayas (—), mayúsculas en cada palabra de los títulos (en castellano, mayúscula solo al inicio), y frases de plantilla como: ${CLICHES.filter((c) => c.includes(" ") && c !== "lorem ipsum").join("; ")}.
7. Nunca menciones inteligencia artificial, ni que el texto fue escrito o revisado por nadie.
8. Largos máximos: frase principal 90 caracteres; introducción 240; nosotros 1500 (párrafos separados por línea en blanco); título de servicio 60; descripción de servicio 320; cada destacado 90; descripción para buscadores entre 70 y 160; texto del botón 30.`;
}

export function copyFieldsOf(c: { tagline: string; intro: string; about: string; services: CopyFields["services"]; highlights: string[]; seoDescription: string; cta: { label: string } }): CopyFields {
  return { tagline: c.tagline, intro: c.intro, about: c.about, services: c.services, highlights: c.highlights, seoDescription: c.seoDescription, ctaLabel: c.cta.label };
}

export function siteCopyPrompt(business: { name: string; industry: string | null; city: string | null }, current: CopyFields, facts: { field: string; value: string }[]): string {
  return `Negocio: ${business.name}${business.industry ? ` (${business.industry})` : ""}${business.city ? `, ${business.city}` : ""}.

Textos actuales que dio el cliente (JSON):
${JSON.stringify(current, null, 2)}

${
  facts.length
    ? `Datos públicos confirmados del negocio (podés usarlos, sin agregar nada más):\n${facts.map((f) => `- ${f.field}: ${f.value}`).join("\n")}`
    : "No hay otros datos confirmados."
}

Devolvé los mismos campos reescritos.`;
}

/** Problemas de la respuesta de la IA que impiden usarla. */
export function reviewAiCopy(source: string, before: CopyFields, after: CopyFields): string[] {
  const problems: string[] = [];
  if (after.services.length !== before.services.length) problems.push(`Cambió la cantidad de servicios (${before.services.length} → ${after.services.length}).`);
  const written = JSON.stringify(after);
  const invented = inventedNumbers(source, written);
  if (invented.length) problems.push(`Agregó números que no estaban en el material: ${invented.slice(0, 5).join(", ")}.`);
  const issues = checkCopy([
    { where: "Frase principal", text: after.tagline, heading: true },
    { where: "Introducción", text: after.intro },
    { where: "Nosotros", text: after.about },
    ...after.services.flatMap((s, i) => [
      { where: `Servicio ${i + 1}`, text: s.title, heading: true },
      { where: `Servicio ${i + 1}`, text: s.description },
    ]),
    ...after.highlights.map((h, i) => ({ where: `Destacado ${i + 1}`, text: h })),
    { where: "Descripción para buscadores", text: after.seoDescription },
    { where: "Botón", text: after.ctaLabel },
  ]).filter((i) => BLOCKING.includes(i.kind));
  for (const i of issues) problems.push(`${ISSUE_LABELS[i.kind]} en ${i.where}: «${i.text}».`);
  return problems;
}
