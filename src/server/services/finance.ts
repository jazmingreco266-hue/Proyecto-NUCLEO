/**
 * Ventas, gastos, presupuestos y portafolio.
 * Los movimientos de dinero no se editan ni se borran (lo impone la base): se marcan como
 * cobrados/pagados o se anulan con motivo. Todo queda en el registro de actividad.
 */
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { expenses, portfolioItems, quotes, sales, users } from "@/db/schema";
import {
  balanceSheet,
  expenseInputSchema,
  monthlySummary,
  quoteInputSchema,
  quoteSplit,
  saleInputSchema,
  SERVICE_KINDS,
  type Movement,
} from "@/domain/finance";
import { sourceUrlSchema } from "@/domain/validation";
import { audit } from "../audit";
import { assertCan, ConflictError, NotFoundError, UserFacingError, type Principal } from "../principal";

export type Sale = typeof sales.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type PortfolioItem = typeof portfolioItems.$inferSelect;

const uuid = z.string().uuid();

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserFacingError(r.error.issues.map((i) => i.message).join(" · "));
  return r.data;
}

function userId(who: Principal): string {
  if (who.kind !== "user") throw new UserFacingError("Las finanzas las maneja una persona del equipo.");
  return who.id;
}

const today = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────── Ventas ───────────────────────────

export async function createSale(db: Db, who: Principal, input: unknown): Promise<Sale> {
  assertCan(who, "finance.write");
  const d = parse(saleInputSchema, input);
  const by = userId(who);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sales)
      .values({
        occurredOn: d.occurredOn,
        description: d.description,
        clientName: d.clientName,
        prospectId: d.prospectId ?? null,
        quoteId: d.quoteId ?? null,
        amount: d.amount.toFixed(2),
        currency: d.currency,
        status: d.status,
        paidOn: d.paidOn,
        method: d.method ?? null,
        notes: d.notes ?? null,
        createdBy: by,
      })
      .returning();
    await audit(tx, who, { action: "sale.create", entityType: "sale", entityId: row!.id, metadata: { monto: d.amount, moneda: d.currency, estado: d.status } });
    return row!;
  });
}

export async function createExpense(db: Db, who: Principal, input: unknown): Promise<Expense> {
  assertCan(who, "finance.write");
  const d = parse(expenseInputSchema, input);
  const by = userId(who);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        occurredOn: d.occurredOn,
        description: d.description,
        category: d.category,
        vendor: d.vendor ?? null,
        amount: d.amount.toFixed(2),
        currency: d.currency,
        status: d.status,
        paidOn: d.paidOn,
        notes: d.notes ?? null,
        createdBy: by,
      })
      .returning();
    await audit(tx, who, { action: "expense.create", entityType: "expense", entityId: row!.id, metadata: { monto: d.amount, moneda: d.currency, categoria: d.category } });
    return row!;
  });
}

const dateOrToday = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today());

/** Marca una venta pendiente como cobrada (una sola vez). */
export async function markSalePaid(db: Db, who: Principal, id: string, paidOn?: string) {
  assertCan(who, "finance.write");
  if (!uuid.safeParse(id).success) throw new NotFoundError("La venta");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(sales)
      .set({ status: "cobrado", paidOn: dateOrToday(paidOn) })
      .where(and(eq(sales.id, id), eq(sales.status, "pendiente"), isNull(sales.voidedAt)))
      .returning();
    if (!row) throw new ConflictError("La venta no existe, ya estaba cobrada o está anulada.");
    await audit(tx, who, { action: "sale.paid", entityType: "sale", entityId: id, metadata: { fecha: row.paidOn } });
    return row;
  });
}

export async function markExpensePaid(db: Db, who: Principal, id: string, paidOn?: string) {
  assertCan(who, "finance.write");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El gasto");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(expenses)
      .set({ status: "pagado", paidOn: dateOrToday(paidOn) })
      .where(and(eq(expenses.id, id), eq(expenses.status, "pendiente"), isNull(expenses.voidedAt)))
      .returning();
    if (!row) throw new ConflictError("El gasto no existe, ya estaba pagado o está anulado.");
    await audit(tx, who, { action: "expense.paid", entityType: "expense", entityId: id, metadata: { fecha: row.paidOn } });
    return row;
  });
}

/** Anula un movimiento: deja de contar en los totales pero sigue visible, con su motivo. */
export async function voidMovement(db: Db, who: Principal, kind: "sale" | "expense", id: string, reason: string) {
  assertCan(who, "finance.write");
  const by = userId(who);
  const why = reason?.trim();
  if (!why || why.length < 3) throw new UserFacingError("Explicá por qué se anula.");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El movimiento");
  const table = kind === "sale" ? sales : expenses;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(table)
      .set({ voidedAt: new Date(), voidedBy: by, voidReason: why.slice(0, 500) })
      .where(and(eq(table.id, id), isNull(table.voidedAt)))
      .returning();
    if (!row) throw new ConflictError("El movimiento no existe o ya estaba anulado.");
    await audit(tx, who, { action: `${kind}.void`, entityType: kind, entityId: id, metadata: { motivo: why } });
    return row;
  });
}

export const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listSales(db: Db, who: Principal, range: { from?: string; to?: string } = {}) {
  assertCan(who, "finance.read");
  const r = rangeSchema.catch({}).parse(range);
  return db
    .select({ s: sales, by: users.name })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.createdBy))
    .where(and(r.from ? gte(sales.occurredOn, r.from) : undefined, r.to ? lte(sales.occurredOn, r.to) : undefined))
    .orderBy(desc(sales.occurredOn), desc(sales.createdAt));
}

export async function listExpenses(db: Db, who: Principal, range: { from?: string; to?: string } = {}) {
  assertCan(who, "finance.read");
  const r = rangeSchema.catch({}).parse(range);
  return db
    .select({ e: expenses, by: users.name })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.createdBy))
    .where(and(r.from ? gte(expenses.occurredOn, r.from) : undefined, r.to ? lte(expenses.occurredOn, r.to) : undefined))
    .orderBy(desc(expenses.occurredOn), desc(expenses.createdAt));
}

const toMovement = (m: { occurredOn: string; amount: string; currency: string; status: string; paidOn: string | null; voidedAt: Date | null }): Movement => ({
  occurredOn: m.occurredOn,
  amount: Number(m.amount),
  currency: m.currency,
  status: m.status,
  paidOn: m.paidOn,
  voided: m.voidedAt != null,
});

/** Resumen mensual y balance, con todos los movimientos cargados. */
export async function financeReport(db: Db, who: Principal, asOf = today()) {
  assertCan(who, "finance.read");
  const [s, e] = await Promise.all([db.select().from(sales), db.select().from(expenses)]);
  const sm = s.map(toMovement);
  const em = e.map(toMovement);
  return { months: monthlySummary(sm, em), balance: balanceSheet(sm, em, asOf), asOf, counts: { sales: s.length, expenses: e.length } };
}

// ─────────────────────────── Presupuestos ───────────────────────────

export async function createQuote(db: Db, who: Principal, input: unknown): Promise<Quote> {
  assertCan(who, "finance.write");
  const d = parse(quoteInputSchema, input);
  const by = userId(who);
  const { oneTime: t, monthly } = quoteSplit(d.lines, d.discountPct, d.taxPct);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(quotes)
      .values({
        clientName: d.clientName,
        prospectId: d.prospectId ?? null,
        currency: d.currency,
        lines: d.lines,
        discountPct: d.discountPct.toFixed(2),
        taxPct: d.taxPct.toFixed(2),
        subtotal: t.subtotal.toFixed(2),
        total: t.total.toFixed(2),
        monthlyTotal: monthly.total.toFixed(2),
        validUntil: d.validUntil ?? null,
        notes: d.notes ?? null,
        createdBy: by,
      })
      .returning();
    await audit(tx, who, { action: "quote.create", entityType: "quote", entityId: row!.id, metadata: { numero: row!.number, total: t.total, mensual: monthly.total, moneda: d.currency } });
    return row!;
  });
}

const QUOTE_FLOW: Record<Quote["status"], Quote["status"][]> = {
  borrador: ["enviado", "rechazado"],
  enviado: ["aceptado", "rechazado"],
  aceptado: [],
  rechazado: [],
};

export async function setQuoteStatus(db: Db, who: Principal, id: string, to: Quote["status"]) {
  assertCan(who, "finance.write");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El presupuesto");
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!cur) throw new NotFoundError("El presupuesto");
    if (!QUOTE_FLOW[cur.status].includes(to)) throw new ConflictError(`Un presupuesto ${cur.status} no puede pasar a ${to}.`);
    const [row] = await tx.update(quotes).set({ status: to, updatedAt: new Date() }).where(eq(quotes.id, id)).returning();
    await audit(tx, who, { action: "quote.status", entityType: "quote", entityId: id, metadata: { numero: cur.number, desde: cur.status, hacia: to } });
    return row!;
  });
}

/** Un presupuesto aceptado se registra como venta pendiente de cobro, una sola vez (con bloqueo de la fila). */
export async function quoteToSale(db: Db, who: Principal, id: string): Promise<Sale> {
  assertCan(who, "finance.write");
  const by = userId(who);
  if (!uuid.safeParse(id).success) throw new NotFoundError("El presupuesto");
  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!q) throw new NotFoundError("El presupuesto");
    if (q.status !== "aceptado") throw new ConflictError("Solo un presupuesto aceptado se registra como venta.");
    if (q.saleId) throw new ConflictError("Este presupuesto ya se registró como venta.");
    if (Number(q.total) <= 0) throw new ConflictError("El presupuesto no tiene pagos únicos: registrá cada cobro mensual como venta cuando lo cobres.");
    const [sale] = await tx
      .insert(sales)
      .values({
        occurredOn: today(),
        description: `Presupuesto N.º ${q.number}`,
        clientName: q.clientName,
        prospectId: q.prospectId,
        quoteId: q.id,
        amount: q.total,
        currency: q.currency,
        status: "pendiente",
        paidOn: null,
        createdBy: by,
      })
      .returning();
    await tx.update(quotes).set({ saleId: sale!.id, updatedAt: new Date() }).where(eq(quotes.id, id));
    await audit(tx, who, { action: "quote.to_sale", entityType: "quote", entityId: id, metadata: { numero: q.number, venta: sale!.id, total: Number(q.total) } });
    return sale!;
  });
}

export async function listQuotes(db: Db, who: Principal) {
  assertCan(who, "finance.read");
  return db.select().from(quotes).orderBy(desc(quotes.number)).limit(300);
}

export async function getQuote(db: Db, who: Principal, id: string) {
  assertCan(who, "finance.read");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El presupuesto");
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!q) throw new NotFoundError("El presupuesto");
  return q;
}

// ─────────────────────────── Portafolio ───────────────────────────

const lines = (max: number) => z.array(z.string().trim().min(1).max(160)).max(max);

export const portfolioInputSchema = z.object({
  title: z.string().trim().min(2, "Falta el título").max(160),
  clientName: z.string().trim().min(2, "Falta el cliente").max(200),
  prospectId: z.string().uuid().nullable().optional(),
  url: z.union([z.literal(""), sourceUrlSchema]).transform((v) => v || null),
  year: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
  summary: z.string().trim().max(2000),
  highlights: lines(8),
  tags: lines(12),
  services: z.array(z.enum(SERVICE_KINDS)).max(SERVICE_KINDS.length).default([]),
  featured: z.boolean(),
  clientOk: z.boolean(),
});

export async function savePortfolioItem(db: Db, who: Principal, input: unknown, id?: string): Promise<PortfolioItem> {
  assertCan(who, "prospects.write");
  const d = parse(portfolioInputSchema, input);
  const by = userId(who);
  return db.transaction(async (tx) => {
    let row: PortfolioItem | undefined;
    if (id) {
      if (!uuid.safeParse(id).success) throw new NotFoundError("El trabajo");
      [row] = await tx
        .update(portfolioItems)
        .set({ ...d, prospectId: d.prospectId ?? null, year: d.year ?? null, updatedAt: new Date() })
        .where(and(eq(portfolioItems.id, id), isNull(portfolioItems.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError("El trabajo");
    } else {
      [row] = await tx
        .insert(portfolioItems)
        .values({ ...d, prospectId: d.prospectId ?? null, year: d.year ?? null, createdBy: by })
        .returning();
    }
    await audit(tx, who, { action: id ? "portfolio.update" : "portfolio.create", entityType: "portfolio", entityId: row!.id, metadata: { titulo: d.title } });
    return row!;
  });
}

export async function removePortfolioItem(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.write");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El trabajo");
  return db.transaction(async (tx) => {
    const [row] = await tx.update(portfolioItems).set({ deletedAt: new Date() }).where(and(eq(portfolioItems.id, id), isNull(portfolioItems.deletedAt))).returning();
    if (!row) throw new NotFoundError("El trabajo");
    await audit(tx, who, { action: "portfolio.remove", entityType: "portfolio", entityId: id, metadata: { titulo: row.title } });
  });
}

export async function listPortfolio(db: Db, who: Principal) {
  assertCan(who, "prospects.read");
  return db
    .select()
    .from(portfolioItems)
    .where(isNull(portfolioItems.deletedAt))
    .orderBy(desc(portfolioItems.featured), sql`${portfolioItems.year} DESC NULLS LAST`, asc(portfolioItems.title));
}
