import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage, UserFacingError } from "@/server/principal";
import { siteZip } from "@/server/services/site";

export const dynamic = "force-dynamic";

/** Sitio listo para subir al hosting del cliente (solo versiones que pasaron el control de calidad). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentPrincipal();
  if (!me) return new Response("Iniciá sesión.", { status: 401 });
  try {
    const { name, data } = await siteZip(getDb(), me, (await params).id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(publicMessage(err), { status: err instanceof UserFacingError ? 409 : 500 });
  }
}
