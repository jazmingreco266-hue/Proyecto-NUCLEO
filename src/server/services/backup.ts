import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  agentRuns,
  approvalDecisions,
  approvals,
  auditLog,
  notes,
  pipelineEvents,
  prospectFacts,
  prospects,
  settings,
  settingsHistory,
  siteAudits,
  users,
  sales,
  expenses,
  quotes,
  portfolioItems,
  outreachMessages,
  brandAssets,
  siteBriefs,
  siteBuilds,
} from "@/db/schema";
import { audit } from "../audit";
import { assertCan, type Principal } from "../principal";

export const EXPORT_FORMAT = "nucleo-copia-v1";

/**
 * Copia de seguridad completa en JSON. Excluye a propósito contraseñas y sesiones.
 * Incluye los registros retirados (borrado lógico), para que la copia sea fiel.
 */
export async function exportAll(db: Db, who: Principal) {
  assertCan(who, "users.manage");
  const [
    userRows,
    prospectRows,
    factRows,
    eventRows,
    approvalRows,
    decisionRows,
    noteRows,
    settingsRows,
    historyRows,
    runRows,
    siteAuditRows,
    saleRows,
    expenseRows,
    quoteRows,
    portfolioRows,
    messageRows,
    briefRows,
    buildRows,
    assetRows,
    auditRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    db.select().from(prospects).orderBy(asc(prospects.createdAt)),
    db.select().from(prospectFacts).orderBy(asc(prospectFacts.createdAt)),
    db.select().from(pipelineEvents).orderBy(asc(pipelineEvents.id)),
    db.select().from(approvals).orderBy(asc(approvals.requestedAt)),
    db.select().from(approvalDecisions).orderBy(asc(approvalDecisions.createdAt)),
    db.select().from(notes).orderBy(asc(notes.createdAt)),
    db.select().from(settings),
    db.select().from(settingsHistory).orderBy(asc(settingsHistory.id)),
    db.select().from(agentRuns).orderBy(asc(agentRuns.createdAt)),
    db.select().from(siteAudits).orderBy(asc(siteAudits.createdAt)),
    db.select().from(sales).orderBy(asc(sales.createdAt)),
    db.select().from(expenses).orderBy(asc(expenses.createdAt)),
    db.select().from(quotes).orderBy(asc(quotes.number)),
    db.select().from(portfolioItems).orderBy(asc(portfolioItems.createdAt)),
    db.select().from(outreachMessages).orderBy(asc(outreachMessages.createdAt)),
    db.select().from(siteBriefs).orderBy(asc(siteBriefs.createdAt)),
    db.select().from(siteBuilds).orderBy(asc(siteBuilds.createdAt)),
    // Las imágenes van sin su contenido (para que la copia no pese cientos de MB): quedan en la base
    // y el cliente tiene los originales. Se guarda su huella (sha256) para identificarlas.
    db
      .select({ id: brandAssets.id, prospectId: brandAssets.prospectId, kind: brandAssets.kind, mime: brandAssets.mime, width: brandAssets.width, height: brandAssets.height, sha256: brandAssets.sha256, alt: brandAssets.alt, createdAt: brandAssets.createdAt })
      .from(brandAssets)
      .orderBy(asc(brandAssets.createdAt)),
    db.select().from(auditLog).orderBy(asc(auditLog.id)),
  ]);

  const data = {
    formato: EXPORT_FORMAT,
    generado: new Date().toISOString(),
    aviso: "Copia de seguridad de Núcleo. No incluye contraseñas, sesiones ni el contenido de las imágenes de marca (solo sus datos). Guardala en un lugar privado.",
    cantidades: {
      usuarios: userRows.length,
      prospectos: prospectRows.length,
      prospectosActivos: prospectRows.filter((p) => !p.deletedAt).length,
      datos: factRows.length,
      eventos: eventRows.length,
      aprobaciones: approvalRows.length,
      notas: noteRows.length,
      auditoriasWeb: siteAuditRows.length,
      ventas: saleRows.length,
      gastos: expenseRows.length,
      presupuestos: quoteRows.length,
      portafolio: portfolioRows.length,
      mensajes: messageRows.length,
      fichasSitio: briefRows.length,
      sitiosGenerados: buildRows.length,
      imagenesMarca: assetRows.length,
      actividad: auditRows.length,
    },
    usuarios: userRows,
    prospectos: prospectRows,
    datos: factRows,
    eventos: eventRows,
    aprobaciones: approvalRows,
    decisiones: decisionRows,
    notas: noteRows,
    configuracion: settingsRows,
    historialConfiguracion: historyRows,
    ejecucionesAgentes: runRows,
    auditoriasWeb: siteAuditRows,
    ventas: saleRows,
    gastos: expenseRows,
    presupuestos: quoteRows,
    portafolio: portfolioRows,
    mensajes: messageRows,
    fichasSitio: briefRows,
    sitiosGenerados: buildRows,
    imagenesMarca: assetRows,
    actividad: auditRows,
  };
  await audit(db, who, { action: "data.export", metadata: data.cantidades });
  return data;
}


/** Fecha de la última copia descargada, para recordar hacer una nueva. */
export async function lastBackupAt(db: Db, who: Principal): Promise<Date | null> {
  assertCan(who, "users.manage");
  const [row] = await db
    .select({ at: auditLog.createdAt })
    .from(auditLog)
    .where(eq(auditLog.action, "data.export"))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  return row?.at ?? null;
}
