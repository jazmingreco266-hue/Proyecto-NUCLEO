/**
 * Excel de finanzas: ventas, gastos, resultado mensual (con fórmulas), balance y presupuestos.
 * Los movimientos anulados se incluyen marcados, pero no suman en el resultado ni en el balance.
 */
import type { Db } from "@/db/client";
import { buildXlsx, type Cell, type Sheet } from "../xlsx";
import { audit } from "../audit";
import { assertCan, type Principal } from "../principal";
import { financeReport, listExpenses, listQuotes, listSales } from "./finance";

export async function financeWorkbook(db: Db, who: Principal): Promise<Buffer> {
  assertCan(who, "finance.read");
  const [s, e, q, report] = await Promise.all([listSales(db, who), listExpenses(db, who), listQuotes(db, who), financeReport(db, who)]);

  const ventas: Sheet = {
    name: "Ventas",
    columns: [
      { header: "Fecha", type: "date", width: 12 },
      { header: "Cliente", type: "text", width: 26 },
      { header: "Descripción", type: "text", width: 34 },
      { header: "Moneda", type: "text", width: 8 },
      { header: "Monto", type: "money", width: 16 },
      { header: "Estado", type: "text", width: 11 },
      { header: "Cobrado el", type: "date", width: 12 },
      { header: "Medio de pago", type: "text", width: 16 },
      { header: "¿Cuenta?", type: "text", width: 10 },
      { header: "Motivo de anulación", type: "text", width: 30 },
      { header: "Cargada por", type: "text", width: 18 },
    ],
    rows: s.map(({ s: r, by }) => [r.occurredOn, r.clientName, r.description, r.currency, Number(r.amount), r.status, r.paidOn, r.method, r.voidedAt ? "No (anulada)" : "Sí", r.voidReason, by]),
  };

  const gastos: Sheet = {
    name: "Gastos",
    columns: [
      { header: "Fecha", type: "date", width: 12 },
      { header: "Descripción", type: "text", width: 34 },
      { header: "Categoría", type: "text", width: 24 },
      { header: "Proveedor", type: "text", width: 20 },
      { header: "Moneda", type: "text", width: 8 },
      { header: "Monto", type: "money", width: 16 },
      { header: "Estado", type: "text", width: 11 },
      { header: "Pagado el", type: "date", width: 12 },
      { header: "¿Cuenta?", type: "text", width: 10 },
      { header: "Motivo de anulación", type: "text", width: 30 },
      { header: "Cargado por", type: "text", width: 18 },
    ],
    rows: e.map(({ e: r, by }) => [r.occurredOn, r.description, r.category, r.vendor, r.currency, Number(r.amount), r.status, r.paidOn, r.voidedAt ? "No (anulado)" : "Sí", r.voidReason, by]),
  };

  // Resultado = Ventas − Gastos y Margen = Resultado / Ventas, como fórmulas de Excel.
  const resultado: Sheet = {
    name: "Resultado mensual",
    columns: [
      { header: "Mes", type: "text", width: 10 },
      { header: "Moneda", type: "text", width: 8 },
      { header: "Ventas", type: "money", width: 16 },
      { header: "Gastos", type: "money", width: 16 },
      { header: "Resultado (profit)", type: "money", width: 18 },
      { header: "Margen", type: "percent", width: 10 },
    ],
    rows: report.months.map((m, i): Cell[] => {
      const n = i + 2;
      return [
        m.month,
        m.currency,
        m.sales,
        m.expenses,
        { formula: `C${n}-D${n}`, value: m.profit },
        m.margin == null ? null : { formula: `IF(C${n}=0,"",E${n}/C${n})`, value: m.margin / 100 },
      ];
    }),
  };

  const balance: Sheet = {
    name: "Balance",
    columns: [
      { header: "Moneda", type: "text", width: 8 },
      { header: "Caja (cobrado − pagado)", type: "money", width: 22 },
      { header: "Cuentas por cobrar", type: "money", width: 18 },
      { header: "Cuentas por pagar", type: "money", width: 18 },
      { header: "Activo", type: "money", width: 16 },
      { header: "Pasivo", type: "money", width: 16 },
      { header: "Patrimonio", type: "money", width: 16 },
      { header: "Al", type: "date", width: 12 },
    ],
    rows: report.balance.map((b, i): Cell[] => {
      const n = i + 2;
      return [
        b.currency,
        b.cash,
        b.receivable,
        b.payable,
        { formula: `B${n}+C${n}`, value: b.assets },
        { formula: `D${n}`, value: b.liabilities },
        { formula: `E${n}-F${n}`, value: b.equity },
        report.asOf,
      ];
    }),
  };

  const presupuestos: Sheet = {
    name: "Presupuestos",
    columns: [
      { header: "N.º", type: "number", width: 7 },
      { header: "Fecha", type: "date", width: 12 },
      { header: "Cliente", type: "text", width: 26 },
      { header: "Moneda", type: "text", width: 8 },
      { header: "Subtotal", type: "money", width: 16 },
      { header: "Descuento %", type: "number", width: 12 },
      { header: "Impuesto %", type: "number", width: 12 },
      { header: "Total pago único", type: "money", width: 16 },
      { header: "Abono mensual", type: "money", width: 16 },
      { header: "Estado", type: "text", width: 11 },
      { header: "Válido hasta", type: "date", width: 12 },
    ],
    rows: q.map((r) => [r.number, r.createdAt.toISOString().slice(0, 10), r.clientName, r.currency, Number(r.subtotal), Number(r.discountPct), Number(r.taxPct), Number(r.total), Number(r.monthlyTotal), r.status, r.validUntil]),
  };

  await audit(db, who, { action: "finance.export", metadata: { ventas: s.length, gastos: e.length, presupuestos: q.length } });
  return buildXlsx([resultado, balance, ventas, gastos, presupuestos]);
}
