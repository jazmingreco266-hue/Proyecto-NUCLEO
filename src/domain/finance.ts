/**
 * Finanzas de la agencia: presupuestos, resultados y balance simplificado.
 * Funciones puras. Los montos se trabajan en centavos para no acumular errores de redondeo.
 * Nunca se convierten monedas: cada moneda se informa por separado.
 */
import { z } from "zod";

const cents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

// ─────────────────────────── Categorías ───────────────────────────

export const EXPENSE_CATEGORIES = [
  "Hosting y dominios",
  "Herramientas y software",
  "IA y APIs",
  "Publicidad",
  "Sueldos y colaboradores",
  "Impuestos",
  "Comisiones bancarias",
  "Equipos",
  "Otros",
] as const;

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Moneda: código de 3 letras (ej.: ARS, USD)");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").refine((d) => !Number.isNaN(Date.parse(d)), "Fecha inválida");
const amount = z.coerce.number().positive("El monto tiene que ser mayor a 0").max(1e12);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

// ─────────────────────────── Ventas y gastos ───────────────────────────

export const saleInputSchema = z
  .object({
    occurredOn: isoDate,
    description: z.string().trim().min(2, "Describí la venta").max(300),
    clientName: z.string().trim().min(2, "Falta el cliente").max(200),
    prospectId: z.string().uuid().nullable().optional(),
    quoteId: z.string().uuid().nullable().optional(),
    amount,
    currency: currencySchema,
    status: z.enum(["pendiente", "cobrado"]),
    paidOn: isoDate.nullable().optional(),
    method: optionalText(80),
    notes: optionalText(1000),
  })
  .transform((s) => ({ ...s, paidOn: s.status === "cobrado" ? (s.paidOn ?? s.occurredOn) : null }));

export const expenseInputSchema = z
  .object({
    occurredOn: isoDate,
    description: z.string().trim().min(2, "Describí el gasto").max(300),
    category: z.enum(EXPENSE_CATEGORIES),
    vendor: optionalText(200),
    amount,
    currency: currencySchema,
    status: z.enum(["pendiente", "pagado"]),
    paidOn: isoDate.nullable().optional(),
    notes: optionalText(1000),
  })
  .transform((e) => ({ ...e, paidOn: e.status === "pagado" ? (e.paidOn ?? e.occurredOn) : null }));

// ─────────────────────────── Presupuestos ───────────────────────────

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(10_000),
  unitPrice: z.coerce.number().min(0).max(1e12),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;

export const quoteInputSchema = z.object({
  clientName: z.string().trim().min(2, "Falta el cliente").max(200),
  prospectId: z.string().uuid().nullable().optional(),
  currency: currencySchema,
  lines: z.array(quoteLineSchema).min(1, "Agregá al menos un ítem").max(40),
  discountPct: z.coerce.number().min(0).max(100),
  taxPct: z.coerce.number().min(0).max(100),
  validUntil: isoDate.nullable().optional(),
  notes: optionalText(2000),
});

export type QuoteTotals = { subtotal: number; discount: number; taxable: number; tax: number; total: number };

/** Subtotal − descuento; el impuesto se aplica sobre lo que queda. Redondeo a centavos en cada paso. */
export function quoteTotals(lines: QuoteLine[], discountPct: number, taxPct: number): QuoteTotals {
  const sub = lines.reduce((s, l) => s + cents(l.quantity * l.unitPrice), 0);
  const disc = Math.round((sub * discountPct) / 100);
  const taxable = sub - disc;
  const tax = Math.round((taxable * taxPct) / 100);
  return { subtotal: fromCents(sub), discount: fromCents(disc), taxable: fromCents(taxable), tax: fromCents(tax), total: fromCents(taxable + tax) };
}

// ─────────────────────────── Resultados ───────────────────────────

export type Movement = {
  occurredOn: string;
  amount: number;
  currency: string;
  status: string;
  paidOn: string | null;
  voided: boolean;
};

export type MonthRow = { month: string; currency: string; sales: number; expenses: number; profit: number; margin: number | null };

/**
 * Estado de resultados por mes y moneda, por fecha de la operación (lo vendido y lo gastado en el mes,
 * se haya cobrado o no). Las operaciones anuladas no cuentan.
 */
export function monthlySummary(sales: Movement[], expenses: Movement[]): MonthRow[] {
  const acc = new Map<string, { s: number; e: number }>();
  const add = (m: Movement, key: "s" | "e") => {
    if (m.voided) return;
    const k = `${m.occurredOn.slice(0, 7)}|${m.currency}`;
    const cur = acc.get(k) ?? { s: 0, e: 0 };
    cur[key] += cents(m.amount);
    acc.set(k, cur);
  };
  sales.forEach((m) => add(m, "s"));
  expenses.forEach((m) => add(m, "e"));
  return [...acc.entries()]
    .map(([k, v]) => {
      const [month, currency] = k.split("|") as [string, string];
      return {
        month,
        currency,
        sales: fromCents(v.s),
        expenses: fromCents(v.e),
        profit: fromCents(v.s - v.e),
        margin: v.s > 0 ? Math.round(((v.s - v.e) / v.s) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency));
}

/** Últimos `n` meses (AAAA-MM) terminando en `end`, para que el gráfico muestre también los meses en cero. */
export function lastMonths(end: string, n: number): string[] {
  const [y, m] = end.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

// ─────────────────────────── Balance ───────────────────────────

export type BalanceRow = {
  currency: string;
  cash: number; // cobrado − pagado hasta la fecha
  receivable: number; // ventas pendientes de cobro
  payable: number; // gastos pendientes de pago
  assets: number;
  liabilities: number;
  equity: number;
};

/**
 * Balance simplificado a una fecha, por moneda, armado solo con lo cargado en el sistema:
 * Activo = caja + cuentas por cobrar; Pasivo = cuentas por pagar; Patrimonio = Activo − Pasivo.
 * No incluye saldos previos, bienes ni deudas que no se hayan cargado como movimientos.
 */
export function balanceSheet(sales: Movement[], expenses: Movement[], asOf: string): BalanceRow[] {
  const acc = new Map<string, { cash: number; rec: number; pay: number }>();
  const get = (c: string) => {
    let v = acc.get(c);
    if (!v) acc.set(c, (v = { cash: 0, rec: 0, pay: 0 }));
    return v;
  };
  for (const s of sales) {
    if (s.voided || s.occurredOn > asOf) continue;
    const v = get(s.currency);
    if (s.status === "cobrado" && s.paidOn && s.paidOn <= asOf) v.cash += cents(s.amount);
    else v.rec += cents(s.amount);
  }
  for (const e of expenses) {
    if (e.voided || e.occurredOn > asOf) continue;
    const v = get(e.currency);
    if (e.status === "pagado" && e.paidOn && e.paidOn <= asOf) v.cash -= cents(e.amount);
    else v.pay += cents(e.amount);
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => {
      const assets = v.cash + v.rec;
      return {
        currency,
        cash: fromCents(v.cash),
        receivable: fromCents(v.rec),
        payable: fromCents(v.pay),
        assets: fromCents(assets),
        liabilities: fromCents(v.pay),
        equity: fromCents(assets - v.pay),
      };
    });
}

/**
 * Convierte lo que escribe una persona en un número con punto decimal.
 * Acepta formato argentino ("450.000", "450.000,50") e internacional ("450000.50", "1,500,000").
 */
export function parseAmount(input: string): string {
  const t = input.trim().replace(/\s/g, "").replace(/^\$/, "");
  if (/,\d{1,2}$/.test(t)) return t.replace(/\./g, "").replace(",", ".");
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return t.replace(/\./g, "");
  return t.replace(/,/g, "");
}
