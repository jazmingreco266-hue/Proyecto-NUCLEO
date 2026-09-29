import { getDb } from "@/db/client";
import { currentPrincipal } from "@/server/auth/current";
import { publicMessage } from "@/server/principal";
import { getMessages } from "@/server/services/demos";

export const dynamic = "force-dynamic";

/** Descarga el email HTML preparado, para abrirlo o pegarlo en el programa de correo. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await currentPrincipal();
  if (!who) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  try {
    const m = await getMessages(getDb(), who, id);
    return new Response(m.content.emailHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="email-v${m.version}.html"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return new Response(publicMessage(err), { status: 404 });
  }
}
