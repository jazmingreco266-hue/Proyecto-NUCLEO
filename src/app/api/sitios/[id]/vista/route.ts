import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage, UserFacingError } from "@/server/principal";
import { previewHtml } from "@/server/services/site";

export const dynamic = "force-dynamic";

/**
 * Vista previa del sitio del cliente. Se sirve aislada (sandbox, sin scripts) para que
 * nada del sitio pueda tocar la sesión del panel.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentPrincipal();
  if (!me) return new Response("Iniciá sesión.", { status: 401 });
  try {
    const html = await previewHtml(getDb(), me, (await params).id);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; script-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-popups allow-popups-to-escape-sandbox",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    return new Response(publicMessage(err), { status: err instanceof UserFacingError ? 404 : 500 });
  }
}
