import { z } from "zod";
import { ISO_COUNTRIES } from "./countries";
import { PIPELINE_STATUSES } from "./pipeline";

// ─────────────────────────── URLs y dominios ───────────────────────────

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|0\.0\.0\.0|\[.*\])$/i;

/**
 * Normaliza la URL pública de un sitio. Rechaza lo que no sea http/https,
 * credenciales embebidas, IPs y hosts privados.
 */
export function normalizeWebsite(input: string): { url: string; domain: string } {
  const raw = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new Error("La URL del sitio no es válida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Solo se aceptan sitios http o https.");
  }
  if (u.username || u.password) throw new Error("La URL no puede incluir usuario ni contraseña.");
  const host = u.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes(".")) {
    throw new Error("La URL tiene que ser un dominio público.");
  }
  u.hash = "";
  const domain = host.replace(/^www\./, "");
  return { url: u.toString(), domain };
}

/** Para enlaces de fuentes: solo http/https, nunca javascript:, data:, etc. */
export const sourceUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "La URL de la fuente tiene que empezar con http:// o https://");

// ─────────────────────────── Países ───────────────────────────

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

export function countryName(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Usá el código de país de dos letras (ej.: AR)")
  .refine((c) => ISO_COUNTRIES.has(c), "Código de país desconocido");

// ─────────────────────────── Prospectos ───────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const prospectInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(200),
  legalName: optionalText(200),
  country: countrySchema,
  region: optionalText(120),
  city: optionalText(120),
  language: optionalText(20),
  industry: optionalText(120),
  websiteUrl: optionalText(2000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  estimatedValue: z.coerce.number().min(0).max(1e12).nullable().optional(),
});
export type ProspectInput = z.infer<typeof prospectInputSchema>;

export const transitionInputSchema = z.object({
  prospectId: z.string().uuid(),
  to: z.enum(PIPELINE_STATUSES),
  reason: z.string().trim().min(3, "Explicá el motivo del cambio").max(1000),
  nextStep: optionalText(500),
  expectedVersion: z.coerce.number().int().positive(),
});

// ─────────────────────────── Hechos con fuente ───────────────────────────

export const FACT_KINDS = ["observed", "inference", "hypothesis"] as const;
export const FACT_VERIFICATIONS = ["verified", "probable", "unconfirmed"] as const;
export const FACT_CATEGORIES = [
  "identity",
  "contact",
  "business",
  "visual",
  "tech",
  "reputation",
  "other",
] as const;

export const FACT_KIND_LABELS = {
  observed: "Hecho observado",
  inference: "Inferencia razonable",
  hypothesis: "Hipótesis a confirmar",
} as const;
export const FACT_VERIFICATION_LABELS = {
  verified: "Verificado",
  probable: "Probable",
  unconfirmed: "No verificado",
} as const;
export const FACT_CATEGORY_LABELS = {
  identity: "Identidad",
  contact: "Contacto",
  business: "Negocio",
  visual: "Identidad visual",
  tech: "Tecnología",
  reputation: "Reputación",
  other: "Otro",
} as const;

export const factInputSchema = z
  .object({
    prospectId: z.string().uuid(),
    category: z.enum(FACT_CATEGORIES),
    field: z.string().trim().min(2).max(120),
    value: z.string().trim().min(1).max(4000),
    kind: z.enum(FACT_KINDS),
    verification: z.enum(FACT_VERIFICATIONS),
    confidence: z.coerce.number().int().min(0).max(100),
    sourceName: optionalText(200),
    sourceUrl: sourceUrlSchema.nullable().optional().or(z.literal("").transform(() => null)),
  })
  .superRefine((f, ctx) => {
    if (f.kind === "observed" && !f.sourceUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Un hecho observado necesita la URL de donde se obtuvo.",
      });
    }
    if (f.verification === "verified" && !f.sourceUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Para marcarlo como verificado hace falta la URL de la fuente.",
      });
    }
    if (f.kind !== "observed" && f.verification === "verified") {
      ctx.addIssue({
        code: "custom",
        path: ["verification"],
        message: "Una inferencia o hipótesis no puede figurar como verificada.",
      });
    }
  });
export type FactInput = z.infer<typeof factInputSchema>;

// ─────────────────────────── Configuración ───────────────────────────

const list = (max: number) => z.array(z.string().trim().min(1).max(120)).max(max);

export const AUTONOMY_LEVELS = ["manual", "assisted", "autonomous"] as const;
export const AUTONOMY_LABELS = {
  manual: "Manual: los agentes no corren solos",
  assisted: "Asistido: investigan y proponen, vos aprobás cada demo",
  autonomous: "Autónomo: investigan y generan demos dentro de los límites",
} as const;

export const CHANNELS = ["email", "whatsapp", "form", "instagram", "linkedin"] as const;

export const settingsSchema = z
  .object({
    countries: z.array(countrySchema).max(60),
    cities: list(200),
    industries: list(200),
    languages: list(20),
    maxLeadsPerDay: z.coerce.number().int().min(0).max(500),
    maxDemosPerDay: z.coerce.number().int().min(0).max(50),
    minOpportunityScore: z.coerce.number().int().min(0).max(100),
    apiBudgetUsdMonthly: z.coerce.number().min(0).max(100000),
    schedule: z.object({
      timezone: z.string().trim().min(3).max(60),
      startHour: z.coerce.number().int().min(0).max(23),
      endHour: z.coerce.number().int().min(1).max(24),
      weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
    }),
    allowedSources: list(100),
    blockedSources: list(500),
    autonomy: z.enum(AUTONOMY_LEVELS),
    channels: z.array(z.enum(CHANNELS)).max(CHANNELS.length),
    discard: z.object({
      requirePublicContact: z.boolean(),
      skipIfSiteScoreAbove: z.coerce.number().int().min(0).max(100),
      excludedIndustries: list(200),
    }),
  })
  .refine((s) => s.schedule.endHour > s.schedule.startHour, {
    path: ["schedule", "endHour"],
    message: "La hora de fin tiene que ser posterior a la de inicio.",
  })
  .refine((s) => {
    try {
      new Intl.DateTimeFormat("es", { timeZone: s.schedule.timezone });
      return true;
    } catch {
      return false;
    }
  }, { path: ["schedule", "timezone"], message: "Zona horaria desconocida." });

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Valores iniciales conservadores: autonomía manual y presupuesto 0.
 * Ningún agente gasta ni corre hasta que el propietario lo configure.
 */
export const DEFAULT_SETTINGS: Settings = {
  countries: ["AR"],
  cities: [],
  industries: [],
  languages: ["es"],
  maxLeadsPerDay: 20,
  maxDemosPerDay: 3,
  minOpportunityScore: 60,
  apiBudgetUsdMonthly: 0,
  schedule: {
    timezone: "America/Argentina/Buenos_Aires",
    startHour: 8,
    endHour: 20,
    weekdays: [1, 2, 3, 4, 5],
  },
  allowedSources: [],
  blockedSources: [],
  autonomy: "manual",
  channels: ["email", "whatsapp", "form"],
  discard: {
    requirePublicContact: true,
    skipIfSiteScoreAbove: 80,
    excludedIndustries: [],
  },
};

// ─────────────────────────── Usuarios ───────────────────────────

export const passwordSchema = z
  .string()
  .min(12, "La contraseña necesita al menos 12 caracteres")
  .max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Combiná letras y números");

export const emailSchema = z.string().trim().toLowerCase().email("Email inválido").max(254);
