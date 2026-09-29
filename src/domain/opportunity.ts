/**
 * Puntaje de oportunidad (0 a 100), explicado criterio por criterio.
 *
 * Solo puntúa criterios con datos reales (auditoría técnica, datos con fuente e investigación).
 * Los que no se pueden medir con la información disponible quedan como "sin datos" y no
 * cuentan. Con menos de MIN_CRITERIA criterios medidos no hay puntaje: nunca se inventa un número.
 * Es una estimación para ordenar prospectos, no una probabilidad de venta.
 */
import type { Check } from "./site-audit";

export const OPPORTUNITY_VERSION = 1;
export const MIN_CRITERIA = 3;

export type Criterion = {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  detail: string;
};

export type OpportunityInput = {
  audit: { siteScore: number | null; checks: Check[] } | null;
  facts: { category: string; field: string; kind: string; verification: string }[];
  research: { recommendation: "qualify" | "reject" | "unsure" } | null;
};

export type Opportunity = {
  version: number;
  score: number | null;
  criteria: Criterion[];
  measured: number;
  note: string;
};

const CONTACT_FIELDS = /email|correo|tel[eé]fono|whatsapp|formulario/i;

export function computeOpportunity(i: OpportunityInput): Opportunity {
  const c: Criterion[] = [];
  const status = (id: string) => i.audit?.checks.find((k) => k.id === id)?.status;

  // 1. Necesidad de modernización: cuanto peor el puntaje técnico, más oportunidad.
  c.push(
    i.audit?.siteScore != null
      ? {
          key: "modernizacion",
          label: "Necesidad de modernización",
          weight: 3,
          score: 100 - i.audit.siteScore,
          detail: `Puntaje técnico del sitio: ${i.audit.siteScore}/100.`,
        }
      : { key: "modernizacion", label: "Necesidad de modernización", weight: 3, score: null, detail: "Falta la auditoría web." },
  );

  // 2. Mejoras visibles: problemas que el cliente nota a simple vista (más fáciles de explicar y vender).
  if (i.audit) {
    const visible = [
      ["viewport", "no se adapta al celular"],
      ["https", "sin HTTPS"],
      ["flash", "usa Flash"],
      ["obsolete-tags", "etiquetas antiguas"],
      ["copyright-year", "año viejo en el pie"],
      ["cta", "sin llamados a la acción"],
      ["contact-channel", "sin contacto directo"],
    ] as const;
    const found = visible.filter(([id]) => ["fail", "warn"].includes(status(id) ?? ""));
    c.push({
      key: "visible",
      label: "Mejoras visibles para el cliente",
      weight: 2,
      score: Math.min(100, found.length * 25),
      detail: found.length ? `Se notaría: ${found.map(([, t]) => t).join(", ")}.` : "Pocos problemas visibles a simple vista.",
    });
  } else {
    c.push({ key: "visible", label: "Mejoras visibles para el cliente", weight: 2, score: null, detail: "Falta la auditoría web." });
  }

  // 3. Facilidad de contacto: canales comerciales cargados como datos.
  const contacts = i.facts.filter((f) => f.category === "contact" && CONTACT_FIELDS.test(f.field));
  const confirmed = contacts.filter((f) => f.verification === "verified").length;
  c.push({
    key: "contacto",
    label: "Facilidad de contacto",
    weight: 2,
    score: contacts.length === 0 ? 0 : Math.min(100, 50 + contacts.length * 15 + confirmed * 10),
    detail: contacts.length
      ? `${contacts.length} canal(es) de contacto cargado(s), ${confirmed} confirmado(s) por una persona.`
      : "No hay email, teléfono ni WhatsApp cargado.",
  });

  // 4. Negocio activo y adecuado, según la investigación.
  c.push(
    i.research
      ? {
          key: "negocio",
          label: "Negocio activo y adecuado",
          weight: 2,
          score: { qualify: 100, unsure: 50, reject: 0 }[i.research.recommendation],
          detail: {
            qualify: "La investigación lo encontró activo y con una necesidad digital.",
            unsure: "La investigación no tuvo información suficiente.",
            reject: "La investigación recomendó descartarlo.",
          }[i.research.recommendation],
        }
      : { key: "negocio", label: "Negocio activo y adecuado", weight: 2, score: null, detail: "Falta la investigación." },
  );

  // 5. Calidad de la información: cuánto se sabe y cuánto está respaldado por una fuente.
  const observed = i.facts.filter((f) => f.kind === "observed").length;
  c.push(
    i.facts.length
      ? {
          key: "informacion",
          label: "Calidad de la información",
          weight: 1,
          score: Math.min(100, observed * 12 + i.facts.filter((f) => f.verification === "verified").length * 8),
          detail: `${i.facts.length} dato(s), ${observed} observado(s) con fuente.`,
        }
      : { key: "informacion", label: "Calidad de la información", weight: 1, score: null, detail: "Todavía no hay datos cargados." },
  );

  // Criterios que hoy no se pueden medir sin inventar.
  for (const [key, label] of [
    ["pago", "Capacidad de pago"],
    ["competencia", "Competencia"],
    ["respuesta", "Probabilidad de respuesta"],
  ] as const) {
    c.push({ key, label, weight: 0, score: null, detail: "Sin datos: no se estima para no inventar." });
  }

  const scored = c.filter((k) => k.score != null && k.weight > 0);
  if (scored.length < MIN_CRITERIA) {
    return {
      version: OPPORTUNITY_VERSION,
      score: null,
      criteria: c,
      measured: scored.length,
      note: `Hay ${scored.length} criterio(s) con datos; hacen falta al menos ${MIN_CRITERIA}. Hacé la auditoría y la investigación.`,
    };
  }
  const total = scored.reduce((s, k) => s + k.weight, 0);
  const score = Math.round(scored.reduce((s, k) => s + k.weight * k.score!, 0) / total);
  return {
    version: OPPORTUNITY_VERSION,
    score,
    criteria: c,
    measured: scored.length,
    note: `Calculado con ${scored.length} criterios con datos. Es una estimación para ordenar prospectos, no una probabilidad de venta.`,
  };
}
