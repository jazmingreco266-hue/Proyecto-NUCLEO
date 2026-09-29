import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { can } from "@/server/principal";
import { financeWorkbook } from "@/server/services/finance-export";

export const dynamic = "force-dynamic";

/** Excel con ventas, gastos, resultado mensual, balance y presupuestos. Solo el propietario. */
export async function GET() {
  const me = await currentPrincipal();
  if (!me) return new Response("Iniciá sesión.", { status: 401 });
  if (!can(me, "finance.read")) return new Response("Solo el propietario puede descargar las finanzas.", { status: 403 });
  const file = await financeWorkbook(getDb(), me);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nucleo-finanzas-${day}.xlsx"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
