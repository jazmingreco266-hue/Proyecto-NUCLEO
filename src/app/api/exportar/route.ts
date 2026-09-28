import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { can } from "@/server/principal";
import { exportAll } from "@/server/services/backup";

export const dynamic = "force-dynamic";

/** Descarga la copia de seguridad completa. Solo el propietario. */
export async function GET() {
  const me = await currentPrincipal();
  if (!me) return new Response("Iniciá sesión.", { status: 401 });
  if (!can(me, "users.manage")) return new Response("Solo el propietario puede descargar copias.", { status: 403 });
  const data = await exportAll(getDb(), me);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nucleo-copia-${day}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
