/**
 * Servicios adicionales que podrían servirle a una empresa: chatbot y base de datos / CRM.
 *
 * Se detectan por señales en los datos cargados (con su fuente). Cada sugerencia muestra el dato
 * que la motivó y siempre es una hipótesis a confirmar con el cliente: nunca se presenta como hecho.
 */

export type UpsellFact = { category: string; field: string; value: string; kind: string; sourceUrl: string | null };
export type Signal = { id: string; label: string; evidence: string; kind: string; sourceUrl: string | null };
export type UpsellService = "Chatbot" | "Base de datos / CRM";

export type Upsell = {
  service: UpsellService;
  signals: Signal[];
  solution: string;
  benefit: string;
  /** Frase breve para mencionar en un mensaje. */
  pitch: string;
  priceItems: { name: string; price: number; recurring?: boolean }[];
};

type Rule = { id: string; service: UpsellService; label: string; re: RegExp; contactOnly?: boolean };

const RULES: Rule[] = [
  { id: "whatsapp", service: "Chatbot", label: "atienden consultas por WhatsApp", re: /whatsapp/i, contactOnly: true },
  { id: "consultas", service: "Chatbot", label: "reciben consultas frecuentes (precios, horarios, disponibilidad)", re: /consulta|preguntas? frecuentes|horario|disponibilidad|presupuesto/i },
  { id: "turnos", service: "Base de datos / CRM", label: "manejan turnos o reservas", re: /turno|reserva|agenda|cita|sesi[oó]n/i },
  { id: "pedidos", service: "Base de datos / CRM", label: "toman pedidos o encargos", re: /pedido|encargo|delivery|env[ií]o|por encargo/i },
  { id: "catalogo", service: "Base de datos / CRM", label: "tienen un catálogo o stock de productos", re: /cat[aá]logo|stock|inventario|lista de precios|productos?\b/i },
  { id: "clientes", service: "Base de datos / CRM", label: "trabajan con clientes recurrentes (socios, alumnos, pacientes)", re: /socio|alumno|paciente|afiliado|abonado|cliente frecuente/i },
];

const SERVICE_TEXT: Record<UpsellService, { solution: string; benefit: string; pitch: string; price: RegExp }> = {
  Chatbot: {
    solution: "Un chatbot de WhatsApp o del sitio que responda las preguntas frecuentes y derive a una persona cuando hace falta.",
    benefit: "Respuestas a cualquier hora y menos tiempo del equipo contestando lo mismo.",
    pitch: "un chatbot podría responder las consultas frecuentes a cualquier hora",
    price: /chatbot/i,
  },
  "Base de datos / CRM": {
    solution: "Una base de datos o CRM a medida para registrar clientes, turnos, pedidos o stock en un solo lugar.",
    benefit: "Menos planillas y papeles, menos errores y reportes al día.",
    pitch: "una base de datos simple podría ordenar clientes, turnos o pedidos en un solo lugar",
    price: /base de datos|crm/i,
  },
};

export function detectUpsells(facts: UpsellFact[], priceList: { name: string; price: number; recurring?: boolean }[] = []): Upsell[] {
  const found = new Map<UpsellService, Signal[]>();
  for (const r of RULES) {
    const f = facts.find((x) => (r.contactOnly ? x.category === "contact" && r.re.test(x.field) : x.category !== "contact" && r.re.test(`${x.field} ${x.value}`)));
    if (!f) continue;
    const list = found.get(r.service) ?? [];
    list.push({ id: r.id, label: r.label, evidence: `${f.field}: ${f.value}`.slice(0, 200), kind: f.kind, sourceUrl: f.sourceUrl });
    found.set(r.service, list);
  }
  return [...found.entries()].map(([service, signals]) => {
    const t = SERVICE_TEXT[service];
    return {
      service,
      signals,
      solution: t.solution,
      benefit: t.benefit,
      pitch: t.pitch,
      priceItems: priceList.filter((p) => t.price.test(p.name)),
    };
  });
}
