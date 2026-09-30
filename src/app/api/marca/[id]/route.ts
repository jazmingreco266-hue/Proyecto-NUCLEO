import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage } from "@/server/principal";
import { getBrandAsset } from "@/server/services/site";

export const dynamic = "force-dynamic";

/** Imagen del cliente (logo o foto) para mostrar en el panel. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentPrincipal();
  if (!me) return new Response("Iniciá sesión.", { status: 401 });
  try {
    const a = await getBrandAsset(getDb(), me, (await params).id);
    return new Response(new Uint8Array(a.bytes), {
      headers: { "Content-Type": a.mime, "Cache-Control": "private, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch (err) {
    return new Response(publicMessage(err), { status: 404 });
  }
}
