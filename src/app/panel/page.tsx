import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { PIPELINE_STATUSES, STATUS_GROUP, type StatusGroup } from "@/domain/pipeline";
import { requireUser } from "@/server/auth/current";
import { getOverview, type Money } from "@/server/services/dashboard";
import { can } from "@/server/principal";
import { formatMoney } from "../ui/format";

export const metadata: Metadata = { title: "Vista general" };

const GROUPS: { key: StatusGroup; label: string; sub: string }[] = [
  { key: "prospeccion", label: "Prospección", sub: "Investigación, auditoría y demo" },
  { key: "contacto", label: "Contacto", sub: "Mensajes y seguimiento" },
  { key: "venta", label: "Venta", sub: "Respuestas y propuestas" },
  { key: "proyecto", label: "Proyecto", sub: "Construcción a mantenimiento" },
  { key: "cerrado", label: "Cerrados", sub: "Descartados y cerrados" },
];

function MoneyValue({ list }: { list: Money[] }) {
  if (!list.length) return <span className="metric-n">—</span>;
  return (
    <span className="money-list">
      {list.map((m) => (
        <span key={m.currency ?? "x"} className="metric-n num">
          {formatMoney(m.amount, m.currency)}
        </span>
      ))}
    </span>
  );
}

function Metric({ n, label, tone, href }: { n: number; label: string; tone?: "attention" | "alert"; href?: string }) {
  const body = (
    <>
      <span className="metric-n num">{n}</span>
      <span className="metric-l">{label}</span>
    </>
  );
  return <div className={`metric ${n > 0 && tone ? tone : ""}`}>{href ? <Link href={href}>{body}</Link> : body}</div>;
}

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const o = await getOverview(getDb(), me);

  const perGroup = Object.fromEntries(GROUPS.map((g) => [g.key, 0])) as Record<StatusGroup, number>;
  for (const row of o.byStatus) {
    const s = row.status as (typeof PIPELINE_STATUSES)[number];
    perGroup[STATUS_GROUP[s]] += row.n;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vista general</h1>
          <p>
            Todas las cifras salen de la base de datos. Si todavía no hay actividad, se muestran en cero. Los
            prospectos de ejemplo quedan fuera.
          </p>
        </div>
        {can(me, "prospects.write") && (
          <Link className="btn btn-primary" href="/panel/oportunidades/nuevo">
            Cargar prospecto
          </Link>
        )}
      </div>

      {sp["sin-permiso"] && (
        <p className="notice notice-error" role="alert">
          Tu rol no tiene acceso a esa sección.
        </p>
      )}

      {o.pendingApprovals > 0 && (
        <p className="notice notice-signal">
          Hay {o.pendingApprovals} {o.pendingApprovals === 1 ? "acción esperando" : "acciones esperando"} tu
          aprobación. <Link href="/panel/aprobaciones">Revisar aprobaciones</Link>
        </p>
      )}

      <section className="section" aria-labelledby="recorrido">
        <div className="section-head">
          <h2 id="recorrido">Dónde están los prospectos hoy</h2>
          <span className="faint">{o.totalProspects} en total</span>
        </div>
        <div className="panel">
          <div className="track">
            {GROUPS.map((g) => (
              <Link key={g.key} href={`/panel/oportunidades?group=${g.key}`} className={`stop g-${g.key}`}>
                <span className="stop-dot" aria-hidden="true" />
                <span className="stop-n num">{perGroup[g.key]}</span>
                <span className="stop-label">{g.label}</span>
                <span className="stop-sub">{g.sub}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {o.totalProspects === 0 && (
        <section className="section">
          <div className="empty">
            <h3>Todavía no hay prospectos reales</h3>
            <p>
              La búsqueda automática de empresas se habilita cuando elijas una fuente de datos. Mientras tanto podés
              cargar empresas a mano y pedir su auditoría web: cada dato queda con su fuente, fecha y nivel de
              verificación.
            </p>
            {can(me, "prospects.write") && (
              <Link className="btn" href="/panel/oportunidades/nuevo">
                Cargar el primer prospecto
              </Link>
            )}
            {o.sampleProspects > 0 && (
              <p className="faint">
                Hay {o.sampleProspects} prospectos de ejemplo cargados para probar el panel. Son ficticios y no suman
                a estas cifras.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="prospeccion">
        <h2 id="prospeccion">Prospección</h2>
        <div className="metrics">
          <Metric n={o.foundToday} label="Empresas encontradas hoy" />
          <Metric n={o.qualified} label="Prospectos calificados" />
          <Metric n={o.demosGenerated} label="Demos generadas" />
          <Metric n={o.messagesPrepared} label="Mensajes preparados" />
        </div>
      </section>

      <section className="section" aria-labelledby="comercial">
        <h2 id="comercial">Comercial</h2>
        <div className="metrics">
          <Metric n={o.sentManually} label="Mensajes enviados a mano" />
          <Metric n={o.responses.positive} label="Respuestas positivas" />
          <Metric n={o.responses.negative} label="Respuestas negativas" />
          <div className="metric">
            <MoneyValue list={o.potentialRevenue} />
            <span className="metric-l">Ingresos potenciales (prospectos abiertos)</span>
          </div>
          <div className="metric">
            <MoneyValue list={o.confirmedRevenue} />
            <span className="metric-l">Ingresos confirmados</span>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="proyectos">
        <h2 id="proyectos">Proyectos</h2>
        <div className="metrics">
          <Metric n={o.approvedProjects} label="Proyectos aprobados" />
          <Metric n={o.inConstruction} label="En construcción" />
          <Metric n={o.delivered} label="Entregados" />
        </div>
      </section>

      <section className="section" aria-labelledby="operacion">
        <h2 id="operacion">Operación</h2>
        <div className="metrics">
          <Metric n={o.pendingApprovals} label="Aprobaciones pendientes" tone="attention" href="/panel/aprobaciones" />
          <Metric n={o.blockedTasks} label="Tareas fallidas o bloqueadas" tone="attention" href="/panel/tareas?status=problemas" />
          <Metric
            n={o.securityAlerts}
            label="Alertas de seguridad (7 días)"
            tone="alert"
            href={can(me, "audit.read") ? "/panel/actividad" : undefined}
          />
        </div>
        <p className="faint">
          &ldquo;Encontradas hoy&rdquo; usa la zona horaria {o.timezone}. Las tareas fallidas o bloqueadas son trabajos de
          agentes que necesitan que alguien los revise.
        </p>
      </section>
    </>
  );
}
