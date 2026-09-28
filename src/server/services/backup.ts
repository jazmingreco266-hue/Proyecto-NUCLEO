import { asc } from "drizzle-orm";
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
  users,
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
    db.select().from(auditLog).orderBy(asc(auditLog.id)),
  ]);

  const data = {
    formato: EXPORT_FORMAT,
    generado: new Date().toISOString(),
    aviso: "Copia de seguridad de Núcleo. No incluye contraseñas ni sesiones. Guardala en un lugar privado.",
    cantidades: {
      usuarios: userRows.length,
      prospectos: prospectRows.length,
      prospectosActivos: prospectRows.filter((p) => !p.deletedAt).length,
      datos: factRows.length,
      eventos: eventRows.length,
      aprobaciones: approvalRows.length,
      notas: noteRows.length,
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
    actividad: auditRows,
  };
  await audit(db, who, { action: "data.export", metadata: data.cantidades });
  return data;
}

