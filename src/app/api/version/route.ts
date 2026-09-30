export const dynamic = "force-dynamic";

/** Versión publicada del panel. Solo un identificador del build: no expone datos. */
export function GET() {
  return Response.json({ version: process.env.NUCLEO_VERSION ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
