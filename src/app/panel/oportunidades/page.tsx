import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { PIPELINE_STATUSES, STATUS_LABELS } from "@/domain/pipeline";
import { requireUser } from "@/server/auth/current";
import { can } from "@/server/principal";
import { listFilterOptions, listProspects, PAGE_SIZE } from "@/server/services/prospects";
import { Country, ExternalLink, Score, Status, When } from "../../ui/format";

export const metadata: Metadata = { title: "Oportunidades" };

const GROUP_LABELS = {
  prospeccion: "Prospección",
  contacto: "Contacto",
  venta: "Venta",
  proyecto: "Proyecto",
  cerrado: "Cerrados",
} as const;

export default async function Opportunities({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser("prospects.read");
  const sp = await searchParams;
  const db = getDb();
  // Los filtros vacíos del formulario se ignoran.
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v !== ""));
  const [{ filters, total, rows }, options] = await Promise.all([
    listProspects(db, me, clean),
    listFilterOptions(db, me),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (page: number) => `?${new URLSearchParams({ ...clean, page: String(page) })}`;
  const filtered = Object.keys(clean).some((k) => k !== "sort" && k !== "page");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Oportunidades</h1>
          <p>Empresas detectadas, con su estado comercial y qué tan verificados están sus datos.</p>
        </div>
        {can(me, "prospects.write") && (
          <Link className="btn btn-primary" href="/panel/oportunidades/nuevo">
            Cargar prospecto
          </Link>
        )}
      </div>

      <form className="filters panel" method="get" role="search">
        <label className="field grow">
          <span>Buscar</span>
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Nombre, dominio o ciudad" />
        </label>
        <label className="field">
          <span>Tramo</span>
          <select name="group" defaultValue={filters.group ?? ""}>
            <option value="">Todos</option>
            {Object.entries(GROUP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Estado</span>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {PIPELINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>País</span>
          <select name="country" defaultValue={filters.country ?? ""}>
            <option value="">Todos</option>
            {options.countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ordenar por</span>
          <select name="sort" defaultValue={filters.sort}>
            <option value="recientes">Más recientes</option>
            <option value="puntaje">Mayor oportunidad</option>
            <option value="nombre">Nombre</option>
            <option value="verificacion">Verificación más vieja</option>
          </select>
        </label>
        {options.industries.length > 0 && (
          <label className="field">
            <span>Rubro</span>
            <select name="industry" defaultValue={filters.industry ?? ""}>
              <option value="">Todos</option>
              {options.industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Puntaje mínimo</span>
          <input name="minScore" type="number" min={0} max={100} defaultValue={filters.minScore ?? ""} />
        </label>
        <div className="form-actions">
          <button className="btn">Filtrar</button>
          {filtered && (
            <Link className="btn btn-ghost" href="/panel/oportunidades">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <section className="section" aria-live="polite">
        <div className="section-head">
          <h2>
            {total} {total === 1 ? "prospecto" : "prospectos"}
          </h2>
          {pages > 1 && (
            <span className="faint">
              Página {filters.page} de {pages}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <h3>{filtered ? "Ningún prospecto coincide con los filtros" : "Todavía no hay prospectos"}</h3>
            <p>
              {filtered
                ? "Probá con menos filtros o limpiá la búsqueda."
                : "Cargá una empresa a mano. La búsqueda automática se suma en la etapa 3."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="cards">
              <thead>
                <tr>
                  <th scope="col" className="col-name">Empresa</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Ubicación y rubro</th>
                  <th scope="col">Puntajes</th>
                  <th scope="col" className="col-wide">Problemas principales</th>
                  <th scope="col" className="col-wide">Solución recomendada</th>
                  <th scope="col">Datos y contacto</th>
                  <th scope="col">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, ownerName, factsTotal, factsVerified, contacts }) => (
                  <tr key={p.id}>
                    <td className="cell-title"><div className="cell">
                      <Link href={`/panel/oportunidades/${p.id}`}>{p.name}</Link>{" "}
                      {p.isSample && <span className="tag tag-sample">Ejemplo</span>}{" "}
                      {p.paused && <span className="tag tag-paused">Pausado</span>}
                      <div className="cell-sub">
                        {p.websiteUrl ? <ExternalLink href={p.websiteUrl}>{p.websiteDomain}</ExternalLink> : "Sin sitio registrado"}
                      </div>
                      <div className="cell-sub">
                        Descubierto <When date={p.discoveredAt} withTime={false} />
                      </div>
                    </div></td>
                    <td data-label="Estado"><div className="cell">
                      <Status status={p.status} />
                    </div></td>
                    <td data-label="Ubicación"><div className="cell">
                      {p.city ? `${p.city}, ` : ""}
                      <Country code={p.country} />
                      <div className="cell-sub">{p.industry ?? "Rubro sin cargar"}</div>
                    </div></td>
                    <td data-label="Puntajes"><div className="cell">
                      <div className="scores">
                        <span className="faint">Oportunidad</span>
                        <Score value={p.opportunityScore} label="Puntaje de oportunidad" />
                        <span className="faint">Sitio actual</span>
                        <Score value={p.siteScore} label="Puntaje del sitio" />
                      </div>
                    </div></td>
                    <td data-label="Problemas"><div className="cell">
                      {p.mainIssues.length ? (
                        <ul className="issues">
                          {p.mainIssues.slice(0, 3).map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="faint">Sin auditar</span>
                      )}
                    </div></td>
                    <td data-label="Solución"><div className="cell">{p.recommendedSolution ?? <span className="faint">—</span>}</div></td>
                    <td data-label="Datos"><div className="cell">
                      {factsTotal ? (
                        <span className="num">
                          {factsVerified} de {factsTotal} verificados
                        </span>
                      ) : (
                        <span className="faint">Sin datos</span>
                      )}
                      <div className="cell-sub">
                        {contacts ? `${contacts} ${contacts === 1 ? "contacto" : "contactos"}` : "Sin contactos"}
                      </div>
                      <div className="cell-sub">
                        Última verificación: <When date={p.lastVerifiedAt} withTime={false} />
                      </div>
                    </div></td>
                    <td data-label="Responsable"><div className="cell">{ownerName ?? <span className="faint">Agente</span>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav className="pager" aria-label="Páginas">
            {filters.page > 1 && (
              <Link className="btn btn-small" href={pageHref(filters.page - 1)}>
                Anterior
              </Link>
            )}
            {filters.page < pages && (
              <Link className="btn btn-small" href={pageHref(filters.page + 1)}>
                Siguiente
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
