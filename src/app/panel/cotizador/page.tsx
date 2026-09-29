import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth/current";
import { listQuotes } from "@/server/services/finance";
import { getSettings } from "@/server/services/settings";
import { formatMoney, When } from "../../ui/format";
import { QuoteCalculator } from "../finanzas/forms";
import { QUOTE_STATUS_LABELS } from "./labels";

export const metadata: Metadata = { title: "Cotizador" };

export default async function QuotesPage() {
  const me = await requireUser("finance.read");
  const db = getDb();
  const [{ data: settings }, quotes] = await Promise.all([getSettings(db, me), listQuotes(db, me)]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cotizador</h1>
          <p>
            Armá un presupuesto con tu lista de precios: el total se calcula mientras elegís. Un presupuesto guardado no se
            modifica; si cambia algo, hacé uno nuevo.
          </p>
        </div>
        <Link className="btn" href="/panel/configuracion">
          Editar lista de precios
        </Link>
      </div>
      <div className="detail-grid">
        <section className="panel stack" aria-labelledby="q-new">
          <h2 id="q-new">Nuevo presupuesto</h2>
          <QuoteCalculator items={settings.pricing.items} currency={settings.pricing.currency} taxPct={settings.pricing.taxPct} />
        </section>
        <aside className="side" aria-label="Presupuestos">
          <section className="panel stack">
            <h2>Presupuestos</h2>
            {quotes.length === 0 ? (
              <p className="faint">Todavía no hay presupuestos.</p>
            ) : (
              <ul className="quote-list">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/panel/cotizador/${q.id}`}>
                      N.º {q.number} · {q.clientName}
                    </Link>
                    <span className="cell-sub">
                      {formatMoney(Number(q.total), q.currency)} · {QUOTE_STATUS_LABELS[q.status]} · <When date={q.createdAt} withTime={false} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
