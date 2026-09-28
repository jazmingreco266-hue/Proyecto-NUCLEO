import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { NotFoundError } from "@/server/principal";
import { getMessage } from "@/server/services/outreach";

export const dynamic = "force-dynamic";

/** Muestra o descarga el email HTML de una versión de los mensajes. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentPrincipal();
  if (!me) return new Response("Iniciá sesión.", { status: 401 });
  const { id } = await params;
  let msg;
  try {
    msg = await getMessage(getDb(), me, id);
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("No existe.", { status: 404 });
    throw err;
  }
  const download = new URL(request.url).searchParams.has("descargar");
  return new Response(msg.emailHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // El email no ejecuta nada: sin scripts ni recursos externos salvo imágenes.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...(download
        ? { "Content-Disposition": `attachment; filename="nucleo-email-v${msg.version}.html"` }
        : {}),
    },
  });
}
