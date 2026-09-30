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
import { AUDIT_AGENT, getAudit, listAudits } from "@/server/services/audits";
import { latestRunFor, monthSpendUsd, RUN_STATUS_LABELS } from "@/server/services/agent-runs";
import { latestResearch, RESEARCH_AGENT } from "@/server/services/research";
import { getSettings } from "@/server/services/settings";
import { aiConfigured } from "@/agents/ai";
import { RESEARCH_ESTIMATED_COST_USD } from "@/domain/research";
import type { Opportunity } from "@/domain/opportunity";
import { detectUpsells, type Upsell } from "@/domain/upsell";
import { latestMessages } from "@/server/services/outreach";
import { isClient, latestBrief, listBrandAssets, listBuilds } from "@/server/services/site";
import { emptyBrief } from "@/domain/site";
import { SITE_COPY_ESTIMATED_COST_USD } from "@/domain/site-copy";
import { BrandAssetForm, BriefEditor, BuildSiteForm, SiteCopyForm } from "../site-forms";
import { CopyButton } from "../../../ui/copy-button";
import { AUDIT_CATEGORIES, type CategoryKey, type CategoryResult, type Check, type Recommendation } from "@/domain/site-audit";
import { notFound } from "next/navigation";
import { Country, ExternalLink, formatMoney, Score, Status, When } from "../../../ui/format";
import { AuditRequestForm, PrepareMessagesForm, ResearchRequestForm, FactForm, NoteForm, PauseForm, RemoveFactForm, TransitionForm } from "../forms";

export const metadata: Metadata = { title: "Prospecto" };
// Auditoría e investigación pedidas desde esta página se ejecutan al momento (la investigación con IA
// puede tardar un par de minutos). 300 s es el máximo por defecto de Vercel en todos los planes:
// https://vercel.com/docs/functions/limitations (consultado el 29/09/2026).
export const maxDuration = 300;

const TABS = [
  { key: "empresa", label: "Empresa" },
  { key: "investigacion", label: "Investigación" },
  { key: "auditoria", label: "Auditoría web" },
  { key: "capturas", label: "Capturas", stage: 3 },
  { key: "contactos", label: "Contactos" },
  { key: "mensajes", label: "Mensajes" },
  { key: "historial", label: "Historial" },
  { key: "notas", label: "Notas" },
  { key: "presupuesto", label: "Presupuesto", stage: 5 },
  { key: "sitio", label: "Sitio web" },
  { key: "proyecto", label: "Proyecto técnico", stage: 5 },
  { key: "seguridad", label: "Seguridad y SEO", stage: 6 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const UPCOMING: Record<string, { title: string; items: string[] }> = {
  capturas: {
    title: "Las capturas llegan en el próximo bloque de la etapa 3",
    items: [
      "Captura del sitio actual en escritorio y celular, con fecha y hora",
      "Requieren un navegador en el servidor: se habilitan cuando se defina dónde corre el worker",
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
  const auditVersion = Number(sp.v) > 0 ? Math.floor(Number(sp.v)) : undefined;
  const [events, facts, notes, auditData] = await Promise.all([
    listEvents(db, me, p.id),
    listFacts(db, me, p.id),
    listNotes(db, me, p.id),
    tab === "auditoria"
      ? Promise.all([getAudit(db, me, p.id, auditVersion), listAudits(db, me, p.id), latestRunFor(db, me, p.id, AUDIT_AGENT)])
      : null,
  ]);
  const messages = tab === "mensajes" ? await latestMessages(db, me, p.id) : null;
  const upsellData =
    tab === "empresa"
      ? detectUpsells(
          facts,
          can(me, "finance.read") ? (await getSettings(db, me)).data.pricing.items : [],
        )
      : null;
  const researchData =
    tab === "investigacion"
      ? await Promise.all([
          latestResearch(db, me, p.id),
          latestRunFor(db, me, p.id, RESEARCH_AGENT),
          getSettings(db, me).then(async (s) => ({ budget: s.data.apiBudgetUsdMonthly, spent: await monthSpendUsd(db, s.data.schedule.timezone) })),
        ])
      : null;
  const siteData =
    tab === "sitio" ? await Promise.all([listBrandAssets(db, me, p.id), latestBrief(db, me, p.id), listBuilds(db, me, p.id)]) : null;
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
                  <OpportunityBreakdown explanation={p.scoreExplanation as Opportunity | null} />
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
          {tab === "empresa" && upsellData && (
            <UpsellPanel upsells={upsellData} />
          )}

          {tab === "investigacion" && (
            <section className="stack" aria-labelledby="t-inv">
              <h2 id="t-inv">Investigación</h2>
              <p className="muted">
                Los datos se separan en hechos observados, inferencias y hipótesis. Solo un hecho observado con URL de
                fuente puede figurar como verificado.
              </p>
              {researchData && (
                <ResearchPanel
                  prospectId={p.id}
                  hasWebsite={!!p.websiteUrl}
                  isSample={p.isSample}
                  canRequest={can(me, "prospects.write")}
                  research={researchData[0]}
                  run={researchData[1]}
                  budget={researchData[2]}
                />
              )}
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

          {tab === "auditoria" && auditData && (
            <AuditTab
              prospectId={p.id}
              hasWebsite={!!p.websiteUrl}
              isSample={p.isSample}
              canRequest={can(me, "prospects.write")}
              audit={auditData[0]}
              versions={auditData[1]}
              run={auditData[2]}
            />
          )}

          {tab === "mensajes" && (
            <MessagesTab prospectId={p.id} isSample={p.isSample} canWrite={can(me, "prospects.write")} messages={messages} />
          )}

          {tab === "sitio" && siteData && (
            <SiteTab
              prospectId={p.id}
              name={p.name}
              status={p.status}
              isSample={p.isSample}
              canWrite={can(me, "prospects.write")}
              facts={facts}
              assets={siteData[0]}
              brief={siteData[1]}
              builds={siteData[2]}
              savedVersion={Number(sp.ficha) > 0 ? Math.floor(Number(sp.ficha)) : null}
            />
          )}

          {["capturas", "proyecto", "seguridad"].includes(tab) && (
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

// ─────────────────────────── Sitio web ───────────────────────────

const QUALITY_ICON = { ok: "✓", aviso: "!", falla: "✕" } as const;

function knownContacts(facts: Fact[]) {
  const find = (re: RegExp) => facts.find((f) => f.category === "contact" && re.test(f.field))?.value.split("\n")[0]?.trim() ?? "";
  const email = find(/email|correo/i);
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    phone: find(/tel[eé]fono/i).slice(0, 40),
    whatsapp: find(/whatsapp/i).replace(/\D/g, "").slice(0, 15),
    address: facts.find((f) => /direcci[oó]n|domicilio/i.test(f.field))?.value.slice(0, 200) ?? "",
  };
}

function SiteTab({
  prospectId,
  name,
  status,
  isSample,
  canWrite,
  facts,
  assets,
  brief,
  builds,
  savedVersion,
}: {
  savedVersion: number | null;
  prospectId: string;
  name: string;
  status: PipelineStatus;
  isSample: boolean;
  canWrite: boolean;
  facts: Fact[];
  assets: Awaited<ReturnType<typeof listBrandAssets>>;
  brief: Awaited<ReturnType<typeof latestBrief>>;
  builds: Awaited<ReturnType<typeof listBuilds>>;
}) {
  if (isSample || !isClient(status)) {
    return (
      <section className="panel stack" aria-labelledby="t-sitio">
        <h2 id="t-sitio">Sitio web del cliente</h2>
        <div className="empty">
          <h3>Se habilita cuando la empresa ya es cliente</h3>
          <p>
            Estado actual: <strong>{STATUS_LABELS[status]}</strong>. Cuando acepte el presupuesto, pasalo a <strong>Proyecto aprobado</strong> y pedile
            su logo, colores, fotos y textos. Así el sitio usa su identidad real y con su autorización.
          </p>
        </div>
      </section>
    );
  }
  const initial = brief
    ? { brand: brief.brand, content: brief.content, authorizationNote: brief.authorizationNote }
    : { ...emptyBrief(name, knownContacts(facts)), authorizationNote: "" };
  const latest = builds[0];
  return (
    <>
      <section className="panel stack" aria-labelledby="t-sitio">
        <h2 id="t-sitio">Sitio web del cliente</h2>
        <p className="faint">
          Plantilla profesional con la identidad del cliente: su logo, sus colores y sus fotos. HTML y CSS limpios, sin JavaScript, sin menciones a IA
          ni créditos agregados. Solo se puede descargar si pasa el control de calidad.
        </p>
        {latest ? (
          <div className="site-latest">
            <div>
              <strong>Última versión: v{latest.version}</strong> · <When date={latest.createdAt} />{" "}
              <span className={latest.ready ? "tag tag-ok" : "tag tag-bad"}>{latest.ready ? "Lista para entregar" : "Con problemas"}</span>
            </div>
            <div className="form-actions">
              <a className="btn" href={`/api/sitios/${latest.id}/vista`} target="_blank" rel="noopener">
                Ver vista previa
              </a>
              {latest.ready && (
                <a className="btn btn-primary" href={`/api/sitios/${latest.id}/zip`}>
                  Descargar sitio (.zip)
                </a>
              )}
            </div>
            <ul className="quality">
              {latest.quality.checks.map((c) => (
                <li key={c.id} className={`q-${c.status}`}>
                  <span aria-hidden="true">{QUALITY_ICON[c.status]}</span>
                  <div>
                    <strong>{c.label}</strong>
                    <span className="cell-sub">{c.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="faint">Todavía no se generó ninguna versión.</p>
        )}
        {canWrite && brief && (
          <div className="form-actions site-actions">
            <BuildSiteForm prospectId={prospectId} />
            {aiConfigured() && <SiteCopyForm prospectId={prospectId} maxCostUsd={SITE_COPY_ESTIMATED_COST_USD} />}
          </div>
        )}
        {builds.length > 1 && (
          <details>
            <summary>Versiones anteriores ({builds.length - 1})</summary>
            <ul className="quote-list">
              {builds.slice(1).map((b) => (
                <li key={b.id}>
                  <a href={`/api/sitios/${b.id}/vista`} target="_blank" rel="noopener">
                    v{b.version}
                  </a>{" "}
                  <span className="cell-sub">
                    <When date={b.createdAt} /> · {b.ready ? "lista" : "con problemas"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {canWrite && (
        <>
          <section className="panel stack" aria-labelledby="t-marca">
            <h2 id="t-marca">Logo y fotos del cliente</h2>
            {assets.length > 0 && (
              <ul className="asset-grid">
                {assets.map((a) => (
                  <li key={a.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/marca/${a.id}`} alt={a.alt || "Logo"} />
                    <span className="cell-sub">
                      {a.kind === "logo" ? "Logo" : a.alt} · {a.width}×{a.height}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <BrandAssetForm prospectId={prospectId} />
          </section>

          <section className="panel stack" aria-labelledby="t-ficha">
            <h2 id="t-ficha">Ficha del sitio {brief ? `(v${brief.version}${brief.createdByType === "agent" ? ", textos pulidos con IA" : ""})` : ""}</h2>
            {savedVersion && brief?.version === savedVersion && (
              <p className="notice notice-ok" role="status">
                Ficha v{savedVersion} guardada. Ahora podés generar el sitio.
              </p>
            )}
            <BriefEditor key={brief?.id ?? "nueva"} prospectId={prospectId} initial={initial} assets={assets} />
          </section>
        </>
      )}
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

// ─────────────────────────── Auditoría ───────────────────────────

const CHECK_LABEL: Record<Check["status"], string> = { pass: "Bien", warn: "Mejorable", fail: "Problema", info: "Dato" };
const REC_LABEL: Record<Recommendation["action"], string> = { contactar: "Contactar", observar: "Observar", descartar: "Descartar" };

type AuditRow = NonNullable<Awaited<ReturnType<typeof getAudit>>>;

function AuditTab({
  prospectId,
  hasWebsite,
  isSample,
  canRequest,
  audit,
  versions,
  run,
}: {
  prospectId: string;
  hasWebsite: boolean;
  isSample: boolean;
  canRequest: boolean;
  audit: AuditRow | null;
  versions: Awaited<ReturnType<typeof listAudits>>;
  run: Awaited<ReturnType<typeof latestRunFor>>;
}) {
  const latest = versions[0]?.version;
  const showRun = run && run.status !== "succeeded" && (!audit || run.createdAt > audit.createdAt);
  return (
    <section className="stack" aria-labelledby="t-aud">
      <div className="section-head">
        <h2 id="t-aud">Auditoría web</h2>
        {canRequest && hasWebsite && !isSample && <AuditRequestForm prospectId={prospectId} again={!!audit} />}
      </div>
      <p className="muted">
        Mediciones técnicas objetivas, sin IA. Solo se puntúa lo que se puede medir; diseño, claridad comercial, contenido
        y potencial de automatización quedan para revisión humana o del agente de investigación.
      </p>

      {!hasWebsite && <p className="notice">El prospecto no tiene sitio web cargado.</p>}
      {isSample && <p className="notice">Es un prospecto de ejemplo con dominio ficticio: no se audita.</p>}

      {showRun && run && (
        <p className={`notice ${run.status === "failed" || run.status === "blocked" ? "notice-error" : ""}`} role="status">
          Última tarea: <strong>{RUN_STATUS_LABELS[run.status]}</strong> (intento {run.attempt}/{run.maxAttempts})
          {run.error ? ` · ${run.error}` : ""} · <Link href="/panel/tareas">Ver tareas</Link>
        </p>
      )}

      {!audit ? (
        hasWebsite && !isSample && (
          <div className="empty">
            <h3>Todavía no hay auditoría</h3>
            <p>
              Se lee la página principal respetando robots.txt, se revisan hasta 8 enlaces internos y se guarda el
              resultado como versión 1. Las siguientes nunca reemplazan a las anteriores.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="panel stack">
            <div className="audit-head">
              <div>
                <span className="faint">Puntaje técnico</span>
                <Score value={audit.siteScore} label="Puntaje técnico del sitio" />
              </div>
              <Recommendation rec={audit.recommendation as Recommendation} />
            </div>
            <dl className="dl">
              <dt>Versión</dt>
              <dd>
                {audit.version}
                {audit.version !== latest && (
                  <>
                    {" "}
                    · <Link href="?tab=auditoria">ver la última (v{latest})</Link>
                  </>
                )}
              </dd>
              <dt>Leído</dt>
              <dd>
                <When date={audit.fetchedAt} />
              </dd>
              <dt>Dirección</dt>
              <dd>
                <ExternalLink href={audit.finalUrl} />
                {audit.finalUrl !== audit.requestedUrl && <span className="faint"> (pedida: {audit.requestedUrl})</span>}
              </dd>
              <dt>Respuesta</dt>
              <dd>
                HTTP {audit.httpStatus} · {audit.responseMs} ms · {Math.round(audit.htmlBytes / 1024)} KB de HTML
              </dd>
              <dt>Herramienta</dt>
              <dd>{audit.tool}</dd>
            </dl>
          </div>

          <div className="grid-2">
            <div className="panel stack">
              <h3>Principales problemas</h3>
              {audit.issues.length ? (
                <ul className="issues">
                  {audit.issues.slice(0, 8).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p className="faint">No se detectaron problemas en lo medible.</p>
              )}
            </div>
            <div className="panel stack">
              <h3>Fortalezas</h3>
              {audit.strengths.length ? (
                <ul className="issues">
                  {audit.strengths.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p className="faint">Ninguna destacada en lo medible.</p>
              )}
            </div>
          </div>

          <div className="panel stack">
            <h3>Por categoría</h3>
            <div className="cat-list">
              {AUDIT_CATEGORIES.map((c) => {
                const r = (audit.categories as Record<CategoryKey, CategoryResult>)[c.key];
                const checks = (audit.checks as Check[]).filter((k) => k.category === c.key);
                return (
                  <details key={c.key} className="cat" open={false}>
                    <summary>
                      <span className="cat-name">{c.label}</span>
                      {r?.score != null ? <Score value={r.score} label={c.label} /> : <span className="score-none">No evaluado</span>}
                    </summary>
                    {checks.length === 0 ? (
                      <p className="faint">{r?.note}</p>
                    ) : (
                      <ul className="checks">
                        {checks.map((k) => (
                          <li key={k.id} className={`check check-${k.status}`}>
                            <span className="check-status">{CHECK_LABEL[k.status]}</span>
                            <span>
                              <strong>{k.label}.</strong> {k.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                );
              })}
            </div>
          </div>

          {versions.length > 1 && (
            <div className="panel stack">
              <h3>Versiones</h3>
              <ol className="versions">
                {versions.map((v) => (
                  <li key={v.id}>
                    {v.version === audit.version ? (
                      <strong>v{v.version}</strong>
                    ) : (
                      <Link href={`?tab=auditoria&v=${v.version}`}>v{v.version}</Link>
                    )}{" "}
                    · <When date={v.createdAt} /> · puntaje {v.siteScore ?? "—"}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Recommendation({ rec }: { rec: Recommendation }) {
  return (
    <div className={`rec rec-${rec.action}`}>
      <span className="faint">Recomendación preliminar</span>
      <strong>
        {REC_LABEL[rec.action]} · urgencia {rec.urgency}
      </strong>
      <ul className="issues">
        {rec.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <span className="faint">El esfuerzo y el valor comercial se estiman con la investigación, no acá.</span>
    </div>
  );
}

// ─────────────────────────── Investigación con IA ───────────────────────────

type ResearchOut = {
  resumen: string;
  recomendacion: "qualify" | "reject" | "unsure";
  motivos: string[];
  paginas: { url: string; recortada: boolean }[];
  datosNuevos: number;
  datosDescartados: { field: string; value: string; reason: string }[];
};
const RESEARCH_REC: Record<ResearchOut["recomendacion"], string> = {
  qualify: "Calificar",
  reject: "Descartar (lo decidís vos)",
  unsure: "Falta información",
};

function ResearchPanel({
  prospectId,
  hasWebsite,
  isSample,
  canRequest,
  research,
  run,
  budget,
}: {
  prospectId: string;
  hasWebsite: boolean;
  isSample: boolean;
  canRequest: boolean;
  research: Awaited<ReturnType<typeof latestResearch>>;
  run: Awaited<ReturnType<typeof latestRunFor>>;
  budget: { budget: number; spent: number };
}) {
  const configured = aiConfigured();
  const out = research?.output as ResearchOut | undefined;
  const showRun = run && run.status !== "succeeded" && (!research || run.createdAt > research.createdAt);
  return (
    <div className="panel stack">
      <div className="section-head">
        <h3>Investigación con IA</h3>
        {canRequest && hasWebsite && !isSample && configured && budget.budget > 0 && (
          <ResearchRequestForm prospectId={prospectId} again={!!research} maxCostUsd={RESEARCH_ESTIMATED_COST_USD} />
        )}
      </div>
      {!configured && (
        <p className="notice">
          La IA no está conectada: falta la variable <code>ANTHROPIC_API_KEY</code> en el servidor.
        </p>
      )}
      {configured && budget.budget === 0 && (
        <p className="notice">
          El presupuesto mensual de IA está en US$ 0. Definilo en <Link href="/panel/configuracion">Configuración</Link> para habilitarla.
        </p>
      )}
      {budget.budget > 0 && (
        <p className="faint">
          Gastado este mes: US$ {budget.spent.toFixed(2)} de US$ {budget.budget.toFixed(2)}.
        </p>
      )}
      {showRun && run && (
        <p className={`notice ${run.status === "failed" || run.status === "blocked" ? "notice-error" : ""}`} role="status">
          Última tarea: <strong>{RUN_STATUS_LABELS[run.status]}</strong>
          {run.error ? ` · ${run.error}` : ""} · <Link href="/panel/tareas">Ver tareas</Link>
        </p>
      )}
      {out && research && (
        <>
          <p>{out.resumen}</p>
          <dl className="dl">
            <dt>Recomendación</dt>
            <dd>
              {RESEARCH_REC[out.recomendacion]}
              {out.motivos.length > 0 && (
                <ul className="issues">
                  {out.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>Páginas leídas</dt>
            <dd>
              {out.paginas.map((pg) => (
                <div key={pg.url}>
                  <ExternalLink href={pg.url} />
                  {pg.recortada && <span className="faint"> (recortada por largo)</span>}
                </div>
              ))}
            </dd>
            <dt>Datos</dt>
            <dd>
              {out.datosNuevos} nuevos · {out.datosDescartados.length} descartados por no poder verificarse
              {out.datosDescartados.length > 0 && (
                <details className="disclose">
                  <summary className="faint">Ver descartados</summary>
                  <ul className="issues">
                    {out.datosDescartados.map((d) => (
                      <li key={`${d.field}-${d.value}`}>
                        {d.field}: {d.value} — {d.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </dd>
            <dt>Hecha</dt>
            <dd>
              <When date={research.finishedAt} /> · {research.model} · US$ {Number(research.costUsd).toFixed(4)}
            </dd>
          </dl>
          <p className="faint">
            Lo que aporta la IA queda como probable o no verificado. Confirmalo antes de usarlo con un cliente.
          </p>
        </>
      )}
    </div>
  );
}

// ─────────────────────────── Puntaje de oportunidad ───────────────────────────

function OpportunityBreakdown({ explanation }: { explanation: Opportunity | null }) {
  if (!explanation?.criteria) {
    return <p className="faint">Se calcula solo cuando hay auditoría, investigación o datos cargados.</p>;
  }
  return (
    <details className="disclose">
      <summary className="faint">Cómo se calcula</summary>
      <ul className="checks">
        {explanation.criteria.map((c) => (
          <li key={c.key} className={`check ${c.score == null ? "check-info" : c.score >= 60 ? "check-pass" : c.score >= 30 ? "check-warn" : "check-fail"}`}>
            <span className="check-status">{c.score == null ? "Sin datos" : `${c.score}/100`}</span>
            <span>
              <strong>{c.label}</strong>
              {c.weight > 0 ? ` (peso ${c.weight})` : ""}. {c.detail}
            </span>
          </li>
        ))}
      </ul>
      <p className="faint">{explanation.note}</p>
    </details>
  );
}

// ─────────────────────────── Mensajes ───────────────────────────

type MessagesRow = Awaited<ReturnType<typeof latestMessages>>;

const CHANNEL_NAMES: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", form: "Formulario web", instagram: "Instagram", linkedin: "LinkedIn", ninguno: "Ninguno disponible" };

function MessagesTab({ prospectId, isSample, canWrite, messages }: { prospectId: string; isSample: boolean; canWrite: boolean; messages: MessagesRow }) {
  const m = messages?.content;
  return (
    <section className="stack" aria-labelledby="t-msg">
      <div className="section-head">
        <h2 id="t-msg">Mensajes</h2>
        {canWrite && !isSample && <PrepareMessagesForm prospectId={prospectId} again={!!messages} />}
      </div>
      <p className="muted">
        El sistema prepara los mensajes; nunca los envía. Revisalos, copialos, envialos vos y después marcá el prospecto como
        «Enviado manualmente» en Cambiar estado.
      </p>
      {!messages && !isSample && (
        <div className="empty">
          <h3>Todavía no hay mensajes</h3>
          <p>Conviene hacer antes la auditoría web: de ahí salen las tres mejoras concretas que se mencionan.</p>
        </div>
      )}
      {messages && m && (
        <>
          {m.warnings.length > 0 && (
            <div className="notice notice-signal">
              <strong>Antes de enviar:</strong>
              <ul className="issues">
                {m.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="panel stack">
            <dl className="dl">
              <dt>Canal sugerido</dt>
              <dd>
                {CHANNEL_NAMES[m.channel.suggested] ?? m.channel.suggested}. <span className="faint">{m.channel.reason}</span>
              </dd>
              <dt>Cuándo</dt>
              <dd>
                {m.bestTime.text} <span className="faint">{m.bestTime.basis}</span>
              </dd>
              <dt>Versión</dt>
              <dd>
                v{messages.version} · <When date={messages.createdAt} />
              </dd>
            </dl>
          </div>
          <div className="panel stack">
            <h3>Asuntos posibles</h3>
            <ul className="copy-list">
              {m.subjects.map((subj) => (
                <li key={subj}>
                  <span>{subj}</span> <CopyButton text={subj} />
                </li>
              ))}
            </ul>
          </div>
          <MessageBlock title="Email (texto plano)" text={m.emailText}>
            <a className="btn btn-small" href={`/panel/mensajes/${messages.id}/email`}>
              Descargar email HTML
            </a>
          </MessageBlock>
          <MessageBlock title="WhatsApp" text={m.whatsapp} />
          <MessageBlock title="Formulario de contacto del sitio" text={m.form} />
          <MessageBlock title="Instagram o LinkedIn" text={m.social} />
        </>
      )}
    </section>
  );
}

function MessageBlock({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="panel stack">
      <div className="section-head">
        <h3>{title}</h3>
        <div className="row-actions">
          {children}
          <CopyButton text={text} />
        </div>
      </div>
      <pre className="message">{text}</pre>
    </div>
  );
}

// ─────────────────────────── Servicios adicionales ───────────────────────────

function UpsellPanel({ upsells }: { upsells: Upsell[] }) {
  return (
    <section className="panel stack" aria-labelledby="t-upsell">
      <h2 id="t-upsell">Otros servicios que podrían servirle</h2>
      {upsells.length === 0 ? (
        <p className="faint">
          No hay señales en los datos cargados. Aparecen cuando la investigación o vos cargan datos como «turnos», «pedidos»,
          «catálogo» o un WhatsApp de consultas.
        </p>
      ) : (
        <>
          <p className="faint">Hipótesis a confirmar con el cliente, a partir de los datos cargados. No son hechos.</p>
          {upsells.map((u) => (
            <article key={u.service} className="upsell">
              <h3>{u.service}</h3>
              <p>{u.solution}</p>
              <p className="muted">Beneficio: {u.benefit}</p>
              <ul className="issues">
                {u.signals.map((s) => (
                  <li key={s.id}>
                    Señal: {s.label}. Dato: «{s.evidence}»{" "}
                    <span className="faint">({s.kind === "observed" ? "observado" : s.kind === "inference" ? "inferencia" : "hipótesis"})</span>
                    {s.sourceUrl && (
                      <>
                        {" "}
                        · <ExternalLink href={s.sourceUrl}>fuente</ExternalLink>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {u.priceItems.length > 0 && (
                <p className="faint">
                  En tu lista de precios:{" "}
                  {u.priceItems.map((i) => `${i.name} (${new Intl.NumberFormat("es-AR").format(i.price)}${i.recurring ? " por mes" : ""})`).join(" · ")}
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
