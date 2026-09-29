import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth/current";
import { can } from "@/server/principal";
import { listPortfolio } from "@/server/services/finance";
import { ExternalLink } from "../../ui/format";
import { PortfolioForm, RemovePortfolioForm } from "../finanzas/forms";

export const metadata: Metadata = { title: "Portafolio" };

export default async function PortfolioPage() {
  const me = await requireUser("prospects.read");
  const items = await listPortfolio(getDb(), me);
  const canWrite = can(me, "prospects.write");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Portafolio</h1>
          <p>
            Los sitios terminados, para mostrar tu trabajo a nuevos clientes. Antes de mostrar uno afuera, confirmá que el cliente
            lo autorizó y usá solo logros medidos o confirmados por él.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <h3>Todavía no hay trabajos</h3>
          <p>Cuando termines un sitio, agregalo acá con su dirección, un resumen y los logros.</p>
        </div>
      ) : (
        <div className="portfolio">
          {items.map((it) => (
            <article key={it.id} className={`panel stack work${it.featured ? " featured" : ""}`}>
              <div className="work-head">
                <div>
                  <h2>{it.title}</h2>
                  <p className="faint">
                    {it.clientName}
                    {it.year ? ` · ${it.year}` : ""}
                  </p>
                </div>
                <div className="row-actions">
                  {it.featured && <span className="tag">Destacado</span>}
                  <span className={`tag ${it.clientOk ? "" : "tag-paused"}`}>{it.clientOk ? "Autorizado por el cliente" : "Sin autorización para mostrar"}</span>
                </div>
              </div>
              {it.url && <ExternalLink href={it.url}>Ver el sitio</ExternalLink>}
              {it.summary && <p>{it.summary}</p>}
              {it.highlights.length > 0 && (
                <ul className="issues">
                  {it.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              {it.tags.length > 0 && (
                <div className="chips">
                  {it.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {canWrite && (
                <details className="disclose">
                  <summary className="faint">Editar</summary>
                  <PortfolioForm item={it} />
                  <RemovePortfolioForm id={it.id} />
                </details>
              )}
            </article>
          ))}
        </div>
      )}

      {canWrite && (
        <section className="panel stack section" aria-labelledby="pf-new">
          <h2 id="pf-new">Agregar trabajo</h2>
          <PortfolioForm />
        </section>
      )}
    </>
  );
}
