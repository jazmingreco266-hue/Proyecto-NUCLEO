import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth/current";
import { can } from "@/server/principal";
import { AGENT_LABELS, listRuns, runCounts, RUN_STATUS_LABELS, type RunStatus } from "@/server/services/agent-runs";
import { When } from "../../ui/format";
import { RunActions } from "./forms";

export const metadata: Metadata = { title: "Tareas" };

const FILTERS: { key?: string; label: string }[] = [
  { label: "Todas" },
  { key: "problemas", label: "Fallidas y bloqueadas" },
  { key: "queued", label: "En cola" },
  { key: "running", label: "Ejecutando" },
  { key: "succeeded", label: "Completadas" },
  { key: "cancelled", label: "Canceladas" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser("prospects.read");
  const sp = await searchParams;
  const db = getDb();
  const [{ filters, rows }, counts] = await Promise.all([listRuns(db, me, { status: sp.status }), runCounts(db, me)]);
  const canWrite = can(me, "prospects.write");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tareas de los agentes</h1>
          <p>
            Cada trabajo de un agente queda registrado: qué hizo, cuántos intentos, cuánto costó y por qué falló.
            Las bloqueadas no se reintentan solas (por ejemplo, si el sitio no permite el acceso automático).
          </p>
        </div>
      </div>

      <nav className="tabs" aria-label="Filtrar tareas">
        {FILTERS.map((f) => {
          const n = f.key === "problemas" ? counts.problems : f.key ? counts[f.key as RunStatus] : undefined;
          return (
            <Link key={f.label} href={f.key ? `?status=${f.key}` : "?"} aria-current={filters.status === f.key ? "page" : undefined}>
              {f.label}
              {n ? <span className="soon"> · {n}</span> : null}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="empty">
          <h3>No hay tareas {filters.status ? "con este filtro" : "todavía"}</h3>
          <p>Las tareas aparecen cuando pedís una auditoría desde la ficha de un prospecto o cuando el orquestador trabaja solo.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="cards">
            <thead>
              <tr>
                <th scope="col">Tarea</th>
                <th scope="col">Estado</th>
                <th scope="col">Prospecto</th>
                <th scope="col">Intentos</th>
                <th scope="col">Pedida por</th>
                <th scope="col">Costo</th>
                <th scope="col" className="col-wide">Detalle</th>
                {canWrite && <th scope="col">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, prospectName }) => (
                <tr key={r.id}>
                  <td className="cell-title">
                    <div className="cell">
                      <strong>{AGENT_LABELS[r.agent] ?? r.agent}</strong>
                      <div className="cell-sub">
                        <When date={r.createdAt} />
                      </div>
                    </div>
                  </td>
                  <td data-label="Estado">
                    <span className={`run run-${r.status}`}>{RUN_STATUS_LABELS[r.status]}</span>
                    {r.status === "queued" && r.runAfter > new Date() && (
                      <div className="cell-sub">
                        Desde <When date={r.runAfter} />
                      </div>
                    )}
                  </td>
                  <td data-label="Prospecto">
                    {r.prospectId && prospectName ? (
                      <Link href={`/panel/oportunidades/${r.prospectId}?tab=auditoria`}>{prospectName}</Link>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td data-label="Intentos" className="num">
                    {r.attempt}/{r.maxAttempts}
                  </td>
                  <td data-label="Pedida por">
                    {r.requestedByType === "user" ? "Persona del equipo" : r.requestedByType === "agent" ? `Agente ${r.requestedById}` : "Orquestador"}
                  </td>
                  <td data-label="Costo" className="num">
                    US$ {Number(r.costUsd).toFixed(2)}
                  </td>
                  <td data-label="Detalle">
                    {r.error ? <span className={r.status === "queued" ? "muted" : "text-danger"}>{r.error}</span> : <span className="faint">—</span>}
                    {r.tool && <div className="cell-sub">Herramienta: {r.tool}</div>}
                  </td>
                  {canWrite && (
                    <td data-label="Acciones">
                      <RunActions
                        runId={r.id}
                        canRetry={["failed", "blocked", "cancelled"].includes(r.status)}
                        canCancel={r.status === "queued"}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="faint">Se muestran las 100 más recientes.</p>
    </>
  );
}
