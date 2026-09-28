import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import {
  allowedTargets,
  STATUS_GROUP,
  STATUS_LABELS,
  type PipelineStatus,
} from "@/domain/pipeline";
import {
  FACT_CATEGORY_LABELS,
  FACT_VERIFICATION_LABELS,
  FACT_KINDS,
} from "@/domain/validation";
import { requireUser } from "@/server/auth/current";
import { can, NotFoundError } from "@/server/principal";
import { getProspect, listEvents, listFacts, listNotes } from "@/server/services/prospects";
import { notFound } from "next/navigation";
import { Country, ExternalLink, formatMoney, Score, Status, When } from "../../../ui/format";
import { FactForm, NoteForm, PauseForm, RemoveFactForm, TransitionForm } from "../forms";

export const metadata: Metadata = { title: "Prospecto" };

const TABS = [
  { key: "empresa", label: "Empresa" },
  { key: "investigacion", label: "Investigación" },
  { key: "auditoria", label: "Auditoría web", stage: 3 },
  { key: "capturas", label: "Capturas", stage: 3 },
  { key: "demo", label: "Demo", stage: 4 },
  { key: "contactos", label: "Contactos" },
  { key: "propuesta", label: "Propuesta", stage: 4 },
  { key: "mensajes", label: "Mensajes", stage: 4 },
  { key: "historial", label: "Historial" },
  { key: "notas", label: "Notas" },
  { key: "presupuesto", label: "Presupuesto", stage: 5 },
  { key: "proyecto", label: "Proyecto técnico", stage: 5 },
  { key: "seguridad", label: "Seguridad y SEO", stage: 6 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const UPCOMING: Record<string, { title: string; items: string[] }> = {
  auditoria: {
    title: "La auditoría automática llega en la etapa 3",
    items: [
      "Puntaje de 0 a 100 en diseño, experiencia móvil, velocidad, SEO técnico, accesibilidad, conversión y más",
      "Principales problemas y fortalezas, redactados sin lenguaje despectivo",
      "Nivel de urgencia, esfuerzo estimado y recomendación: contactar, observar o descartar",
    ],
  },
  capturas: {
    title: "Las capturas llegan en la etapa 3",
    items: ["Captura del sitio actual en escritorio y celular", "Fecha y hora de cada captura"],
  },
  demo: {
    title: "El generador de demos llega en la etapa 4",
    items: [
      "Demo conceptual con noindex, protegida y marcada como propuesta no oficial",
      "Versiones: ninguna demo se sobrescribe",
      "Comparador antes y después",
    ],
  },
  propuesta: {
    title: "Las propuestas llegan en la etapa 4",
    items: ["Tres mejoras principales", "Beneficio comercial explicado", "Enlace a la demo"],
  },
  mensajes: {
    title: "Los mensajes llegan en la etapa 4",
    items: [
      "Tres asuntos posibles, email HTML y texto plano",
      "Versiones para WhatsApp, formulario web, Instagram y LinkedIn",
      "Sugerencia de canal y horario. El sistema nunca envía: vos copiás y enviás",
    ],
  },
  presupuesto: {
    title: "El presupuesto detallado llega en la etapa 5",
    items: ["Alcance, funciones incluidas y no incluidas", "Cronograma y criterios de aceptación"],
  },
  proyecto: {
    title: "El proyecto técnico llega en la etapa 5",
    items: ["Plan de construcción, staging y QA", "Plan de migración y de rollback"],
  },
  seguridad: {
    title: "Seguridad y SEO llegan en la etapa 6",
    items: [
      "Inventario de URLs, metadatos y redirecciones antes de migrar",
      "Backups con restauración probada",
      "Seguimiento a 7, 30, 60 y 90 días",
    ],
  },
};

const KIND_GROUP_TITLES = {
  observed: "Hechos observados",
  inference: "Inferencias razonables",
  hypothesis: "Hipótesis a confirmar",
} as const;

// Recorrido principal para dibujar la línea de estaciones.
const MAIN_ROUTE: PipelineStatus[] = [
  "DISCOVERED",
  "RESEARCHING",
  "QUALIFIED",
  "AUDITED",
  "DEMO_READY",
  "OUTREACH_READY",
  "SENT_MANUALLY",
  "WAITING_RESPONSE",
  "REPLIED_POSITIVE",
  "PROPOSAL_SENT",
  "APPROVED",
  "BUILDING",
  "QA",
  "DEPLOYED",
  "MAINTENANCE",
];

export default async function ProspectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const me = await requireUser("prospects.read");
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? "empresa") as TabKey;
  const db = getDb();

  let data;
  try {
    data = await getProspect(db, me, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { p, ownerName } = data;
  const [events, facts, notes] = await Promise.all([
    listEvents(db, me, p.id),
    listFacts(db, me, p.id),
    listNotes(db, me, p.id),
  ]);
  const visited = new Set(events.map((e) => e.toStatus));
  const targets = can(me, "prospects.transition")
    ? allowedTargets(p.status, { type: "user", role: me.role })
    : [];
  const verifiedCount = facts.filter((f) => f.verification === "verified").length;

  return (
    <>
      <div className="prospect-head">
        <Link href="/panel/oportunidades" className="faint">
          ← Oportunidades
        </Link>
        <div className="page-head">
          <div>
            <h1>
              {p.name} {p.isSample && <span className="tag tag-sample">Ejemplo ficticio</span>}{" "}
              {p.paused && <span className="tag tag-paused">Pausado</span>}
            </h1>
            <div className="meta">
              <Status status={p.status} />
              <span>
                {p.city ? `${p.city}, ` : ""}
                <Country code={p.country} />
              </span>
              {p.industry && <span>{p.industry}</span>}
              {p.websiteUrl && <ExternalLink href={p.websiteUrl}>Ver sitio actual</ExternalLink>}
            </div>
          </div>
        </div>
        <div className="route-wrap">
          <p className="route-caption">
            {MAIN_ROUTE.includes(p.status) ? (
              <>
                Paso {MAIN_ROUTE.indexOf(p.status) + 1} de {MAIN_ROUTE.length}: <strong>{STATUS_LABELS[p.status]}</strong>
              </>
            ) : (
              <>
                Fuera del recorrido principal: <strong>{STATUS_LABELS[p.status]}</strong>
              </>
            )}
          </p>
          <ol className="route" aria-label="Recorrido comercial">
            {MAIN_ROUTE.map((s) => {
              const here = s === p.status;
              const done = visited.has(s) && !here;
              return (
                <li
                  key={s}
                  className={`route-stop g-${STATUS_GROUP[s]} ${done ? "done" : ""} ${here ? "here" : ""}`}
                  title={STATUS_LABELS[s]}
                >
                  <span className="route-dot" aria-hidden="true" />
                  <span className="sr-only">
                    {STATUS_LABELS[s]}
                    {here ? " (actual)" : done ? " (completado)" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {sp.nuevo && (
        <p className="notice notice-ok" role="status">
          Prospecto guardado. Agregá ahora los datos que encontraste, cada uno con su fuente.
        </p>
      )}

      <nav className="tabs" aria-label="Secciones del prospecto">
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>
            {t.label}
            {"stage" in t && <span className="soon"> · etapa {t.stage}</span>}
          </Link>
        ))}
      </nav>

      <div className="detail-grid">
        <div className="stack">
          {tab === "empresa" && (
            <section className="panel stack" aria-labelledby="t-empresa">
              <h2 id="t-empresa">Empresa</h2>
              <dl className="dl">
                <dt>Nombre comercial</dt>
                <dd>{p.name}</dd>
                <dt>Razón social</dt>
                <dd>{p.legalName ?? <span className="faint">No verificado</span>}</dd>
                <dt>Rubro</dt>
                <dd>{p.industry ?? <span className="faint">—</span>}</dd>
                <dt>Ubicación</dt>
                <dd>
                  {[p.city, p.region].filter(Boolean).join(", ")}
                  {p.city || p.region ? " · " : ""}
                  <Country code={p.country} />
                </dd>
                <dt>Idioma</dt>
                <dd>{p.language ?? <span className="faint">—</span>}</dd>
                <dt>Sitio actual</dt>
                <dd>
                  <ExternalLink href={p.websiteUrl} />
                </dd>
                <dt>Puntaje de oportunidad</dt>
                <dd>
                  <Score value={p.opportunityScore} label="Puntaje de oportunidad" />
                </dd>
                <dt>Puntaje del sitio</dt>
                <dd>
                  <Score value={p.siteScore} label="Puntaje del sitio" />
                </dd>
                <dt>Solución recomendada</dt>
                <dd>{p.recommendedSolution ?? <span className="faint">Todavía sin analizar</span>}</dd>
                <dt>Datos cargados</dt>
                <dd>
                  {facts.length} ({verifiedCount} verificados) · última verificación{" "}
                  <When date={p.lastVerifiedAt} />
                </dd>
                <dt>Responsable</dt>
                <dd>{ownerName ?? "Agente automático"}</dd>
                <dt>Descubierto</dt>
                <dd>
                  <When date={p.discoveredAt} />
                </dd>
              </dl>
            </section>
          )}

          {tab === "investigacion" && (
            <section className="stack" aria-labelledby="t-inv">
              <h2 id="t-inv">Investigación</h2>
              <p className="muted">
                Los datos se separan en hechos observados, inferencias y hipótesis. Solo un hecho observado con URL de
                fuente puede figurar como verificado.
              </p>
              {FACT_KINDS.map((kind) => {
                const list = facts.filter((f) => f.kind === kind);
                return (
                  <div key={kind} className="panel facts-group">
                    <h3>
                      {KIND_GROUP_TITLES[kind]} <span className="faint">({list.length})</span>
                    </h3>
                    {list.length === 0 ? (
                      <p className="faint">Ninguno todavía.</p>
                    ) : (
                      list.map((f) => <FactItem key={f.id} f={f} canEdit={can(me, "facts.write")} />)
                    )}
                  </div>
                );
              })}
              {can(me, "facts.write") && (
                <section className="panel stack" aria-labelledby="add-fact">
                  <h3 id="add-fact">Agregar dato con fuente</h3>
                  <FactForm prospectId={p.id} />
                </section>
              )}
            </section>
          )}

          {tab === "contactos" && (
            <section className="stack" aria-labelledby="t-contact">
              <h2 id="t-contact">Contactos</h2>
              <p className="muted">
                Solo medios de contacto empresariales publicados por la empresa. Nunca listas filtradas ni datos
                personales sensibles.
              </p>
              <div className="panel facts-group">
                {facts.filter((f) => f.category === "contact").length === 0 ? (
                  <p className="faint">No hay contactos cargados.</p>
                ) : (
                  facts
                    .filter((f) => f.category === "contact")
                    .map((f) => <FactItem key={f.id} f={f} canEdit={can(me, "facts.write")} />)
                )}
              </div>
              {can(me, "facts.write") && (
                <section className="panel stack" aria-labelledby="add-contact">
                  <h3 id="add-contact">Agregar contacto con fuente</h3>
                  <FactForm prospectId={p.id} defaultCategory="contact" />
                </section>
              )}
            </section>
          )}

          {tab === "historial" && (
            <section className="panel stack" aria-labelledby="t-hist">
              <h2 id="t-hist">Historial</h2>
              <ol className="timeline">
                {events.map((e) => (
                  <li key={e.id} className={`g-${STATUS_GROUP[e.toStatus]}`}>
                    <div>
                      <strong>{e.fromStatus ? `${STATUS_LABELS[e.fromStatus]} → ` : ""}{STATUS_LABELS[e.toStatus]}</strong>
                    </div>
                    <div className="when">
                      <When date={e.createdAt} /> · {e.actorLabel}
                    </div>
                    <div>Motivo: {e.reason}</div>
                    {e.nextStep && <div className="muted">Próximo paso: {e.nextStep}</div>}
                  </li>
                ))}
              </ol>
              <p className="faint">El historial no se puede editar ni borrar.</p>
            </section>
          )}

          {tab === "notas" && (
            <section className="panel stack" aria-labelledby="t-notas">
              <h2 id="t-notas">Notas</h2>
              {can(me, "notes.write") && <NoteForm prospectId={p.id} />}
              {notes.length === 0 ? (
                <p className="faint">Sin notas.</p>
              ) : (
                <div>
                  {notes.map(({ n, author }) => (
                    <article key={n.id} className="note">
                      <div className="faint">
                        {author} · <When date={n.createdAt} />
                      </div>
                      <p className="note-body">{n.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "presupuesto" && (
            <section className="panel stack" aria-labelledby="t-pres">
              <h2 id="t-pres">Presupuesto</h2>
              <dl className="dl">
                <dt>Valor estimado</dt>
                <dd>
                  {p.estimatedValue != null ? (
                    formatMoney(Number(p.estimatedValue), p.currency)
                  ) : (
                    <span className="faint">Sin estimar</span>
                  )}
                </dd>
                <dt>Valor confirmado</dt>
                <dd>
                  {p.confirmedValue != null ? (
                    formatMoney(Number(p.confirmedValue), p.currency)
                  ) : (
                    <span className="faint">Sin confirmar</span>
                  )}
                </dd>
              </dl>
              <Upcoming k="presupuesto" />
            </section>
          )}

          {tab === "auditoria" && (
            <section className="panel stack" aria-labelledby="t-aud">
              <h2 id="t-aud">Auditoría web</h2>
              {p.mainIssues.length > 0 && (
                <div className="stack">
                  <h3>Problemas registrados</h3>
                  <ul className="issues">
                    {p.mainIssues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Upcoming k="auditoria" />
            </section>
          )}

          {["capturas", "demo", "propuesta", "mensajes", "proyecto", "seguridad"].includes(tab) && (
            <section className="panel">
              <Upcoming k={tab} />
            </section>
          )}
        </div>

        <aside className="side" aria-label="Acciones">
          <section className="panel stack">
            <h2>Cambiar estado</h2>
            <TransitionForm key={`t-${p.version}`} prospectId={p.id} version={p.version} targets={targets} />
          </section>
          {me.role !== "viewer" && (
            <section className="panel stack">
              <h2>{p.paused ? "Reanudar" : "Pausar"}</h2>
              <PauseForm key={`p-${p.version}`} prospectId={p.id} version={p.version} paused={p.paused} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

function Upcoming({ k }: { k: string }) {
  const u = UPCOMING[k];
  if (!u) return null;
  return (
    <div className="empty">
      <h3>{u.title}</h3>
      <p>Cuando esté disponible, esta sección va a mostrar:</p>
      <ul>
        {u.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

type Fact = Awaited<ReturnType<typeof listFacts>>[number];

function FactItem({ f, canEdit }: { f: Fact; canEdit: boolean }) {
  return (
    <article className={`fact k-${f.kind}`}>
      <div className="fact-head">
        <span className="fact-field">{f.field}</span>
        <span className="tag">{FACT_CATEGORY_LABELS[f.category]}</span>
        <span className={`v-${f.verification}`}>{FACT_VERIFICATION_LABELS[f.verification]}</span>
      </div>
      <div className="note-body">{f.value}</div>
      <div className="fact-meta">
        <span>Confianza {f.confidence}/100</span>
        <span>Fuente: {f.sourceName ?? "sin nombre"}</span>
        {f.sourceUrl ? <ExternalLink href={f.sourceUrl}>Ver fuente</ExternalLink> : <span>Sin URL de fuente</span>}
        <span>
          Consultado: <When date={f.verifiedAt} />
        </span>
        <span>Por: {f.collectedByType === "agent" ? `agente ${f.collectedById}` : "persona del equipo"}</span>
      </div>
      {canEdit && (
        <details className="disclose">
          <summary className="faint">Retirar</summary>
          <RemoveFactForm factId={f.id} />
        </details>
      )}
    </article>
  );
}
