import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { lastMonths } from "@/domain/finance";
import { requireUser } from "@/server/auth/current";
import { financeReport, listExpenses, listSales } from "@/server/services/finance";
import { getSettings } from "@/server/services/settings";
import { formatMoney, When } from "../../ui/format";
import { SalesChart } from "./chart";
import { ExpenseForm, MarkPaidForm, SaleForm, VoidForm } from "./forms";

export const metadata: Metadata = { title: "Finanzas" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser("finance.read");
  const sp = await searchParams;
  const db = getDb();
  const [{ data: settings }, report, salesRows, expenseRows] = await Promise.all([
    getSettings(db, me),
    financeReport(db, me),
    listSales(db, me),
    listExpenses(db, me),
  ]);

  const currencies = [...new Set([settings.pricing.currency, ...report.months.map((m) => m.currency), ...report.balance.map((b) => b.currency)])].sort();
  const currency = currencies.includes((sp.moneda ?? "").toUpperCase()) ? sp.moneda!.toUpperCase() : settings.pricing.currency;
  const thisMonth = report.asOf.slice(0, 7);
  const months = lastMonths(thisMonth, 12).map((month) => {
    const r = report.months.find((m) => m.month === month && m.currency === currency);
    return { month, sales: r?.sales ?? 0, expenses: r?.expenses ?? 0, profit: r?.profit ?? 0 };
  });
  const sum = (k: "sales" | "expenses" | "profit") => months.reduce((s, m) => s + m[k], 0);
  const current = months[months.length - 1]!;
  const yearSales = sum("sales");
  const yearMargin = yearSales > 0 ? Math.round((sum("profit") / yearSales) * 1000) / 10 : null;
  const bal = report.balance.find((b) => b.currency === currency);
  const money = (n: number) => formatMoney(n, currency);
  const empty = report.counts.sales + report.counts.expenses === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finanzas</h1>
          <p>
            Ventas, gastos, resultado y balance. Los movimientos no se editan ni se borran: se marcan como cobrados o pagados,
            o se anulan con un motivo. Cada moneda se muestra por separado, sin convertir.
          </p>
        </div>
        <a className="btn" href="/api/finanzas/excel">
          Descargar Excel
        </a>
      </div>

      {currencies.length > 1 && (
        <nav className="tabs" aria-label="Moneda">
          {currencies.map((c) => (
            <Link key={c} href={`?moneda=${c}`} aria-current={c === currency ? "page" : undefined}>
              {c}
            </Link>
          ))}
        </nav>
      )}

      <section className="section" aria-labelledby="f-resumen">
        <h2 id="f-resumen">Este mes y últimos 12 meses ({currency})</h2>
        <div className="metrics">
          <div className="metric">
            <span className="metric-n num">{money(current.sales)}</span>
            <span className="metric-l">Ventas del mes</span>
          </div>
          <div className="metric">
            <span className="metric-n num">{money(current.expenses)}</span>
            <span className="metric-l">Gastos del mes</span>
          </div>
          <div className="metric">
            <span className="metric-n num">{money(current.profit)}</span>
            <span className="metric-l">Resultado del mes</span>
          </div>
          <div className="metric">
            <span className="metric-n num">{money(sum("profit"))}</span>
            <span className="metric-l">Resultado 12 meses{yearMargin != null ? ` · margen ${yearMargin} %` : ""}</span>
          </div>
        </div>
        <div className="panel">
          {empty ? (
            <div className="empty">
              <h3>Todavía no hay movimientos</h3>
              <p>Cargá tu primera venta o gasto abajo. El gráfico se arma solo con lo que registres.</p>
            </div>
          ) : (
            <SalesChart data={months} currency={currency} />
          )}
        </div>
        <p className="faint">Resultado = lo vendido menos lo gastado en el mes, se haya cobrado o no. Las operaciones anuladas no cuentan.</p>
      </section>

      <section className="section" aria-labelledby="f-balance">
        <h2 id="f-balance">Balance simplificado al <When date={new Date(`${report.asOf}T12:00:00`)} withTime={false} /></h2>
        <div className="panel">
          {bal ? (
            <dl className="dl">
              <dt>Caja (cobrado − pagado)</dt>
              <dd className="num">{money(bal.cash)}</dd>
              <dt>Cuentas por cobrar</dt>
              <dd className="num">{money(bal.receivable)}</dd>
              <dt>
                <strong>Activo</strong>
              </dt>
              <dd className="num">
                <strong>{money(bal.assets)}</strong>
              </dd>
              <dt>Cuentas por pagar (Pasivo)</dt>
              <dd className="num">{money(bal.liabilities)}</dd>
              <dt>
                <strong>Patrimonio (Activo − Pasivo)</strong>
              </dt>
              <dd className="num">
                <strong>{money(bal.equity)}</strong>
              </dd>
            </dl>
          ) : (
            <p className="faint">Sin movimientos en {currency}.</p>
          )}
          <p className="faint">
            Se arma solo con lo cargado acá: no incluye dinero previo, equipos ni deudas que no hayas registrado. No reemplaza el
            balance de tu contador.
          </p>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel stack" aria-labelledby="f-venta">
          <h2 id="f-venta">Registrar venta</h2>
          <SaleForm currency={currency} />
        </section>
        <section className="panel stack" aria-labelledby="f-gasto">
          <h2 id="f-gasto">Registrar gasto</h2>
          <ExpenseForm currency={currency} />
        </section>
      </div>

      <section className="section" aria-labelledby="f-ventas">
        <h2 id="f-ventas">Ventas</h2>
        {salesRows.length === 0 ? (
          <p className="faint">Sin ventas registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="cards fit">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Cliente y detalle</th>
                  <th scope="col">Monto</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.slice(0, 200).map(({ s, by }) => (
                  <tr key={s.id} className={s.voidedAt ? "voided" : undefined}>
                    <td className="cell-title">{s.occurredOn.split("-").reverse().join("/")}</td>
                    <td data-label="Cliente">
                      <strong>{s.clientName}</strong>
                      <div className="cell-sub">
                        {s.description} · cargó {by}
                      </div>
                    </td>
                    <td data-label="Monto" className="num">
                      {formatMoney(Number(s.amount), s.currency)}
                    </td>
                    <td data-label="Estado">
                      {s.voidedAt ? (
                        <span className="text-danger">Anulada: {s.voidReason}</span>
                      ) : s.status === "cobrado" ? (
                        <span className="run-succeeded">Cobrada el {s.paidOn?.split("-").reverse().join("/")}</span>
                      ) : (
                        <span className="run-queued">Pendiente de cobro</span>
                      )}
                    </td>
                    <td data-label="Acciones">
                      {!s.voidedAt && (
                        <div className="row-actions">
                          {s.status === "pendiente" && <MarkPaidForm kind="sale" id={s.id} />}
                          <VoidForm kind="sale" id={s.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="f-gastos">
        <h2 id="f-gastos">Gastos</h2>
        {expenseRows.length === 0 ? (
          <p className="faint">Sin gastos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="cards fit">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">Monto</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.slice(0, 200).map(({ e, by }) => (
                  <tr key={e.id} className={e.voidedAt ? "voided" : undefined}>
                    <td className="cell-title">{e.occurredOn.split("-").reverse().join("/")}</td>
                    <td data-label="Detalle">
                      <strong>{e.description}</strong>
                      <div className="cell-sub">
                        {e.category}
                        {e.vendor ? ` · ${e.vendor}` : ""} · cargó {by}
                      </div>
                    </td>
                    <td data-label="Monto" className="num">
                      {formatMoney(Number(e.amount), e.currency)}
                    </td>
                    <td data-label="Estado">
                      {e.voidedAt ? (
                        <span className="text-danger">Anulado: {e.voidReason}</span>
                      ) : e.status === "pagado" ? (
                        <span className="run-succeeded">Pagado el {e.paidOn?.split("-").reverse().join("/")}</span>
                      ) : (
                        <span className="run-queued">Pendiente de pago</span>
                      )}
                    </td>
                    <td data-label="Acciones">
                      {!e.voidedAt && (
                        <div className="row-actions">
                          {e.status === "pendiente" && <MarkPaidForm kind="expense" id={e.id} />}
                          <VoidForm kind="expense" id={e.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {salesRows.length + expenseRows.length > 400 && <p className="faint">Se muestran los 200 más recientes de cada lista. El Excel tiene todos.</p>}
      </section>
    </>
  );
}
