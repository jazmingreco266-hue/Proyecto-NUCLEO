/**
 * Arma los mensajes comerciales de un prospecto a partir de datos concretos.
 *
 * Regla de veracidad: el generador no inventa nada sobre la empresa. Lo específico
 * (qué tiene de bueno, qué oportunidad hay, qué beneficio trae) llega como entrada,
 * escrito por una persona o por un agente que cita sus fuentes. El generador solo
 * lo ordena en cada canal con un tono breve y humano.
 */
import { z } from "zod";
import { sourceUrlSchema } from "./validation";

export const outreachInputSchema = z.object({
  positive: z
    .string()
    .trim()
    .min(10, "Escribí algo positivo y concreto de la empresa (mínimo 10 caracteres)")
    .max(400),
  opportunity: z
    .string()
    .trim()
    .min(10, "Describí la oportunidad concreta que viste (mínimo 10 caracteres)")
    .max(300),
  benefit: z
    .string()
    .trim()
    .min(10, "Explicá el beneficio comercial para la empresa (mínimo 10 caracteres)")
    .max(300),
  demoUrl: z.union([z.literal(""), sourceUrlSchema]).optional().default(""),
  contactName: z.string().trim().max(80).optional().default(""),
});
export type OutreachInput = z.infer<typeof outreachInputSchema>;

export type Company = { name: string; city: string | null; industry: string | null; country: string };
export type Sender = { name: string; role: string; email: string; phone: string; website: string };
export type ContactFact = { field: string; value: string; verification: "verified" | "probable" | "unconfirmed" };

export type Channel = "email" | "whatsapp" | "linkedin" | "form" | "instagram" | "none";
export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  form: "Formulario web",
  instagram: "Instagram",
  none: "Sin canal todavía",
};

export type OutreachDraft = {
  subjects: string[];
  emailText: string;
  emailHtml: string;
  whatsappText: string;
  formText: string;
  socialText: string;
  suggestedChannel: Channel;
  channelReason: string;
  bestTime: string;
};

// ─────────────────────────── Canal sugerido ───────────────────────────

function classify(f: ContactFact): Channel | null {
  const t = `${f.field} ${f.value}`.toLowerCase();
  if (/whats\s?app|wa\.me/.test(t)) return "whatsapp";
  if (/linkedin/.test(t)) return "linkedin";
  if (/instagram/.test(t)) return "instagram";
  if (/formulario|form(ulario)? de contacto|\bform\b/.test(t)) return "form";
  if (/@/.test(f.value) || /e-?mail|correo/.test(t)) return "email";
  return null;
}

const ORDER: Channel[] = ["email", "whatsapp", "linkedin", "form", "instagram"];
const V_RANK = { verified: 0, probable: 1, unconfirmed: 2 } as const;
const V_TEXT = { verified: "verificado", probable: "probable", unconfirmed: "no verificado" } as const;

export function suggestChannel(contacts: ContactFact[]): { channel: Channel; reason: string } {
  const found = contacts
    .map((f) => ({ f, c: classify(f) }))
    .filter((x): x is { f: ContactFact; c: Channel } => x.c !== null)
    .sort((a, b) => V_RANK[a.f.verification] - V_RANK[b.f.verification] || ORDER.indexOf(a.c) - ORDER.indexOf(b.c));
  const best = found[0];
  if (!best) {
    return {
      channel: "none",
      reason: "No hay contactos comerciales cargados. Agregá uno en la pestaña Contactos antes de enviar.",
    };
  }
  const why: Record<Channel, string> = {
    email: "permite mostrar la propuesta completa con imagen y enlace",
    whatsapp: "es directo y suele tener respuesta rápida",
    linkedin: "llega a quien decide en un contexto profesional",
    form: "es el canal que la empresa eligió publicar para consultas",
    instagram: "es donde la empresa está activa",
    none: "",
  };
  return {
    channel: best.c,
    reason: `Hay un contacto de ${CHANNEL_LABELS[best.c]} (${V_TEXT[best.f.verification]}): ${best.f.value}. Este canal ${why[best.c]}.`,
  };
}

// ─────────────────────────── Horario sugerido ───────────────────────────

const COUNTRY_TZ: Record<string, string> = {
  AR: "America/Argentina/Buenos_Aires",
  UY: "America/Montevideo",
  CL: "America/Santiago",
  PY: "America/Asuncion",
  BO: "America/La_Paz",
  PE: "America/Lima",
  CO: "America/Bogota",
  EC: "America/Guayaquil",
  VE: "America/Caracas",
  MX: "America/Mexico_City",
  CR: "America/Costa_Rica",
  PA: "America/Panama",
  DO: "America/Santo_Domingo",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  IT: "Europe/Rome",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  GB: "Europe/London",
};

export function suggestBestTime(company: Company, now = new Date()): string {
  const tz = COUNTRY_TZ[company.country];
  const where = company.city ? `${company.city}` : company.country;
  const base = "Sugerencia general, no un dato medido: martes a jueves, entre 9:30 y 11:30";
  if (!tz) {
    return `${base}, hora local de la empresa (${where}). Revisá su zona horaria: el país tiene varias o no está en la lista.`;
  }
  const localNow = new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  return `${base} hora de ${where} (${tz}; ahora allá son las ${localNow}).`;
}

// ─────────────────────────── Textos ───────────────────────────

function sentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const first = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(first) ? first : `${first}.`;
}
function lowerFirst(s: string): string {
  const t = s.trim().replace(/[.]+$/, "");
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function signatureLines(sender: Sender): string[] {
  return [
    sender.name + (sender.role ? `, ${sender.role}` : ""),
    "Núcleo" + (sender.website ? ` · ${sender.website}` : ""),
    [sender.email, sender.phone].filter(Boolean).join(" · "),
  ].filter(Boolean);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type GenerateResult = { ok: true; draft: OutreachDraft } | { ok: false; missing: string[] };

export function generateOutreach(
  company: Company,
  sender: Sender,
  input: OutreachInput,
  contacts: ContactFact[],
  now = new Date(),
): GenerateResult {
  const missing: string[] = [];
  if (!sender.name.trim()) missing.push("Tu nombre en Configuración → Firma de los mensajes");
  if (!sender.email.trim()) missing.push("Tu email en Configuración → Firma de los mensajes");
  if (missing.length) return { ok: false, missing };

  const greet = input.contactName ? `Hola, ${input.contactName}:` : "Hola, equipo de " + company.name + ":";
  const place = company.city ? ` en ${company.city}` : "";
  const intro = `Soy ${sender.name}, de Núcleo. Ayudamos a empresas a modernizar su presencia digital y sus procesos.`;
  const research = `Estuve mirando ${company.name}${place}. ${sentence(input.positive)}`;
  const opportunity = `Vi una oportunidad concreta: ${lowerFirst(input.opportunity)}. ${sentence(input.benefit)}`;
  const demo = input.demoUrl
    ? `Preparé una propuesta conceptual para que se vea la idea: ${input.demoUrl}. Es una idea inicial, no oficial y sin compromiso.`
    : "Si les interesa, preparo una propuesta visual sin costo ni compromiso para que vean la idea.";
  const cta = "¿Les parece que lo conversemos 15 minutos esta semana?";
  const optOut = "Si no les interesa, respondan “no” y no les vuelvo a escribir.";
  const sig = signatureLines(sender);

  const subjects = [
    `Una idea para el sitio de ${company.name}`,
    `${company.name}: ${lowerFirst(input.opportunity).slice(0, 60)}${input.opportunity.length > 60 ? "…" : ""}`,
    `Propuesta sin compromiso para ${company.name}`,
  ];

  const emailText = [greet, "", intro, "", research, "", opportunity, "", demo, "", cta, "", "Saludos,", ...sig, "", optOut].join(
    "\n",
  );

  const whatsappText = [
    `Hola${input.contactName ? `, ${input.contactName}` : ""}. Soy ${sender.name}, de Núcleo.`,
    `${sentence(input.positive)} Vi una oportunidad: ${lowerFirst(input.opportunity)}.`,
    input.demoUrl ? `Les preparé una idea inicial, sin compromiso: ${input.demoUrl}` : "Si quieren, les preparo una idea visual sin compromiso.",
    "¿Les puedo contar en 15 minutos?",
  ].join("\n");

  const formText = [
    `Hola. Soy ${sender.name}, de Núcleo${sender.website ? ` (${sender.website})` : ""}.`,
    `${research} Vi una oportunidad concreta: ${lowerFirst(input.opportunity)}. ${sentence(input.benefit)}`,
    demo,
    `Mi contacto: ${[sender.email, sender.phone].filter(Boolean).join(" · ")}.`,
  ].join("\n\n");

  const socialText = [
    `Hola${input.contactName ? `, ${input.contactName}` : ""}. Soy ${sender.name}, de Núcleo.`,
    `${sentence(input.positive)} Vi una oportunidad: ${lowerFirst(input.opportunity)}.`,
    input.demoUrl ? `Preparé una idea inicial sin compromiso: ${input.demoUrl}` : "Si les interesa, les muestro una idea sin compromiso.",
    "¿Lo conversamos?",
  ].join(" ");

  const { channel, reason } = suggestChannel(contacts);

  return {
    ok: true,
    draft: {
      subjects,
      emailText,
      emailHtml: renderEmailHtml({
        subject: subjects[0]!,
        paragraphs: [greet, intro, research, opportunity, demo, cta],
        footer: ["Saludos,", ...sig, "", optOut],
        sender,
        demoUrl: input.demoUrl,
      }),
      whatsappText,
      formText,
      socialText,
      suggestedChannel: channel,
      channelReason: reason,
      bestTime: suggestBestTime(company, now),
    },
  };
}

// ─────────────────────────── Email HTML ───────────────────────────

type EmailParts = {
  subject: string;
  /** Párrafos del cuerpo, en texto plano (se escapan). */
  paragraphs: string[];
  /** Pie opcional: firma y aviso de baja. Si el texto editado ya los trae, va vacío. */
  footer: string[];
  sender: Sender;
  demoUrl: string;
};

/**
 * Email compatible con los clientes de correo habituales: tablas, estilos en línea,
 * sin scripts, sin imágenes obligatorias y con todo el texto escapado.
 */
export function renderEmailHtml(p: EmailParts): string {
  const e = escapeHtml;
  const para = (t: string) =>
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1c1c1b;">${e(t).replace(/\n/g, "<br>")}</p>`;
  const replyHref = `mailto:${encodeURIComponent(p.sender.email)}?subject=${encodeURIComponent("Re: " + p.subject)}`;
  const button = (href: string, label: string, dark: boolean) =>
    `<a href="${e(href)}" style="display:inline-block;padding:12px 20px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;${
      dark ? "background:#1c1c1b;color:#ffffff;" : "background:#ffffff;color:#1c1c1b;border:1px solid #d9d9d4;"
    }">${e(label)}</a>`;
  const footer = p.footer.length
    ? `<tr><td style="padding:0 28px 28px;border-top:1px solid #e4e4e0;">
<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5d5d59;">${p.footer.map(e).join("<br>")}</p>
</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${e(p.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#fbfbfa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbfbfa;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e0;border-radius:12px;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1c1c1b;">Núcleo</p>
${p.paragraphs.map(para).join("\n")}
</td></tr>
<tr><td style="padding:0 28px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 8px 8px 0;">${button(replyHref, "Responder", true)}</td>
${p.demoUrl ? `<td style="padding:0 0 8px;">${button(p.demoUrl, "Ver la propuesta", false)}</td>` : ""}
</tr></table>
</td></tr>
${footer}
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** HTML a partir de un texto editado a mano: cada bloque separado por una línea en blanco es un párrafo. */
export function emailHtmlFromText(subject: string, text: string, sender: Sender, demoUrl: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return renderEmailHtml({ subject, paragraphs, footer: [], sender, demoUrl });
}
