import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { quoteTotals, type QuoteLine } from "@/domain/finance";
import { requireUser } from "@/server/auth/current";
import { NotFoundError } from "@/server/principal";
import { getQuote } from "@/server/services/finance";
import { getSettings } from "@/server/services/settings";
import { formatMoney, When } from "../../../ui/format";
import { QuoteStatusForm, QuoteToSaleForm } from "../../finanzas/forms";
import { QUOTE_STATUS_LABELS } from "../labels";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("finance.read");
  const { id } = await params;
  const db = getDb();
  let q;
  try {
    q = await getQuote(db, me, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { data: settings } = await getSettings(db, me);
  const lines = q.lines as QuoteLine[];
  const t = quoteTotals(lines, Number(q.discountPct), Number(q.taxPct));
  const m = (n: number) => formatMoney(n, q.currency);
  const s = settings.sender;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link href="/panel/cotizador" className="faint">
            ← Cotizador
          </Link>
          <h1>Presupuesto N.º {q.number}</h1>
          <p>
            Estado: <strong>{QUOTE_STATUS_LABELS[q.status]}</strong>. Para enviarlo, usá la opción de imprimir del navegador y
            guardalo como PDF.
          </p>
        </div>
        <div className="row-actions">
          {q.status === "borrador" && <QuoteStatusForm id={q.id} to="enviado" label="Marcar enviado" />}
          {q.status === "enviado" && <QuoteStatusForm id={q.id} to="aceptado" label="Aceptado" />}
          {(q.status === "borrador" || q.status === "enviado") && <QuoteStatusForm id={q.id} to="rechazado" label="Rechazado" danger />}
          {q.status === "aceptado" && !q.saleId && <QuoteToSaleForm id={q.id} />}
          {q.saleId && (
            <Link className="btn btn-small" href="/panel/finanzas">
              Ver la venta
            </Link>
          )}
        </div>
      </div>

      <article className="panel quote-doc">
        <header className="quote-head">
          <div>
            <h2>{s.agencyName || "Presupuesto"}</h2>
            <p className="faint">{[s.senderName, s.replyEmail, s.whatsapp, s.website].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="quote-meta">
            <strong>Presupuesto N.º {q.number}</strong>
            <span>
              Fecha: <When date={q.createdAt} withTime={false} />
            </span>
            {q.validUntil && <span>Válido hasta: {q.validUntil.split("-").reverse().join("/")}</span>}
          </div>
        </header>
        <p>
          Cliente: <strong>{q.clientName}</strong>
        </p>
        <table className="quote-table">
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col">Cant.</th>
              <th scope="col">Precio unitario</th>
              <th scope="col">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.description}</td>
                <td className="num">{l.quantity}</td>
                <td className="num">{m(l.unitPrice)}</td>
                <td className="num">{m(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="dl totals">
          <dt>Subtotal</dt>
          <dd className="num">{m(t.subtotal)}</dd>
          {t.discount > 0 && (
            <>
              <dt>Descuento ({Number(q.discountPct)} %)</dt>
              <dd className="num">− {m(t.discount)}</dd>
            </>
          )}
          {t.tax > 0 && (
            <>
              <dt>Impuesto ({Number(q.taxPct)} %)</dt>
              <dd className="num">{m(t.tax)}</dd>
            </>
          )}
          <dt>
            <strong>Total</strong>
          </dt>
          <dd className="num">
            <strong>{m(Number(q.total))}</strong>
          </dd>
        </dl>
        {q.notes && <p className="note-body">{q.notes}</p>}
      </article>
    </>
  );
}
