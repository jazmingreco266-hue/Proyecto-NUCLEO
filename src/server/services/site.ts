/**
 * Sitio web del cliente: imágenes de marca, ficha versionada y sitios generados.
 * Solo para empresas que ya son clientes (etapa de proyecto) y con autorización de marca registrada.
 */
import { createHash } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { brandAssets, prospects, siteBriefs, siteBuilds } from "@/db/schema";
import { inspectImage, MAX_IMAGE_BYTES } from "@/domain/brand";
import { STATUS_GROUP } from "@/domain/pipeline";
import { SITE_COPY_ESTIMATED_COST_USD } from "@/domain/site-copy";
import { assetPath, renderSite, SITE_TEMPLATE, siteBrandSchema, siteContentSchema, siteQuality, type AssetMeta, type Quality, type SiteBrand, type SiteContent } from "@/domain/site";
import { audit } from "../audit";
import { zip } from "../xlsx";
import { actorOf, assertCan, NotFoundError, UserFacingError, type Principal } from "../principal";
import { enqueueRun } from "./agent-runs";
import { transitionProspect } from "./prospects";

const uuid = z.string().uuid();
const MAX_UPLOADS_PER_CLIENT = 40;

export type BriefRow = Omit<typeof siteBriefs.$inferSelect, "brand" | "content"> & { brand: SiteBrand; content: SiteContent };
export type BuildRow = Omit<typeof siteBuilds.$inferSelect, "quality"> & { quality: Quality };

async function clientProspect(db: Db, prospectId: string) {
  if (!uuid.safeParse(prospectId).success) throw new NotFoundError("El prospecto");
  const [p] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!p || p.deletedAt) throw new NotFoundError("El prospecto");
  return p;
}

/** El sitio se arma solo cuando la empresa ya es cliente. */
export function isClient(status: keyof typeof STATUS_GROUP): boolean {
  return STATUS_GROUP[status] === "proyecto";
}

function assertClient(p: { status: keyof typeof STATUS_GROUP; isSample: boolean }) {
  if (p.isSample) throw new UserFacingError("Los prospectos de ejemplo no tienen sitio.");
  if (!isClient(p.status)) {
    throw new UserFacingError("El sitio se arma cuando la empresa ya es cliente: primero marcá el proyecto como aprobado.");
  }
}

// ── Imágenes ────────────────────────────────────────────────────────────

const assetCols = {
  id: brandAssets.id,
  kind: brandAssets.kind,
  mime: brandAssets.mime,
  width: brandAssets.width,
  height: brandAssets.height,
  alt: brandAssets.alt,
  createdAt: brandAssets.createdAt,
};

export async function uploadBrandAsset(db: Db, who: Principal, input: { prospectId: string; kind: "logo" | "foto"; bytes: Uint8Array; alt: string }) {
  assertCan(who, "prospects.write");
  if (who.kind !== "user") throw new UserFacingError("Las imágenes del cliente las carga una persona.");
  const p = await clientProspect(db, input.prospectId);
  assertClient(p);
  if (!["logo", "foto"].includes(input.kind)) throw new UserFacingError("Tipo de imagen inválido.");
  if (input.bytes.length === 0) throw new UserFacingError("Elegí un archivo.");
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new UserFacingError("La imagen pesa más de 3 MB. Exportala más liviana.");
  const info = inspectImage(input.bytes);
  if (!info) throw new UserFacingError("Formato no admitido. Usá PNG, JPG o WebP (SVG no, por seguridad).");
  const alt = input.alt.trim().slice(0, 200);
  if (input.kind === "foto" && alt.length < 3) throw new UserFacingError("Describí la foto en pocas palabras (se usa para accesibilidad y buscadores).");

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  return db.transaction(async (tx) => {
    await tx.select({ id: prospects.id }).from(prospects).where(eq(prospects.id, p.id)).for("update");
    const [dup] = await tx.select(assetCols).from(brandAssets).where(and(eq(brandAssets.prospectId, p.id), eq(brandAssets.sha256, sha256), eq(brandAssets.kind, input.kind), eq(brandAssets.alt, alt))).limit(1);
    if (dup) return dup;
    const [{ n }] = (await tx.select({ n: count() }).from(brandAssets).where(eq(brandAssets.prospectId, p.id))) as [{ n: number }];
    if (n >= MAX_UPLOADS_PER_CLIENT) throw new UserFacingError(`Se alcanzó el máximo de ${MAX_UPLOADS_PER_CLIENT} imágenes para este cliente.`);
    const [row] = await tx
      .insert(brandAssets)
      .values({ prospectId: p.id, kind: input.kind, mime: info.mime, width: info.width, height: info.height, bytes: Buffer.from(input.bytes), sha256, alt, createdBy: who.id })
      .returning(assetCols);
    await audit(tx, who, { action: "site.asset", entityType: "prospect", entityId: p.id, metadata: { tipo: input.kind, formato: info.mime, medidas: `${info.width}x${info.height}`, bytes: input.bytes.length } });
    return row!;
  });
}

export async function listBrandAssets(db: Db, who: Principal, prospectId: string): Promise<(AssetMeta & { createdAt: Date })[]> {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(prospectId).success) return [];
  return db.select(assetCols).from(brandAssets).where(eq(brandAssets.prospectId, prospectId)).orderBy(brandAssets.createdAt);
}

async function assetBytes(db: Db, ids: string[]): Promise<Map<string, Buffer>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: brandAssets.id, bytes: brandAssets.bytes }).from(brandAssets).where(inArray(brandAssets.id, ids));
  return new Map(rows.map((r) => [r.id, r.bytes]));
}

export async function getBrandAsset(db: Db, who: Principal, id: string) {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(id).success) throw new NotFoundError("La imagen");
  const [row] = await db.select({ mime: brandAssets.mime, bytes: brandAssets.bytes }).from(brandAssets).where(eq(brandAssets.id, id)).limit(1);
  if (!row) throw new NotFoundError("La imagen");
  return row;
}

// ── Ficha ───────────────────────────────────────────────────────────────

const briefInput = z.object({
  prospectId: z.string().uuid(),
  brand: siteBrandSchema,
  content: siteContentSchema,
  authorizationNote: z.string().trim().min(5, "Anotá cómo te autorizó el cliente a usar su marca (ej. «Nos mandó el logo por mail el 30/09»).").max(500),
});

const FIELD_NAMES: Record<string, string> = {
  businessName: "Nombre", tagline: "Frase principal", intro: "Introducción", about: "Nosotros", services: "Servicios",
  highlights: "Destacados", contact: "Contacto", social: "Redes", cta: "Botón", domain: "Dominio", seoDescription: "Descripción para buscadores",
  colors: "Colores", headingFont: "Fuente de títulos", bodyFont: "Fuente de textos", authorizationNote: "Autorización",
};

/** Primer problema de la ficha, en palabras simples. */
function firstIssue(err: z.ZodError): string {
  const i = err.issues[0]!;
  const key = i.path.find((k) => typeof k === "string" && k in FIELD_NAMES && k !== "content" && k !== "brand") as string | undefined;
  return key ? `${FIELD_NAMES[key]}: ${i.message}` : i.message;
}

export async function saveBrief(db: Db, who: Principal, input: unknown): Promise<BriefRow> {
  assertCan(who, "prospects.write");
  const parsed = briefInput.safeParse(input);
  if (!parsed.success) throw new UserFacingError(firstIssue(parsed.error));
  const data = parsed.data;
  const p = await clientProspect(db, data.prospectId);
  assertClient(p);

  // Las imágenes elegidas tienen que ser de este cliente y del tipo correcto.
  const assets = new Map((await listBrandAssets(db, who, p.id)).map((a) => [a.id, a]));
  if (data.brand.logoId && assets.get(data.brand.logoId)?.kind !== "logo") throw new UserFacingError("El logo elegido no es de este cliente.");
  for (const id of [data.content.heroPhotoId, ...data.content.galleryIds].filter(Boolean) as string[]) {
    if (assets.get(id)?.kind !== "foto") throw new UserFacingError("Una de las fotos elegidas no es de este cliente.");
  }
  data.content.galleryIds = [...new Set(data.content.galleryIds)].filter((id) => id !== data.content.heroPhotoId);

  return insertBrief(db, who, p.id, data.brand, data.content, data.authorizationNote, "site.brief");
}

/** Guarda una versión nueva de la ficha. También lo usa el agente que pule los textos. */
export async function insertBrief(db: Db, who: Principal, prospectId: string, brand: SiteBrand, content: SiteContent, authorizationNote: string, action: string, metadata: Record<string, unknown> = {}) {
  const actor = actorOf(who);
  return db.transaction(async (tx) => {
    await tx.select({ id: prospects.id }).from(prospects).where(eq(prospects.id, prospectId)).for("update");
    const [{ next }] = (await tx.execute<{ next: number }>(sql`SELECT coalesce(max(version), 0)::int + 1 AS next FROM site_briefs WHERE prospect_id = ${prospectId}`)).rows as [{ next: number }];
    const [row] = await tx
      .insert(siteBriefs)
      .values({ prospectId, version: next, brand, content, authorizationNote, createdByType: actor.type, createdById: actor.id })
      .returning();
    await audit(tx, who, { action, entityType: "prospect", entityId: prospectId, metadata: { version: next, ...metadata } });
    return row as BriefRow;
  });
}

export async function latestBrief(db: Db, who: Principal, prospectId: string): Promise<BriefRow | null> {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(prospectId).success) return null;
  const [row] = await db.select().from(siteBriefs).where(eq(siteBriefs.prospectId, prospectId)).orderBy(desc(siteBriefs.version)).limit(1);
  return (row as BriefRow | undefined) ?? null;
}

// ── Sitios generados ────────────────────────────────────────────────────

export async function buildSite(db: Db, who: Principal, prospectId: string, now = new Date()): Promise<BuildRow> {
  assertCan(who, "prospects.write");
  if (who.kind !== "user") throw new UserFacingError("El sitio lo genera una persona desde el panel.");
  const p = await clientProspect(db, prospectId);
  assertClient(p);
  const brief = await latestBrief(db, who, p.id);
  if (!brief) throw new UserFacingError("Primero completá y guardá la ficha del sitio.");
  const assets = await listBrandAssets(db, who, p.id);
  const input = { brand: brief.brand, content: brief.content, assets };
  const { html, css } = renderSite({ ...input, year: now.getFullYear() });
  const quality = siteQuality(input);

  const row = await db.transaction(async (tx) => {
    await tx.select({ id: prospects.id }).from(prospects).where(eq(prospects.id, p.id)).for("update");
    const [{ next }] = (await tx.execute<{ next: number }>(sql`SELECT coalesce(max(version), 0)::int + 1 AS next FROM site_builds WHERE prospect_id = ${p.id}`)).rows as [{ next: number }];
    const [r] = await tx
      .insert(siteBuilds)
      .values({ prospectId: p.id, version: next, briefId: brief.id, template: SITE_TEMPLATE, html, css, quality, ready: quality.ready, createdBy: who.id })
      .returning();
    await audit(tx, who, { action: "site.build", entityType: "prospect", entityId: p.id, metadata: { version: next, ficha: brief.version, listo: quality.ready } });
    return r as BuildRow;
  });

  // Proyecto aprobado → En construcción, con la primera versión generada.
  if (p.status === "APPROVED") {
    try {
      await transitionProspect(db, who, { prospectId: p.id, to: "BUILDING", reason: `Sitio v${row.version} generado.`, nextStep: "Revisar la vista previa con el cliente.", expectedVersion: p.version });
    } catch {
      // Si alguien lo movió mientras tanto, se respeta ese cambio.
    }
  }
  return row;
}

export async function listBuilds(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(prospectId).success) return [];
  return (await db
    .select({ id: siteBuilds.id, version: siteBuilds.version, ready: siteBuilds.ready, quality: siteBuilds.quality, createdAt: siteBuilds.createdAt, briefId: siteBuilds.briefId })
    .from(siteBuilds)
    .where(eq(siteBuilds.prospectId, prospectId))
    .orderBy(desc(siteBuilds.version))) as { id: string; version: number; ready: boolean; quality: Quality; createdAt: Date; briefId: string }[];
}

async function getBuild(db: Db, who: Principal, id: string): Promise<BuildRow> {
  assertCan(who, "prospects.read");
  if (!uuid.safeParse(id).success) throw new NotFoundError("El sitio");
  const [row] = await db.select().from(siteBuilds).where(eq(siteBuilds.id, id)).limit(1);
  if (!row) throw new NotFoundError("El sitio");
  return row as BuildRow;
}

/** Imágenes que usa una versión, con su ruta dentro del sitio. */
async function buildFiles(db: Db, who: Principal, build: BuildRow) {
  const assets = await listBrandAssets(db, who, build.prospectId);
  const photos = assets.filter((a) => a.kind === "foto");
  const used = assets.filter((a) => build.html.includes(`"${assetPath(a, photos.indexOf(a))}"`));
  const bytes = await assetBytes(db, used.map((a) => a.id));
  return used.map((a) => ({ path: assetPath(a, photos.indexOf(a)), mime: a.mime, data: bytes.get(a.id)! }));
}

/** Vista previa en un solo archivo: estilos e imágenes incrustados. */
export async function previewHtml(db: Db, who: Principal, buildId: string): Promise<string> {
  const build = await getBuild(db, who, buildId);
  let html = build.html.replace('<link rel="stylesheet" href="styles.css">', `<style>${build.css}</style>`);
  for (const f of await buildFiles(db, who, build)) {
    html = html.split(`"${f.path}"`).join(`"data:${f.mime};base64,${f.data.toString("base64")}"`);
  }
  return html;
}

/** Sitio listo para subir a cualquier hosting. Solo se entrega si pasó el control de calidad. */
export async function siteZip(db: Db, who: Principal, buildId: string): Promise<{ name: string; data: Buffer }> {
  const build = await getBuild(db, who, buildId);
  if (!build.ready) throw new UserFacingError("Esta versión no pasó el control de calidad: corregí lo marcado y generá una nueva.");
  const [p] = await db.select({ name: prospects.name }).from(prospects).where(eq(prospects.id, build.prospectId));
  const files = [
    { name: "index.html", data: Buffer.from(build.html, "utf8") },
    { name: "styles.css", data: Buffer.from(build.css, "utf8") },
    ...(await buildFiles(db, who, build)).map((f) => ({ name: f.path, data: f.data })),
  ];
  await audit(db, who, { action: "site.download", entityType: "prospect", entityId: build.prospectId, metadata: { version: build.version } });
  const slug = (p?.name ?? "sitio")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return { name: `${slug || "sitio"}-v${build.version}.zip`, data: zip(files) };
}

// ── Redacción con IA ────────────────────────────────────────────────────

export const SITE_COPY_AGENT = "site-copy";

/** Encola la redacción con IA sobre la última ficha. La IA no inventa: solo reescribe lo cargado. */
export async function requestSiteCopy(db: Db, who: Principal, prospectId: string) {
  assertCan(who, "prospects.write");
  const p = await clientProspect(db, prospectId);
  assertClient(p);
  const brief = await latestBrief(db, who, p.id);
  if (!brief) throw new UserFacingError("Primero completá y guardá la ficha del sitio.");
  return db.transaction((tx) =>
    enqueueRun(tx, who, {
      agent: SITE_COPY_AGENT,
      task: `Redacción profesional de los textos del sitio (ficha v${brief.version})`,
      prospectId: p.id,
      input: { briefId: brief.id },
      dedupeKey: `${SITE_COPY_AGENT}:${p.id}`,
      estimatedCostUsd: SITE_COPY_ESTIMATED_COST_USD,
      maxAttempts: 2,
    }),
  );
}
