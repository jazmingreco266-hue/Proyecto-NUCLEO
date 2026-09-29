/**
 * Mensajes de contacto preparados: asuntos, email HTML, texto plano y versiones por canal.
 *
 * Reglas (secciones G y H del documento maestro):
 * - Personalizados con datos reales de la ficha y de la auditoría. Si falta algo, se avisa;
 *   nunca se inventa un elogio, una métrica ni un resultado.
 * - Sin lenguaje ofensivo sobre el sitio actual, sin falsas urgencias ni promesas.
 * - El sistema los prepara; una persona los revisa y los envía.
 */
import type { Check } from "./site-audit";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type Sender = { agencyName: string; senderName: string; replyEmail: string; whatsapp: string; website: string };

export type OutreachInput = {
  businessName: string;
  country: string;
  facts: { category: string; field: string; value: string; kind: string }[];
  auditChecks: Check[] | null;
  sender: Sender;
  allowedChannels: string[];
};

export type OutreachContent = {
  subjects: string[];
  improvements: string[];
  positive: string | null;
  emailText: string;
  emailHtml: string;
  whatsapp: string;
  form: string;
  social: string;
  channel: { suggested: string; reason: string; available: string[] };
  bestTime: { text: string; basis: string };
  warnings: string[];
};

/** Mejora redactada como beneficio, por verificación de la auditoría. */
const BENEFITS: Record<string, string> = {
  viewport: "que el sitio se adapte bien al celular",
  "contact-channel": "que quien entra pueda consultarles en un toque (WhatsApp, teléfono o formulario)",
  https: "sumar conexión segura (HTTPS), para que el navegador no muestre el aviso de «No seguro»",
  cta: "botones claros para consultar o pedir presupuesto",
  whatsapp: "un botón directo a WhatsApp",
  "broken-links": "corregir enlaces que hoy llevan a páginas con error",
  flash: "reemplazar partes que los navegadores actuales ya no muestran",
  "response-time": "que el sitio cargue más rápido",
  "meta-description": "mejorar cómo aparece el sitio en los resultados de Google",
  title: "mejorar cómo aparece el sitio en los resultados de Google",
  "open-graph": "que al compartir el enlace por WhatsApp aparezca una vista previa con imagen",
  "copyright-year": "renovar el diseño para que se vea actual",
  "obsolete-tags": "renovar el diseño para que se vea actual",
  "img-alt": "hacer el sitio más accesible para todas las personas",
  lang: "hacer el sitio más accesible para todas las personas",
  "structured-data": "que Google entienda mejor el negocio (rubro, dirección, horarios)",
};

export function improvementsFrom(checks: Check[] | null, max = 3): string[] {
  if (!checks) return [];
  const rank = { fail: 0, warn: 1 } as const;
  const out: string[] = [];
  for (const c of checks
    .filter((k) => (k.status === "fail" || k.status === "warn") && BENEFITS[k.id])
    .sort((a, b) => rank[a.status as "fail" | "warn"] - rank[b.status as "fail" | "warn"] || b.weight - a.weight)) {
    const b = BENEFITS[c.id]!;
    if (!out.includes(b)) out.push(b);
    if (out.length >= max) break;
  }
  return out;
}

/** Zona horaria de referencia por país (la capital o la zona más poblada). */
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
  ES: "Europe/Madrid",
  US: "America/New_York",
  BR: "America/Sao_Paulo",
};

function bestTime(country: string) {
  const tz = COUNTRY_TZ[country];
  return {
    text: `Martes a jueves, entre las 10 y las 12${tz ? ` (hora de ${tz.split("/").pop()!.replace(/_/g, " ")})` : " (hora local de la empresa)"}.`,
    basis: "Sugerencia general para contactos comerciales: evita el inicio y el cierre de la semana y el horario de almuerzo. No es un dato medido para esta empresa.",
  };
}

function channels(facts: OutreachInput["facts"], allowed: string[]) {
  const has = (re: RegExp) => facts.some((f) => f.category === "contact" && re.test(f.field));
  const available = [
    has(/email|correo/i) && "email",
    has(/whatsapp/i) && "whatsapp",
    has(/formulario/i) && "form",
    has(/instagram/i) && "instagram",
    has(/linkedin/i) && "linkedin",
  ].filter((c): c is string => Boolean(c) && allowed.includes(c as string));
  const order: [string, string][] = [
    ["email", "Hay un email comercial cargado: permite una presentación completa con las mejoras detalladas."],
    ["whatsapp", "Hay un WhatsApp comercial cargado: es un canal directo y habitual para negocios."],
    ["form", "El sitio tiene formulario de contacto: es el canal que la empresa ofrece para consultas."],
    ["instagram", "Hay un Instagram de la empresa cargado."],
    ["linkedin", "Hay una página de LinkedIn de la empresa cargada."],
  ];
  const pick = order.find(([c]) => available.includes(c));
  return pick
    ? { suggested: pick[0], reason: pick[1], available }
    : { suggested: "ninguno", reason: "No hay un canal de contacto cargado que esté habilitado en la configuración. Cargá uno con su fuente antes de contactar.", available };
}

export function buildOutreach(i: OutreachInput): OutreachContent {
  const warnings: string[] = [];
  const name = i.businessName;
  const s = i.sender;
  const who = s.senderName || "[tu nombre]";
  const agency = s.agencyName || "[tu agencia]";
  if (!s.senderName) warnings.push("Falta tu nombre en Configuración → Firma de los mensajes.");
  if (!s.replyEmail && !s.whatsapp) warnings.push("Falta un email o WhatsApp de respuesta en Configuración → Firma de los mensajes.");

  // Algo positivo y real: solo un hecho observado del negocio.
  const good = i.facts.find(
    (f) => f.kind === "observed" && f.category === "business" && /diferencial|antig[üu]edad|historia|experiencia|trayectoria|especialidad/i.test(f.field),
  );
  const positive = good ? good.value.replace(/\s+/g, " ").slice(0, 140) : null;
  if (!positive) warnings.push("No hay un dato observado positivo del negocio: agregá uno propio antes de enviar para que no suene genérico.");

  const improvements = improvementsFrom(i.auditChecks);
  if (!improvements.length) warnings.push("No hay auditoría con mejoras detectadas: escribí vos las oportunidades concretas.");

  const signatureLines = [who, agency, s.replyEmail, s.whatsapp, s.website].filter(Boolean);
  const intro = `Soy ${who}, de ${agency}.`;
  const introMid = `soy ${who}, de ${agency}.`;
  const positiveLine = positive ? `Estuve mirando ${name} y me llamó la atención esto: «${positive}».` : `Estuve mirando el sitio de ${name}.`;
  const bullets = improvements.length ? improvements : ["[escribí acá una mejora concreta]"];

  const emailText = [
    `Hola, equipo de ${name}:`,
    "",
    `${intro} ${positiveLine}`,
    "",
    "Vi algunas oportunidades para que el sitio les traiga más consultas:",
    ...bullets.map((b) => `• ${b[0]!.toUpperCase()}${b.slice(1)}.`),
    "",
    "Si les interesa, les armo una propuesta concreta, sin compromiso.",
    "¿Les parece si lo charlamos 15 minutos cuando les quede cómodo?",
    "",
    "Saludos,",
    ...signatureLines,
    "",
    "Si no les interesa, respondan «no» y no volvemos a escribirles.",
  ].join("\n");

  const e = escapeHtml;
  const emailHtml = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(`Una idea para el sitio de ${name}`)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;font-family:Arial,Helvetica,sans-serif;color:#1c1c1b;font-size:16px;line-height:1.55">
<tr><td style="padding:32px 32px 8px">
<p style="margin:0 0 16px">Hola, equipo de ${e(name)}:</p>
<p style="margin:0 0 16px">${e(intro)} ${e(positiveLine)}</p>
<p style="margin:0 0 8px">Vi algunas oportunidades para que el sitio les traiga más consultas:</p>
<ul style="margin:0 0 20px;padding-left:20px">${bullets.map((b) => `<li style="margin:0 0 6px">${e(b[0]!.toUpperCase() + b.slice(1))}.</li>`).join("")}</ul>
<p style="margin:0 0 20px">Si les interesa, les armo una propuesta concreta, sin compromiso.</p>
<p style="margin:0 0 20px">¿Les parece si lo charlamos 15 minutos cuando les quede cómodo?</p>
<p style="margin:0 0 24px">Saludos,<br>${signatureLines.map(e).join("<br>")}</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e4e4e0;font-size:12px;color:#8b8b86">Si no les interesa, respondan «no» y no volvemos a escribirles.</td></tr>
</table></td></tr></table>
</body></html>`;

  const whatsapp = [
    `Hola, ¿cómo están? ${intro}`,
    positive ? `Vi ${name} y me llamó la atención: «${positive}».` : `Estuve viendo el sitio de ${name}.`,
    `Vi algunas mejoras posibles para su web, como ${bullets[0]}.`,
    "Si les interesa, les cuento sin compromiso. Y si no, no hay problema.",
  ].join("\n");

  const form = [
    `Hola, ${introMid} ${positiveLine}`,
    `Vi algunas mejoras posibles para el sitio: ${bullets.slice(0, 2).join("; ")}.`,
    `Si les interesa, les armo una propuesta sin compromiso${s.replyEmail || s.whatsapp ? `; pueden escribirme${s.replyEmail ? ` a ${s.replyEmail}` : ""}${s.whatsapp ? `${s.replyEmail ? " o" : ""} al ${s.whatsapp}` : ""}` : ""}.`,
    "Saludos.",
  ].join("\n");

  const social = `Hola, ${introMid} Vi algunas mejoras posibles para el sitio de ${name}, como ${bullets[0]}. ¿Les interesa que les cuente, sin compromiso?`;

  return {
    subjects: [`Una idea para el sitio de ${name}`, `${name}: tres mejoras para su web`, `Propuesta sin compromiso para el sitio de ${name}`],
    improvements,
    positive,
    emailText,
    emailHtml,
    whatsapp,
    form,
    social,
    channel: channels(i.facts, i.allowedChannels),
    bestTime: bestTime(i.country),
    warnings,
  };
}
