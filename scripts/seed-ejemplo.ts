/**
 * Carga prospectos DE EJEMPLO para probar el panel. Todos son ficticios:
 * usan dominios reservados `.example` (que no pueden pertenecer a nadie),
 * quedan marcados con is_sample = true y el panel los muestra con la etiqueta "EJEMPLO".
 * Las métricas del panel los excluyen.
 *
 *   npm run seed:ejemplo            carga los ejemplos
 *   npm run seed:ejemplo -- --borrar  los elimina
 */
import { parseArgs } from "node:util";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import { prospects, users } from "../src/db/schema";
import type { PipelineStatus } from "../src/domain/pipeline";
import type { Principal } from "../src/server/principal";
import { addFact, createProspect, transitionProspect } from "../src/server/services/prospects";
import { generateMessages } from "../src/server/services/outreach";

const { values } = parseArgs({ options: { borrar: { type: "boolean", default: false } } });

if (process.env.NODE_ENV === "production") {
  console.error("✖ Los datos de ejemplo no se cargan en producción.");
  process.exit(1);
}

const db = getDb();

type Sample = {
  name: string;
  city: string;
  region: string;
  industry: string;
  domain: string;
  path: { to: PipelineStatus; by: "agent" | "owner"; reason: string }[];
  opportunity?: number;
  site?: number;
  issues?: string[];
  value?: number;
  message?: { positive: string; opportunity: string; benefit: string };
};

const samples: Sample[] = [
  {
    name: "Estudio Jurídico Ribera (ejemplo)",
    city: "Córdoba",
    region: "Córdoba",
    industry: "Estudios jurídicos",
    domain: "ribera-abogados.example",
    opportunity: 82,
    site: 38,
    issues: [
      "El sitio no se adapta al celular",
      "El formulario de consultas no confirma el envío",
      "No hay un llamado a la acción claro para pedir una consulta",
    ],
    value: 4500,
    path: [
      { to: "RESEARCHING", by: "agent", reason: "Ejemplo: comienza la investigación" },
      { to: "QUALIFIED", by: "agent", reason: "Ejemplo: rubro objetivo y supera el puntaje mínimo" },
      { to: "AUDITED", by: "agent", reason: "Ejemplo: auditoría completada" },
      { to: "DEMO_GENERATING", by: "agent", reason: "Ejemplo: se genera la demo" },
      { to: "DEMO_READY", by: "agent", reason: "Ejemplo: demo lista" },
      { to: "OUTREACH_READY", by: "agent", reason: "Ejemplo: mensajes preparados" },
    ],
    message: {
      positive: "tienen más de 25 años de trayectoria y una especialización clara en derecho laboral y societario",
      opportunity: "el sitio no se adapta al celular y el formulario de consultas no confirma si el mensaje llegó",
      benefit: "resolverlo haría que más empresas pidan una consulta desde el teléfono, con la seguridad de que su pedido fue recibido",
    },
  },
  {
    name: "Clínica Norte Salud (ejemplo)",
    city: "Rosario",
    region: "Santa Fe",
    industry: "Clínicas y centros médicos privados",
    domain: "clinica-norte.example",
    opportunity: 77,
    site: 45,
    issues: ["Los turnos se piden solo por teléfono", "Carga lenta en celulares", "Sin información por especialidad"],
    value: 6000,
    path: [
      { to: "RESEARCHING", by: "agent", reason: "Ejemplo: comienza la investigación" },
      { to: "QUALIFIED", by: "agent", reason: "Ejemplo: rubro objetivo con potencial de sistema de turnos" },
      { to: "AUDITED", by: "agent", reason: "Ejemplo: auditoría completada" },
    ],
  },
  {
    name: "Desarrolladora Altos del Sur (ejemplo)",
    city: "Mendoza",
    region: "Mendoza",
    industry: "Desarrolladoras inmobiliarias",
    domain: "altos-del-sur.example",
    path: [],
  },
  {
    name: "Hotel Mirador Andino (ejemplo)",
    city: "San Carlos de Bariloche",
    region: "Río Negro",
    industry: "Hoteles y turismo",
    domain: "mirador-andino.example",
    opportunity: 35,
    site: 84,
    issues: ["El sitio actual ya cumple bien su función comercial"],
    path: [
      { to: "RESEARCHING", by: "agent", reason: "Ejemplo: comienza la investigación" },
      { to: "REJECTED", by: "agent", reason: "Ejemplo: el sitio actual ya funciona bien; baja oportunidad" },
    ],
  },
];

try {
  if (values.borrar) {
    const res = await db
      .update(prospects)
      .set({ deletedAt: new Date() })
      .where(and(eq(prospects.isSample, true)))
      .returning({ id: prospects.id });
    console.log(`✔ ${res.length} prospecto(s) de ejemplo retirados (borrado lógico).`);
  } else {
    const [owner] = await db.select().from(users).where(eq(users.role, "owner")).limit(1);
    if (!owner) throw new Error("Primero creá un propietario con npm run user:create.");
    const ownerP: Principal = { kind: "user", id: owner.id, role: "owner", name: owner.name, email: owner.email };
    const agentP: Principal = { kind: "agent", name: "ejemplo" };

    for (const s of samples) {
      const p = await createProspect(
        db,
        ownerP,
        {
          name: s.name,
          country: "AR",
          region: s.region,
          city: s.city,
          language: "es-AR",
          industry: s.industry,
          websiteUrl: `https://${s.domain}`,
          currency: s.value ? "USD" : null,
          estimatedValue: s.value ?? null,
        },
        { isSample: true },
      );
      await db
        .update(prospects)
        .set({
          opportunityScore: s.opportunity ?? null,
          siteScore: s.site ?? null,
          mainIssues: s.issues ?? [],
          recommendedSolution: s.opportunity && s.opportunity > 60 ? "Ejemplo: sitio responsive con sistema de consultas y turnos en línea" : null,
        })
        .where(eq(prospects.id, p.id));

      await addFact(db, agentP, {
        prospectId: p.id,
        category: "contact",
        field: "Email comercial",
        value: `contacto@${s.domain}`,
        kind: "observed",
        verification: "probable",
        confidence: 50,
        sourceName: "DATO DE EJEMPLO — ficticio",
        sourceUrl: `https://${s.domain}/contacto`,
      });
      await addFact(db, agentP, {
        prospectId: p.id,
        category: "business",
        field: "Público objetivo",
        value: "Ejemplo: empresas y particulares que buscan el servicio desde el celular",
        kind: "inference",
        verification: "unconfirmed",
        confidence: 40,
        sourceName: "DATO DE EJEMPLO — ficticio",
      });

      let version = p.version;
      for (const step of s.path) {
        const who = step.by === "agent" ? agentP : ownerP;
        const updated = await transitionProspect(db, who, {
          prospectId: p.id,
          to: step.to,
          reason: step.reason,
          expectedVersion: version,
        });
        version = updated.version;
      }
      if (s.message) {
        try {
          await generateMessages(db, agentP, p.id, s.message);
        } catch (e) {
          console.log(`  (sin mensajes de ejemplo: ${(e as Error).message})`);
        }
      }
      console.log(`✔ ${s.name}`);
    }
    console.log("Listo. Estos prospectos son ficticios y el panel los marca como EJEMPLO.");
  }
} catch (err) {
  console.error(`✖ ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
