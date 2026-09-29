import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { expenses, sales } from "@/db/schema";
import { balanceSheet, lastMonths, monthlySummary, parseAmount, quoteTotals, type Movement } from "@/domain/finance";
import { ForbiddenError } from "@/domain/permissions";
import {
  createExpense,
  createQuote,
  createSale,
  financeReport,
  listExpenses,
  listPortfolio,
  markExpensePaid,
  markSalePaid,
  quoteToSale,
  removePortfolioItem,
  savePortfolioItem,
  setQuoteStatus,
  voidMovement,
} from "@/server/services/finance";
import { db, makeUser, resetData } from "./helpers";

beforeEach(resetData);
afterAll(closeDb);

const mv = (o: Partial<Movement>): Movement => ({ occurredOn: "2026-09-10", amount: 100, currency: "ARS", status: "cobrado", paidOn: "2026-09-10", voided: false, ...o });
const cause = (e: unknown) => String((e as { cause?: Error }).cause?.message ?? e);
const dbErr = <T,>(p: Promise<T>) => p.catch((e) => { throw new Error(cause(e)); });

describe("finanzas: cálculos", () => {
  it("presupuesto: descuento sobre el subtotal e impuesto sobre lo que queda, en centavos", () => {
    expect(quoteTotals([{ description: "Sitio", quantity: 1, unitPrice: 450000 }, { description: "Sección extra", quantity: 3, unitPrice: 33333.33 }], 10, 21)).toEqual({
      subtotal: 549999.99,
      discount: 55000,
      taxable: 494999.99,
      tax: 103950,
      total: 598949.99,
    });
    expect(quoteTotals([{ description: "x", quantity: 1, unitPrice: 0.1 }, { description: "y", quantity: 1, unitPrice: 0.2 }], 0, 0).total).toBe(0.3);
  });

  it("resultado mensual por moneda, sin anulados y sin convertir monedas", () => {
    const rows = monthlySummary(
      [mv({ amount: 1000 }), mv({ amount: 500, voided: true }), mv({ amount: 50, currency: "USD" }), mv({ occurredOn: "2026-08-01", amount: 200, status: "pendiente", paidOn: null })],
      [mv({ amount: 300 }), mv({ amount: 10, currency: "USD" })],
    );
    expect(rows).toEqual([
      { month: "2026-08", currency: "ARS", sales: 200, expenses: 0, profit: 200, margin: 100 },
      { month: "2026-09", currency: "ARS", sales: 1000, expenses: 300, profit: 700, margin: 70 },
      { month: "2026-09", currency: "USD", sales: 50, expenses: 10, profit: 40, margin: 80 },
    ]);
  });

  it("balance: caja, por cobrar, por pagar y patrimonio a una fecha", () => {
    const b = balanceSheet(
      [mv({ amount: 1000 }), mv({ amount: 400, status: "pendiente", paidOn: null }), mv({ amount: 999, occurredOn: "2026-10-01" })],
      [mv({ amount: 300, status: "pagado" }), mv({ amount: 120, status: "pendiente", paidOn: null }), mv({ amount: 80, status: "pagado", paidOn: "2026-10-05" })],
      "2026-09-30",
    );
    expect(b).toEqual([{ currency: "ARS", cash: 700, receivable: 400, payable: 200, assets: 1100, liabilities: 200, equity: 900 }]);
  });

  it("lee montos en formato argentino e internacional", () => {
    const cases: [string, string][] = [["450000", "450000"], ["450.000", "450000"], ["450.000,50", "450000.50"], ["450000.50", "450000.50"], ["1.500.000", "1500000"], ["1,500,000", "1500000"], ["$ 99,9", "99.9"], ["99.9", "99.9"]];
    for (const [a, b] of cases) expect(parseAmount(a), a).toBe(b);
  });

  it("meses para el gráfico, incluidos los que no tienen movimientos", () => {
    expect(lastMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("finanzas: ventas y gastos", () => {
  it("solo el propietario ve y carga finanzas", async () => {
    const op = await makeUser("operator");
    await expect(createSale(db(), op, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listExpenses(db(), op)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nada se borra ni se edita: se cobra una vez o se anula con motivo", async () => {
    const owner = await makeUser();
    const s = await createSale(db(), owner, { occurredOn: "2026-09-01", description: "Sitio institucional", clientName: "Panadería Sol", amount: "450000", currency: "ars", status: "pendiente" });
    expect(s).toMatchObject({ currency: "ARS", status: "pendiente", paidOn: null, amount: "450000.00" });

    await dbErr(db().update(sales).set({ amount: "1" }).where(eq(sales.id, s.id))).then(() => { throw new Error("no debería"); }, (e) => expect(String(e)).toMatch(/no se edita/));
    await expect(dbErr(db().execute(sql`DELETE FROM sales`))).rejects.toThrow(/no se borran/);

    const paid = await markSalePaid(db(), owner, s.id, "2026-09-15");
    expect(paid).toMatchObject({ status: "cobrado", paidOn: "2026-09-15" });
    await expect(markSalePaid(db(), owner, s.id)).rejects.toThrow(/ya estaba cobrada/);
    await expect(dbErr(db().update(sales).set({ status: "pendiente" }).where(eq(sales.id, s.id)))).rejects.toThrow(/no vuelve a pendiente/);

    await expect(voidMovement(db(), owner, "sale", s.id, "")).rejects.toThrow(/por qué/);
    const v = await voidMovement(db(), owner, "sale", s.id, "Cargada dos veces");
    expect(v.voidReason).toBe("Cargada dos veces");
    await expect(voidMovement(db(), owner, "sale", s.id, "Otra vez")).rejects.toThrow(/ya estaba anulado/);
    await expect(dbErr(db().update(sales).set({ voidReason: "cambio" }).where(eq(sales.id, s.id)))).rejects.toThrow(/ya está anulado/);
  });

  it("valida montos, fechas, monedas y categorías", async () => {
    const owner = await makeUser();
    await expect(createExpense(db(), owner, { occurredOn: "2026-09-01", description: "Hosting", category: "Hosting y dominios", amount: 0, currency: "ARS", status: "pagado" })).rejects.toThrow(/mayor a 0/);
    await expect(createExpense(db(), owner, { occurredOn: "ayer", description: "Hosting", category: "Hosting y dominios", amount: 10, currency: "ARS", status: "pagado" })).rejects.toThrow(/Fecha/);
    await expect(createExpense(db(), owner, { occurredOn: "2026-09-01", description: "Hosting", category: "Inventada", amount: 10, currency: "ARS", status: "pagado" })).rejects.toThrow();
    const e = await createExpense(db(), owner, { occurredOn: "2026-09-01", description: "Vercel Pro", category: "Hosting y dominios", amount: 20, currency: "USD", status: "pagado" });
    expect(e.paidOn).toBe("2026-09-01"); // pagado sin fecha = el día del gasto
    const p = await createExpense(db(), owner, { occurredOn: "2026-09-02", description: "Diseño", category: "Sueldos y colaboradores", amount: 100, currency: "ARS", status: "pendiente" });
    await markExpensePaid(db(), owner, p.id, "2026-09-20");
    await expect(dbErr(db().delete(expenses))).rejects.toThrow(/no se borran/);
  });

  it("el reporte ignora anulados", async () => {
    const owner = await makeUser();
    await createSale(db(), owner, { occurredOn: "2026-09-01", description: "Web", clientName: "Cliente A", amount: 1000, currency: "ARS", status: "cobrado" });
    const bad = await createSale(db(), owner, { occurredOn: "2026-09-01", description: "Web dup", clientName: "Cliente A", amount: 1000, currency: "ARS", status: "cobrado" });
    await voidMovement(db(), owner, "sale", bad.id, "Duplicada");
    await createExpense(db(), owner, { occurredOn: "2026-09-03", description: "Hosting", category: "Hosting y dominios", amount: 250, currency: "ARS", status: "pagado" });
    const r = await financeReport(db(), owner, "2026-09-30");
    expect(r.months).toEqual([{ month: "2026-09", currency: "ARS", sales: 1000, expenses: 250, profit: 750, margin: 75 }]);
    expect(r.balance[0]).toMatchObject({ cash: 750, equity: 750 });
  });
});

describe("finanzas: presupuestos", () => {
  it("calcula, avanza de estado y se registra como venta una sola vez", async () => {
    const owner = await makeUser();
    const q = await createQuote(db(), owner, {
      clientName: "Panadería Sol",
      currency: "ARS",
      lines: [{ description: "Sitio institucional", quantity: 1, unitPrice: 450000 }],
      discountPct: 10,
      taxPct: 0,
    });
    expect(q).toMatchObject({ status: "borrador", subtotal: "450000.00", total: "405000.00" });
    await expect(quoteToSale(db(), owner, q.id)).rejects.toThrow(/aceptado/);
    await expect(setQuoteStatus(db(), owner, q.id, "aceptado")).rejects.toThrow(/no puede pasar/);
    await setQuoteStatus(db(), owner, q.id, "enviado");
    await setQuoteStatus(db(), owner, q.id, "aceptado");

    const results = await Promise.allSettled([quoteToSale(db(), owner, q.id), quoteToSale(db(), owner, q.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [row] = await db().select().from(sales);
    expect(row).toMatchObject({ amount: "405000.00", status: "pendiente", quoteId: q.id });
    await expect(dbErr(db().execute(sql`UPDATE quotes SET total = 1`))).rejects.toThrow(/no se edita/);
  });
});

describe("portafolio", () => {
  it("carga, edita y retira trabajos; lectura para todos, edición para operadores", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    const input = { title: "Panadería Sol", clientName: "Panadería Sol", url: "https://sol.test", year: 2026, summary: "Sitio con pedidos por WhatsApp", highlights: ["Carga en 1 s"], tags: ["gastronomía"], featured: true, clientOk: true };
    await expect(savePortfolioItem(db(), viewer, input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(savePortfolioItem(db(), owner, { ...input, url: "javascript:alert(1)" })).rejects.toThrow(/http/);
    const it1 = await savePortfolioItem(db(), owner, input);
    await savePortfolioItem(db(), owner, { ...input, title: "Panadería Sol (2026)" }, it1.id);
    expect((await listPortfolio(db(), viewer)).map((x) => x.title)).toEqual(["Panadería Sol (2026)"]);
    await removePortfolioItem(db(), owner, it1.id);
    expect(await listPortfolio(db(), viewer)).toEqual([]);
  });
});

describe("Excel y copia de seguridad", () => {
  it("el Excel es un ZIP válido con las cinco hojas y fórmulas de resultado", async () => {
    const { financeWorkbook } = await import("@/server/services/finance-export");
    const { buildXlsx, excelDate, xmlText } = await import("@/server/xlsx");
    const owner = await makeUser();
    await createSale(db(), owner, { occurredOn: "2026-09-01", description: "Web", clientName: "Cliente <A>", amount: 1000, currency: "ARS", status: "cobrado" });
    const file = await financeWorkbook(db(), owner);
    expect(file.subarray(0, 2).toString()).toBe("PK");
    const text = file.toString("utf8");
    for (const n of ["Resultado mensual", "Balance", "Ventas", "Gastos", "Presupuestos"]) expect(text).toContain(`name="${n}"`);
    expect(text).toContain("<f>C2-D2</f>");
    expect(text).toContain("Cliente &lt;A&gt;");
    expect(excelDate("2026-09-01")).toBe(46266);
    expect(xmlText("a\u0007b&")).toBe("ab&amp;");
    expect(buildXlsx([{ name: "a/b*c", columns: [{ header: "x", type: "text" }], rows: [] }]).toString("utf8")).toContain('name="a b c"');
    const op = await makeUser("operator");
    await expect(financeWorkbook(db(), op)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("la copia de seguridad incluye ventas, gastos, presupuestos y portafolio", async () => {
    const { exportAll, lastBackupAt } = await import("@/server/services/backup");
    const owner = await makeUser();
    await createExpense(db(), owner, { occurredOn: "2026-09-01", description: "Hosting", category: "Hosting y dominios", amount: 20, currency: "USD", status: "pagado" });
    expect(await lastBackupAt(db(), owner)).toBeNull();
    const copy = await exportAll(db(), owner);
    expect(copy.cantidades).toMatchObject({ gastos: 1, ventas: 0, presupuestos: 0, portafolio: 0 });
    expect(copy.gastos[0]).toMatchObject({ description: "Hosting", amount: "20.00" });
    expect(await lastBackupAt(db(), owner)).toBeInstanceOf(Date);
  });
});
