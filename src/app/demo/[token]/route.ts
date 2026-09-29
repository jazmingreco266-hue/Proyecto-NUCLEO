import { getDb } from "@/db/client";
import { renderDemoHtml, type DemoContent } from "@/domain/demo";
import { publicDemo } from "@/server/services/demos";

export const dynamic = "force-dynamic";

// Página sin scripts ni recursos externos: la política lo impide aunque el contenido tuviera algo raro.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const headers = (status: number) => ({
  status,
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  },
});

const message = (title: string, body: string) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:1rem;text-align:center"><div><h1 style="font-size:1.4rem">${title}</h1><p>${body}</p></div></body></html>`;

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await publicDemo(getDb(), token);
  if (!r) return new Response(message("Propuesta no encontrada", "El enlace no es válido."), headers(404));
  if ("gone" in r) return new Response(message("Esta propuesta ya no está disponible", "El enlace venció o fue desactivado."), headers(410));
  const html = renderDemoHtml(r.demo.content as DemoContent, { version: r.demo.version, agencyName: r.agencyName, createdAt: r.demo.createdAt });
  return new Response(html, headers(200));
}
