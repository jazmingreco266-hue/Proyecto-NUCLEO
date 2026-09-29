"use client";

import { useMemo, useState } from "react";
import { EXPENSE_CATEGORIES, parseAmount, quoteTotals, type QuoteLine } from "@/domain/finance";
import { ActionForm } from "../../ui/action-form";
import {
  createExpenseAction,
  createQuoteAction,
  createSaleAction,
  markPaidAction,
  quoteStatusAction,
  quoteToSaleAction,
  removePortfolioAction,
  savePortfolioAction,
  voidAction,
} from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────── Ventas y gastos ───────────────────────────

export function SaleForm({ currency }: { currency: string }) {
  return (
    <ActionForm action={createSaleAction} submitLabel="Registrar venta">
      {(v) => (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Fecha *</span>
              <input name="occurredOn" type="date" required defaultValue={v.occurredOn ?? today()} />
            </label>
            <label className="field">
              <span>Cliente *</span>
              <input name="clientName" required minLength={2} maxLength={200} defaultValue={v.clientName} />
            </label>
          </div>
          <label className="field">
            <span>Descripción *</span>
            <input name="description" required minLength={2} maxLength={300} defaultValue={v.description} placeholder="Ej.: Sitio institucional" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Monto *</span>
              <input name="amount" required inputMode="decimal" defaultValue={v.amount} placeholder="450.000" />
            </label>
            <label className="field">
              <span>Moneda</span>
              <input name="currency" required maxLength={3} defaultValue={v.currency ?? currency} autoCapitalize="characters" />
            </label>
            <label className="field">
              <span>Estado</span>
              <select name="status" defaultValue={v.status ?? "cobrado"}>
                <option value="cobrado">Cobrado</option>
                <option value="pendiente">Pendiente de cobro</option>
              </select>
            </label>
            <label className="field">
              <span>Medio de pago</span>
              <input name="method" maxLength={80} defaultValue={v.method} placeholder="Transferencia" />
            </label>
          </div>
          <label className="field">
            <span>Notas</span>
            <input name="notes" maxLength={1000} defaultValue={v.notes} />
          </label>
        </>
      )}
    </ActionForm>
  );
}

export function ExpenseForm({ currency }: { currency: string }) {
  return (
    <ActionForm action={createExpenseAction} submitLabel="Registrar gasto">
      {(v) => (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Fecha *</span>
              <input name="occurredOn" type="date" required defaultValue={v.occurredOn ?? today()} />
            </label>
            <label className="field">
              <span>Categoría</span>
              <select name="category" defaultValue={v.category ?? EXPENSE_CATEGORIES[0]}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Descripción *</span>
            <input name="description" required minLength={2} maxLength={300} defaultValue={v.description} placeholder="Ej.: Vercel Pro septiembre" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Monto *</span>
              <input name="amount" required inputMode="decimal" defaultValue={v.amount} placeholder="20" />
            </label>
            <label className="field">
              <span>Moneda</span>
              <input name="currency" required maxLength={3} defaultValue={v.currency ?? currency} autoCapitalize="characters" />
            </label>
            <label className="field">
              <span>Estado</span>
              <select name="status" defaultValue={v.status ?? "pagado"}>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente de pago</option>
              </select>
            </label>
            <label className="field">
              <span>Proveedor</span>
              <input name="vendor" maxLength={200} defaultValue={v.vendor} />
            </label>
          </div>
          <label className="field">
            <span>Notas</span>
            <input name="notes" maxLength={1000} defaultValue={v.notes} />
          </label>
        </>
      )}
    </ActionForm>
  );
}

export function MarkPaidForm({ kind, id }: { kind: "sale" | "expense"; id: string }) {
  return (
    <ActionForm action={markPaidAction} submitLabel={kind === "sale" ? "Cobrado" : "Pagado"} submitClass="btn btn-small" pendingLabel="…" className="inline-form">
      {() => (
        <>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
        </>
      )}
    </ActionForm>
  );
}

export function VoidForm({ kind, id }: { kind: "sale" | "expense"; id: string }) {
  return (
    <details className="disclose">
      <summary className="faint">Anular</summary>
      <ActionForm
        action={voidAction}
        submitLabel="Anular"
        submitClass="btn btn-danger btn-small"
        pendingLabel="Anulando…"
        confirm={() => ({
          title: "Anular movimiento",
          body: "Deja de sumar en los totales, pero queda visible con tu motivo. No se puede deshacer: si fue un error, cargalo de nuevo.",
          confirmLabel: "Anular",
        })}
      >
        {() => (
          <>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <label className="field">
              <span>Motivo *</span>
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
          </>
        )}
      </ActionForm>
    </details>
  );
}

// ─────────────────────────── Cotizador ───────────────────────────

type PriceItem = { name: string; price: number };
type Row = { key: number; description: string; quantity: string; unitPrice: string };

const num = (v: string) => {
  const n = Number(parseAmount(v));
  return Number.isFinite(n) ? n : 0;
};

export function QuoteCalculator({ items, currency, taxPct }: { items: PriceItem[]; currency: string; taxPct: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState(String(taxPct));
  const [cur, setCur] = useState(currency);
  const [nextKey, setNextKey] = useState(1);

  const lines: QuoteLine[] = rows
    .map((r) => ({ description: r.description.trim(), quantity: num(r.quantity), unitPrice: num(r.unitPrice) }))
    .filter((l) => l.description && l.quantity > 0);
  const t = useMemo(() => quoteTotals(lines, Math.min(100, Math.max(0, num(discount))), Math.min(100, Math.max(0, num(tax)))), [lines, discount, tax]);
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: cur || "ARS", maximumFractionDigits: 2 });
  } catch {
    fmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
  }

  const add = (description = "", unitPrice = "") => {
    setRows((r) => [...r, { key: nextKey, description, quantity: "1", unitPrice }]);
    setNextKey((k) => k + 1);
  };
  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <ActionForm action={createQuoteAction} submitLabel="Guardar presupuesto" pendingLabel="Guardando…">
      {(v) => (
        <>
          <input type="hidden" name="lines" value={JSON.stringify(lines)} />
          <div className="form-grid">
            <label className="field">
              <span>Cliente *</span>
              <input name="clientName" required minLength={2} maxLength={200} defaultValue={v.clientName} />
            </label>
            <label className="field">
              <span>Moneda</span>
              <input name="currency" maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} />
            </label>
            <label className="field">
              <span>Válido hasta</span>
              <input name="validUntil" type="date" defaultValue={v.validUntil} />
            </label>
          </div>

          <fieldset>
            <legend>Ítems de tu lista de precios</legend>
            {items.length ? (
              <div className="chips">
                {items.map((i) => (
                  <button key={i.name} type="button" className="btn btn-small" onClick={() => add(i.name, String(i.price))}>
                    + {i.name} · {fmt.format(i.price)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="faint">No hay ítems: cargalos en Configuración → Lista de precios.</p>
            )}
            <button type="button" className="btn btn-ghost btn-small inline-btn" onClick={() => add()}>
              + Ítem a medida
            </button>
          </fieldset>

          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th scope="col">Descripción</th>
                    <th scope="col">Cant.</th>
                    <th scope="col">Precio unitario</th>
                    <th scope="col">Importe</th>
                    <th scope="col">
                      <span className="sr-only">Quitar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <input aria-label="Descripción" value={r.description} maxLength={200} onChange={(e) => update(r.key, { description: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label="Cantidad" inputMode="decimal" className="qty" value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label="Precio unitario" inputMode="decimal" value={r.unitPrice} onChange={(e) => update(r.key, { unitPrice: e.target.value })} />
                      </td>
                      <td className="num">{fmt.format(num(r.quantity) * num(r.unitPrice))}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-grid">
            <label className="field">
              <span>Descuento (%)</span>
              <input name="discountPct" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
            <label className="field">
              <span>Impuesto (%)</span>
              <input name="taxPct" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
              <small>Depende de tu situación fiscal.</small>
            </label>
          </div>

          <dl className="dl totals" aria-live="polite">
            <dt>Subtotal</dt>
            <dd className="num">{fmt.format(t.subtotal)}</dd>
            {t.discount > 0 && (
              <>
                <dt>Descuento</dt>
                <dd className="num">− {fmt.format(t.discount)}</dd>
              </>
            )}
            {t.tax > 0 && (
              <>
                <dt>Impuesto</dt>
                <dd className="num">{fmt.format(t.tax)}</dd>
              </>
            )}
            <dt>
              <strong>Total</strong>
            </dt>
            <dd className="num">
              <strong>{fmt.format(t.total)}</strong>
            </dd>
          </dl>

          <label className="field">
            <span>Notas para el cliente</span>
            <textarea name="notes" rows={3} maxLength={2000} defaultValue={v.notes} placeholder="Qué incluye, plazos de entrega, forma de pago…" />
          </label>
        </>
      )}
    </ActionForm>
  );
}

export function QuoteStatusForm({ id, to, label, danger }: { id: string; to: string; label: string; danger?: boolean }) {
  return (
    <ActionForm action={quoteStatusAction} submitLabel={label} submitClass={danger ? "btn btn-danger btn-small" : "btn btn-small"} pendingLabel="…" className="inline-form">
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value={to} />
        </>
      )}
    </ActionForm>
  );
}

export function QuoteToSaleForm({ id }: { id: string }) {
  return (
    <ActionForm
      action={quoteToSaleAction}
      submitLabel="Registrar como venta"
      submitClass="btn btn-primary btn-small"
      pendingLabel="Registrando…"
      className="inline-form"
      confirm={() => ({ title: "Registrar como venta", body: "Se crea una venta pendiente de cobro por el total del presupuesto. Solo se puede hacer una vez.", confirmLabel: "Registrar" })}
    >
      {() => <input type="hidden" name="id" value={id} />}
    </ActionForm>
  );
}

// ─────────────────────────── Portafolio ───────────────────────────

export type PortfolioDraft = {
  id?: string;
  title: string;
  clientName: string;
  url: string | null;
  year: number | null;
  summary: string;
  highlights: string[];
  tags: string[];
  featured: boolean;
  clientOk: boolean;
};

export function PortfolioForm({ item }: { item?: PortfolioDraft }) {
  const d = item;
  return (
    <ActionForm action={savePortfolioAction} submitLabel={d?.id ? "Guardar cambios" : "Agregar al portafolio"}>
      {(v) => (
        <>
          {d?.id && <input type="hidden" name="id" value={d.id} />}
          <div className="form-grid">
            <label className="field">
              <span>Título *</span>
              <input name="title" required minLength={2} maxLength={160} defaultValue={v.title ?? d?.title} />
            </label>
            <label className="field">
              <span>Cliente *</span>
              <input name="clientName" required minLength={2} maxLength={200} defaultValue={v.clientName ?? d?.clientName} />
            </label>
            <label className="field">
              <span>Dirección del sitio</span>
              <input name="url" type="url" maxLength={2000} defaultValue={v.url ?? d?.url ?? ""} placeholder="https://" />
            </label>
            <label className="field">
              <span>Año</span>
              <input name="year" type="number" min={2000} max={2100} defaultValue={v.year ?? d?.year ?? new Date().getFullYear()} />
            </label>
          </div>
          <label className="field">
            <span>Resumen</span>
            <textarea name="summary" rows={3} maxLength={2000} defaultValue={v.summary ?? d?.summary} placeholder="Qué problema tenía el cliente y qué se construyó." />
          </label>
          <label className="field">
            <span>Logros (uno por línea)</span>
            <textarea name="highlights" rows={3} defaultValue={v.highlights ?? d?.highlights.join("\n")} placeholder="Solo resultados medidos o confirmados por el cliente." />
          </label>
          <label className="field">
            <span>Etiquetas (separadas por coma)</span>
            <input name="tags" maxLength={400} defaultValue={v.tags ?? d?.tags.join(", ")} placeholder="gastronomía, tienda online" />
          </label>
          <label className="check-field">
            <input type="checkbox" name="featured" defaultChecked={d?.featured ?? false} /> Destacado
          </label>
          <label className="check-field">
            <input type="checkbox" name="clientOk" defaultChecked={d?.clientOk ?? false} /> El cliente autorizó mostrarlo
          </label>
        </>
      )}
    </ActionForm>
  );
}

export function RemovePortfolioForm({ id }: { id: string }) {
  return (
    <ActionForm
      action={removePortfolioAction}
      submitLabel="Retirar"
      submitClass="btn btn-danger btn-small"
      pendingLabel="Retirando…"
      className="inline-form"
      confirm={() => ({ title: "Retirar del portafolio", body: "Deja de mostrarse. Queda en la base y en el registro de actividad.", confirmLabel: "Retirar" })}
    >
      {() => <input type="hidden" name="id" value={id} />}
    </ActionForm>
  );
}
